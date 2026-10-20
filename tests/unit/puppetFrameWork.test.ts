import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import { advancePuppet, puppetElapsedMs } from "../../src/puppets/runtimeStep";

function fixture() {
  const gl: any = new Proxy({ ARRAY_BUFFER: 1, ELEMENT_ARRAY_BUFFER: 2, STATIC_DRAW: 3, DYNAMIC_DRAW: 4 }, {
    get(target: any, key) { return target[key] ??= vi.fn(() => ({})); },
  });
  const Creature = sourceClass("src/puppets/IndexedPuppetCreature.ts", "IndexedPuppetCreature", {
    Phaser: { GameObjects: { Image: class {}, GetCalcMatrix: () => ({ calc: {} }) } },
    gpuGeneration: 0, programs: new WeakMap([[gl, {}]]), watchContextRestore: () => {},
    puppetAffineUniform: () => new Float32Array(9), puppetShaderAlpha: (a: number, b: number) => a * b,
    advancePuppet, puppetElapsedMs, debugPerfEnabled: false,
  });
  const creature = Object.assign(Object.create(Creature.prototype), {
    active: true, visible: true, alpha: 1, animationFrozen: false, decorativeUpdateCredit: 0,
    decorativeUpdateFactor: 1, lastLoopTime: -1, poseVersion: 0, uploadedPoseVersion: -1,
    positions: new Float32Array(6), uvs: new Float32Array(6), indices: new Uint16Array([0, 1, 2]),
    scene: { game: { loop: { time: 100, rawDelta: 16 } } },
    frame: { glTexture: { webGLTexture: {} } }, afterimages: [], bodyFill: { color: 0, amount: 0 },
    puppet: { update: vi.fn(() => new Float32Array(6)) },
  });
  const renderer = { gl, width: 1080, height: 1920, pipelines: { clear: vi.fn(), rebind: vi.fn() } };
  const camera = { addToRenderList: vi.fn(), alpha: 1 };
  return { creature, gl, renderer, camera };
}

describe("캐릭터 프레임 작업 예산", () => {
  it("숨긴 적·정지한 사망 자세는 스키닝하지 않고 재개 시 누락 시간을 따라잡지 않는다", () => {
    const { creature: c } = fixture();
    for (let frame = 0; frame < 20; frame++) {
      c.scene.game.loop.time += 16; c.visible = false; c.step(0, 16);
    }
    expect(c.puppet.update).not.toHaveBeenCalled();
    c.visible = true; c.setAnimationFrozen(true); c.scene.game.loop.time += 16; c.step(0, 16);
    expect(c.puppet.update).not.toHaveBeenCalled();
    c.setAnimationFrozen(false); c.scene.game.loop.time += 16; c.step(0, 16);
    expect(c.puppet.update).toHaveBeenCalledExactlyOnceWith(.016);
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
});
