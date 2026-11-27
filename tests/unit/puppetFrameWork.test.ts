import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import { advancePuppet, advancePuppetSkin, puppetElapsedMs } from "../../src/puppets/runtimeStep";
import { puppetAffineUniform, puppetOffsetUniform } from "../../src/puppets/renderTransform";

const skinTable = { bones: new Float32Array(12), normal: new Float32Array(12), posed: new Float32Array(12) };
const skinFrame = { mode: "palette", table: skinTable, palette: new Float32Array(24) };

function fixture(gpu = false) {
  const gl: any = new Proxy({ ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, DYNAMIC_DRAW: 4 }, {
    get(target: any, key) { return target[key] ??= vi.fn(() => ({})); },
  });
  const calculateMatrix=vi.fn(() => ({ calc: {a:1,b:0,c:0,d:1,e:0,f:0}, camera: {a:1,b:0,c:0,d:1} }));
  const program = gpu ? { skinning: true, position: 0, uv: 1, skinBones: 2, skinNormal: 3, skinPosed: 4, palette: {} } : {};
  const Creature = sourceClass("src/puppets/IndexedPuppetCreature.ts", "IndexedPuppetCreature", {
    Phaser: { GameObjects: { Image: class {}, GetCalcMatrix: calculateMatrix } },
    gpuGeneration: 0, programs: new WeakMap([[gl, program]]), watchContextRestore: () => {},
    puppetAffineUniform, puppetOffsetUniform, puppetShaderAlpha: (a: number, b: number) => a * b,
    advancePuppet, advancePuppetSkin, puppetElapsedMs, debugPerfEnabled: false,
    // 기본은 CPU 정점 경로의 예산을 본다. 정점이 같은지는 gpuSkinParity가 실제 묶음으로 본다.
    gpuSkinningAvailable: gpu, gpuSkinningDisabled: false,
    SKIN_MAX_BONES: 36, SKIN_PALETTE_STRIDE: 12, SKIN_MAX_INFLUENCES: 4, tableBuffers: new Map(),
    applySkinTable: vi.fn(), bindAttribute: vi.fn(),
    createTableBuffers: vi.fn(() => ({ generation: 0, rest: {}, bones: {}, normal: {}, posed: {} })),
  });
  const creature = Object.assign(Object.create(Creature.prototype), {
    active: true, visible: true, alpha: 1, animationFrozen: false, decorativeUpdateCredit: 0, decorativeCarryMs: 0,
    displayOriginX: 0, displayOriginY: 0, flipX: false, flipY: false,
    decorativeUpdateFactor: 1, lastLoopTime: -1, poseVersion: 0, uploadedPoseVersion: -1,
    positions: new Float32Array(6), uvs: new Float32Array(6), indices: new Uint16Array([0, 1, 2]),
    scene: { game: { loop: { time: 100, rawDelta: 16 } } },
    frame: { glTexture: { webGLTexture: {} } }, afterimages: [], bodyFill: { color: 0, amount: 0 },
    heldTables: new Set(), skin: null,
    puppet: { update: vi.fn(() => new Float32Array(6)), updateSkin: vi.fn(() => skinFrame), flush: vi.fn(() => null), flushSkin: vi.fn(() => null), restVertices: [0, 0, 1, 0, 0, 1] },
  });
  const renderer = { gl, width: 1080, height: 1920, pipelines: { clear: vi.fn(), rebind: vi.fn() } };
  const camera = { addToRenderList: vi.fn(), alpha: 1 };
  return { creature, gl, renderer, camera, calculateMatrix };
}

describe("캐릭터 프레임 작업 예산", () => {
  it('폭주 24겹을 그려도 행렬 합성은 본체에서 한 번만 하고 두 uniform 배열을 재사용한다',()=>{
    const {creature:c,gl,renderer,camera,calculateMatrix}=fixture();
    c.x=12;c.y=34;c.afterimages=Array.from({length:24},(_,index)=>({dx:index,dy:2,alpha:1}));
    c.renderWebGL(renderer,c,camera);
    const base=c.transformUniform,ghost=c.afterimageUniform;
    expect(calculateMatrix).toHaveBeenCalledTimes(1);expect(gl.drawElements).toHaveBeenCalledTimes(25);
    c.renderWebGL(renderer,c,camera);
    expect(calculateMatrix).toHaveBeenCalledTimes(2);
    expect(c.transformUniform).toBe(base);expect(c.afterimageUniform).toBe(ghost);
    expect([c.x,c.y]).toEqual([12,34]);
  });
  it("숨긴 적·정지한 사망 자세는 스키닝하지 않고 재개 시 누락 시간을 따라잡지 않는다", () => {
    const { creature: c } = fixture();
    for (let frame = 0; frame < 20; frame++) {
      c.scene.game.loop.time += 16; c.visible = false; c.step(0, 16);
    }
    expect(c.puppet.update).not.toHaveBeenCalled();
    c.visible = true; c.setAnimationFrozen(true); c.scene.game.loop.time += 16; c.step(0, 16);
    expect(c.puppet.update).not.toHaveBeenCalled();
    c.setAnimationFrozen(false); c.scene.game.loop.time += 16; c.step(0, 16);
    expect(c.puppet.update).toHaveBeenCalledExactlyOnceWith(.016, { output: true });
  });
  it("버퍼 공간은 한 번 확보하고 새 자세만 전송하며 복구 시 정지 자세도 다시 올린다", () => {
    const { creature: c, gl, renderer, camera } = fixture();
    const draw = () => c.renderWebGL(renderer, c, camera);
    draw(); draw(); draw();
    expect(gl.bufferData).toHaveBeenCalledTimes(3); // position capacity + UV + indices
    expect(gl.bufferSubData).toHaveBeenCalledTimes(1);
    c.scene.game.loop.time += 16; c.step(0, 16); draw();
    expect(gl.bufferData).toHaveBeenCalledTimes(3);
    expect(gl.bufferSubData).toHaveBeenCalledTimes(2);
    c.buffersGeneration = -1; draw();
    expect(gl.bufferData).toHaveBeenCalledTimes(6);
    expect(gl.bufferSubData).toHaveBeenCalledTimes(3);
    expect(renderer.pipelines.rebind).toHaveBeenCalledTimes(5);
  });
  it("GPU 스키닝은 정점을 옮기거나 올리지 않고 관절 행렬만 올리며, 계수표 버퍼는 한 번만 만든다", () => {
    const { creature: c, gl, renderer, camera } = fixture(true);
    const draw = () => c.renderWebGL(renderer, c, camera);
    for (let frame = 0; frame < 3; frame++) { c.scene.game.loop.time += 16; c.step(0, 16); draw(); }
    expect(c.puppet.update).not.toHaveBeenCalled();
    expect(c.puppet.updateSkin).toHaveBeenCalledTimes(3);
    expect(gl.bufferSubData).not.toHaveBeenCalled();
    expect(gl.uniform4fv).toHaveBeenCalledTimes(3);
    expect(gl.uniform4fv).toHaveBeenLastCalledWith(expect.anything(), skinFrame.palette);
    expect(gl.drawElements).toHaveBeenCalledTimes(3);
  });
});
