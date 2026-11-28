import Phaser from "phaser";
import { applySkinTable, SKIN_MAX_INFLUENCES, SKIN_PALETTE_STRIDE, type PlayOptions, type Puppet, type PuppetSkinFrame, type SkinTable } from "puppetforge";
import { advancePuppet, advancePuppetSkin, puppetElapsedMs } from "./runtimeStep";
import { drawableKey, lookupDrawableIndices } from "./drawableCells";
import { countDebugPuppetUpdate, debugPerfEnabled } from "../debug";
import { puppetAffineUniform, puppetOffsetUniform, puppetShaderAlpha } from "./renderTransform";

/** GPU 프로그램과 정적 attribute 위치는 렌더러 하나당 한 번만 만든다. */
interface SharedGpuProgram {
  program: WebGLProgram;
  position: number;
  uv: number;
  /**
   * 정점 셰이더가 스키닝을 하는가. 기기가 필요한 uniform을 못 주거나 셰이더가 실패하면 false이고,
   * 그때는 예전처럼 CPU가 정점을 옮겨 올린다(`applySkinTable`·`advancePuppet`).
   */
  skinning: boolean;
  /** 스키닝 attribute·uniform. `skinning`이 false면 쓰지 않는다. */
  skinBones: number;
  skinNormal: number;
  skinPosed: number;
  /** 스키닝 attribute 셋을 한 배열로 들고 있는다. draw마다 배열을 새로 만들지 않으려는 것이다. */
  skinLocations: readonly number[];
  palette: WebGLUniformLocation | null;
  /** Puppet 로컬 픽셀을 카메라가 투영한 화면 픽셀로 옮기는 완전한 2D affine 행렬이다. */
  transform: WebGLUniformLocation;
  viewport: WebGLUniformLocation;
  tint: WebGLUniformLocation;
  fill: WebGLUniformLocation;
  alpha: WebGLUniformLocation;
  sampler: WebGLUniformLocation;
}

/** 묶음의 바뀌지 않는 격자(기준 정점·UV·index). 같은 내용이면 개체끼리 한 벌을 나눠 쓴다. */
interface MeshData {
  rest: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

/**
 * 격자의 GPU 버퍼. 같은 SD가 전투에 여럿 서거나(대작전 열다섯) 같은 원화가 여러 화면에 서도
 * 내용이 같은 격자는 한 벌만 올린다. 내용으로 묶으므로(`meshKey` + 전체 비교) 그림은 바뀌지 않는다.
 */
interface MeshBuffers {
  /** 나눠 쓰는 표의 키. 같은 키인데 내용이 다른 드문 경우는 `null`(제 것)로 따로 든다. */
  key: string | null;
  generation: number;
  data: MeshData;
  rest: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
  users: number;
}
const meshBuffers = new Map<string, MeshBuffers>();

const programs = new WeakMap<WebGLRenderingContext, SharedGpuProgram>();

/**
 * 정점 셰이더가 받는 관절 수의 상한. 관절 하나가 vec4 셋이라 36이면 108칸이고, 행렬·화면 크기까지
 * 더해도 WebGL1이 **모든 기기에 보장하는** 정점 uniform 128칸 안에 든다. 지금 묶음은 최대 29관절이다.
 */
export const SKIN_MAX_BONES = 36;
/** 스키닝 셰이더가 쓰는 정점 uniform 칸 수. 관절 + uTransform(mat3 = 3) + uViewport(1). */
const SKIN_UNIFORM_VECTORS = SKIN_MAX_BONES * 3 + 4;

/**
 * 이 기기에서 GPU 스키닝을 쓸 수 있는지. 첫 program을 만들 때 정해진다.
 * 정해지기 전에는 GPU 경로로 굴리고, 안 되면 그때부터 CPU 경로로 돌아간다.
 */
let gpuSkinningAvailable: boolean | undefined;

/** QA·측정용 강제 끄기. 끄면 예전과 똑같이 CPU가 정점을 옮긴다. */
let gpuSkinningDisabled = false;
export function setPuppetGpuSkinning(enabled: boolean): void {
  gpuSkinningDisabled = !enabled;
}

/**
 * 정점 계수표의 GPU 버퍼. 같은 묶음·같은 고정 방식의 개체가 모두 한 벌을 나눠 쓴다 — 전투에
 * 같은 SD가 여럿 서도 정점 계수는 한 번만 올린다. 쓰는 개체가 없어지면 지운다.
 */
interface TableBuffers {
  generation: number;
  bones: WebGLBuffer;
  normal: WebGLBuffer;
  posed: WebGLBuffer;
  users: number;
}
const tableBuffers = new Map<SkinTable, TableBuffers>();
/**
 * 컨텍스트가 복구될 때마다 오른다. 이 세대가 다른 GPU 손잡이는 이미 죽은 것이다.
 *
 * 모바일에서 앱을 백그라운드로 보냈다 돌아오면 WebGL 컨텍스트가 날아가는 것이 정상 동작이다.
 * Phaser는 제가 감싼 자원(텍스처·버퍼·프로그램)을 `RESTORE_WEBGL` 시점에 다시 만들지만,
 * 여기서 raw `gl.createProgram`·`gl.createBuffer`로 만든 것은 감싸이지 않아 손대지 않는다.
 * 게다가 **복구 뒤에도 `renderer.gl`은 같은 객체**라(`dispatchContextRestored`가 다시 대입하지
 * 않는다) 위 WeakMap이 죽은 program을 계속 돌려준다 — 그대로 두면 돌아온 화면에서 모든
 * 캐릭터가 그려지지 않는다.
 */
let gpuGeneration = 0;

/** 기본 자세에 닿은 뒤 머리카락·옷자락 흔들림이 가라앉도록 더 굴리는 시간(ms). 실제 묶음에서 1초면 흔들림이 0.2px 안쪽으로 잦아든다. `setAnimationRested` 참고. */
const REST_SETTLE_MS = 1000;

/** 렌더러 하나에 복구 구독을 한 번만 건다. 개체마다 걸면 전투 여섯이 여섯 번 듣는다. */
const contextWatched = new WeakSet<Phaser.Renderer.WebGL.WebGLRenderer>();

function watchContextRestore(renderer: Phaser.Renderer.WebGL.WebGLRenderer): void {
  if (contextWatched.has(renderer)) return;
  contextWatched.add(renderer);
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => {
    gpuGeneration += 1;
    // 같은 gl 객체에 죽은 program이 물려 있으므로 캐시를 비워 다음 draw가 다시 만들게 한다.
    programs.delete(renderer.gl);
  });
}

/** 몸 뒤에 겹쳐 그리는 한 겹. 변위는 월드 픽셀, 색은 실루엣을 채우는 한 색(기본 검정)이다. */
export interface PuppetAfterimage {
  dx: number;
  dy: number;
  alpha: number;
  color?: number;
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
uniform mat3 uTransform;
uniform vec2 uViewport;
varying vec2 vUv;
void main() {
  // 정점은 Puppet 이미지의 로컬 픽셀이며, affine 행렬은 원점 보정 뒤 부모와 카메라까지 합성한다.
  vec2 screen = (uTransform * vec3(aPosition, 1.0)).xy;
  vec2 clip = vec2(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`;

/**
 * GPU 스키닝 정점 셰이더. PuppetForge `applySkinTable`과 같은 식이다.
 *
 *   p = (1 − Σ(a + b))·v + Σ (a·N + b·M)·v
 *
 * 관절 하나는 vec4 셋 — [Ma Mb Mc Md] [Mtx Mty Na Nb] [Nc Nd Ntx Nty]. 계수가 모두 0인 정점
 * (가중치 없음·완전 고정)은 원래 자리에 남는다. CPU가 옮긴 정점을 그릴 때는 계수 attribute를
 * 0으로 꺼 두므로 같은 program이 그 정점을 그대로 그린다.
 */
const SKIN_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
attribute vec4 aSkinBones;
attribute vec4 aSkinNormal;
attribute vec4 aSkinPosed;
uniform mat3 uTransform;
uniform vec2 uViewport;
uniform vec4 uPalette[${SKIN_MAX_BONES * 3}];
varying vec2 vUv;
vec2 influence(float bone, float a, float b, vec2 v) {
  int o = int(bone + 0.5) * 3;
  vec4 m0 = uPalette[o];
  vec4 m1 = uPalette[o + 1];
  vec4 m2 = uPalette[o + 2];
  vec2 posed = vec2(m0.x * v.x + m0.z * v.y + m1.x, m0.y * v.x + m0.w * v.y + m1.y);
  vec2 normal = vec2(m1.z * v.x + m2.x * v.y + m2.z, m1.w * v.x + m2.y * v.y + m2.w);
  return b * posed + a * normal;
}
void main() {
  vec2 v = aPosition;
  float total = dot(aSkinNormal, vec4(1.0)) + dot(aSkinPosed, vec4(1.0));
  vec2 p = (1.0 - total) * v;
  if (total > 0.0) {
    p += influence(aSkinBones.x, aSkinNormal.x, aSkinPosed.x, v);
    p += influence(aSkinBones.y, aSkinNormal.y, aSkinPosed.y, v);
    p += influence(aSkinBones.z, aSkinNormal.z, aSkinPosed.z, v);
    p += influence(aSkinBones.w, aSkinNormal.w, aSkinPosed.w, v);
  }
  vec2 screen = (uTransform * vec3(p, 1.0)).xy;
  vec2 clip = vec2(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform vec4 uFill;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(uTexture, vUv);
  // uFill.a만큼 원화 대신 한 색으로 채운다(실루엣). 원화가 미리 곱해진 알파라 채움도 알파를 곱한다.
  vec3 rgb = mix(color.rgb * uTint, uFill.rgb * color.a, uFill.a);
  gl_FragColor = vec4(rgb, color.a * uAlpha);
}`;

/** 셰이더 컴파일 오류는 조용히 빈 캐릭터를 만들지 않고 부트 단계에서 원인을 드러낸다. */
function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Puppet GPU shader를 만들 수 없습니다.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "알 수 없는 shader 오류";
    gl.deleteShader(shader);
    throw new Error(`Puppet GPU shader 컴파일 실패: ${message}`);
  }
  return shader;
}

/**
 * Puppet 전용 indexed WebGL 프로그램을 만든다. 먼저 GPU 스키닝 program을 시도하고, 기기가
 * uniform 칸을 못 주거나 컴파일·연결이 실패하면 예전 program으로 되돌아간다.
 */
function createProgram(gl: WebGLRenderingContext): SharedGpuProgram {
  const limit = Number(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)) || 0;
  // 강제 끄기와 무관하게 기기가 되는지만 본다. 끈 동안 만든 program이 다시 켠 뒤에도 남으면
  // 그 세션 내내 CPU로 굳는다. 스키닝 program은 계수를 0으로 두면 CPU가 옮긴 정점도 그린다.
  if (limit >= SKIN_UNIFORM_VECTORS) {
    try {
      const program = linkProgram(gl, SKIN_VERTEX_SHADER, true);
      gpuSkinningAvailable = true;
      return program;
    } catch {
      // 드라이버가 동적 uniform 색인을 못 받는 등 드문 경우다. CPU 경로가 같은 그림을 그린다.
    }
  }
  gpuSkinningAvailable = false;
  return linkProgram(gl, VERTEX_SHADER, false);
}

function linkProgram(gl: WebGLRenderingContext, vertexSource: string, skinning: boolean): SharedGpuProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("Puppet GPU program을 만들 수 없습니다.");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "알 수 없는 link 오류";
    gl.deleteProgram(program);
    throw new Error(`Puppet GPU program 연결 실패: ${message}`);
  }

  const uniform = (name: string): WebGLUniformLocation => {
    const location = gl.getUniformLocation(program, name);
    if (location === null) throw new Error(`Puppet GPU uniform을 찾을 수 없습니다: ${name}`);
    return location;
  };
  const skinBones = skinning ? gl.getAttribLocation(program, "aSkinBones") : -1;
  const skinNormal = skinning ? gl.getAttribLocation(program, "aSkinNormal") : -1;
  const skinPosed = skinning ? gl.getAttribLocation(program, "aSkinPosed") : -1;
  return {
    program,
    position: gl.getAttribLocation(program, "aPosition"),
    uv: gl.getAttribLocation(program, "aUv"),
    skinning,
    skinBones,
    skinNormal,
    skinPosed,
    skinLocations: skinning ? [skinBones, skinNormal, skinPosed] : [],
    palette: skinning ? uniform("uPalette[0]") : null,
    transform: uniform("uTransform"),
    viewport: uniform("uViewport"),
    tint: uniform("uTint"),
    fill: uniform("uFill"),
    alpha: uniform("uAlpha"),
    sampler: uniform("uTexture"),
  };
}

/**
 * 일꾼이 이미 디코드해 보낸 원화. 아직 Phaser에 올리지 않은 것만 잠깐 들고 있는다.
 *
 * 올리고 나면 곧바로 지운다 — Texture Manager가 같은 그림을 붙잡으므로 여기 남겨 두면
 * 한 장에 6MB 남짓한 픽셀을 두 곳이 세는 셈이 된다.
 */
const decodedTextures = new Map<string, ImageBitmap>();

/** 일꾼이 해석한 묶음의 원화를 등록한다. 실제 업로드는 씬이 생길 때 `ensureTexture`가 한다. */
export function registerDecodedTexture(name: string, bitmap: ImageBitmap): void {
  if (!decodedTextures.has(name)) decodedTextures.set(name, bitmap);
}

/** 같은 Puppet 이미지는 Phaser Texture Manager에 한 번만 디코딩해서 모든 개체가 공유한다. */
export async function ensureTexture(scene: Phaser.Scene, puppet: Puppet): Promise<string> {
  const key = `puppetforge:indexed:${puppet.name}`;
  if (scene.textures.exists(key)) return key;

  // 일꾼이 이미 픽셀로 풀어 둔 그림은 디코드를 건너뛰고 그대로 올린다. 확인과 등록 사이에
  // `await`가 없어야 같은 묶음을 동시에 여는 두 카드가 서로의 그림을 가로채지 않는다.
  const decoded = decodedTextures.get(puppet.name);
  if (decoded) {
    decodedTextures.delete(puppet.name);
    // Phaser의 TextureSource는 `texImage2D`가 받는 원본이면 무엇이든 그대로 올린다.
    scene.textures.addImage(key, decoded as unknown as HTMLImageElement);
    return key;
  }
  if (!puppet.texture) throw new Error(`Puppet 묶음에 이미지가 없습니다: ${puppet.name}`);

  // Blob 타입은 SharedArrayBuffer 가능성을 받지 않으므로 독립 ArrayBuffer 복사본으로 넘긴다.
  const textureBytes = Uint8Array.from(puppet.texture.data).buffer;
  const blob = new Blob([textureBytes], { type: puppet.texture.type });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error(`Puppet 이미지를 읽을 수 없습니다: ${puppet.name}`));
      next.src = url;
    });
    if (!scene.textures.exists(key)) scene.textures.addImage(key, image);
  } finally {
    URL.revokeObjectURL(url);
  }
  return key;
}

/**
 * PuppetForge가 계산한 원본 정점 배열을 GPU indexed draw로 바로 그리는 Phaser GameObject다.
 * Phaser Mesh처럼 삼각형마다 정점을 복제하지 않아 격자 수와 fixed/pinnedSoft 가중치를 훼손하지 않는다.
 */
export class IndexedPuppetCreature extends Phaser.GameObjects.Image {
  private readonly puppet: Puppet;
  private readonly indices: Uint16Array;
  private readonly uvs: Float32Array;
  /** 기준 정점·UV·index와 그 내용 키. GPU 격자 버퍼를 나눠 쓸 때 쓴다. */
  private readonly meshData: MeshData;
  private readonly meshKey: string;
  private positions: Float32Array;
  /**
   * GPU 스키닝 자세. 있으면 정점 대신 관절 행렬(palette)을 올리고 정점 셰이더가 `table`로 옮긴다.
   * null이면 `positions`(CPU가 옮긴 정점)를 그린다 — 처음 서는 순간, 블렌드 도중 고정 방식이
   * 바뀌는 짧은 구간, GPU 스키닝을 못 쓰는 기기.
   */
  private skin: { table: SkinTable; palette: Float32Array } | null = null;
  /** 이 개체가 붙잡은 계수표 버퍼. 놓을 때 쓰는 개체 수를 줄인다. */
  private heldTables = new Set<SkinTable>();
  /** GPU 스키닝을 못 쓰는 기기에서 행렬 자세를 정점으로 풀어 둘 자리. */
  private cpuPositions?: Float32Array;
  /** 붙잡은 격자 버퍼(나눠 쓰는 것). 놓을 때 쓰는 개체 수를 줄인다. */
  private buffers?: MeshBuffers;
  /**
   * CPU가 옮긴 정점을 올리는 개체 전용 버퍼. **CPU 경로에서만** 만든다 — GPU 스키닝 기기에서는
   * 한 번도 쓰지 않는 정점 크기의 버퍼를 개체마다 들고 있을 이유가 없다.
   */
  private positionBuffer?: WebGLBuffer;
  /** 지금 들고 있는 위치 버퍼를 만든 컨텍스트 세대. 다르면 죽은 손잡이라 지우지도 쓰지도 않는다. */
  private positionGeneration = -1;
  private poseVersion = 0;
  private uploadedPoseVersion = -1;
  /** 직전 갱신 때의 TimeStep 벽시계. 프레임 제한이 켜져도 실제 경과 시간을 잴 수 있게 한다. */
  private lastLoopTime = -1;
  /** 1보다 작은 값은 비전투 장식의 프레임 일부를 버리며 누락 시간을 다음 프레임에 합치지 않는다. */
  private decorativeUpdateFactor = 1;
  private decorativeUpdateCredit = 0;
  /** 절전이 건너뛴 프레임의 시간. 다음에 도는 프레임이 함께 적분해 idle이 느려지지 않게 한다. */
  private decorativeCarryMs = 0;
  /**
   * 지금 몸 뒤에 함께 그릴 잔상 겹.
   *
   * **같은 정점을 자리만 옮겨 다시 그린다.** 개체를 하나 더 세우면 ZIP·재생기·버퍼가 통째로
   * 늘고 `spawnPuppet`은 비동기라 0.1초짜리 돌진이 끝난 뒤에야 도착한다. 여기서는 이미 바인딩한
   * program과 버퍼를 그대로 두고 행렬·색·알파만 갈아 끼우므로 겹 하나가 draw 한 번이다.
   */
  private afterimages: readonly PuppetAfterimage[] = [];
  private transformUniform?: Float32Array<ArrayBuffer>;
  private afterimageUniform?: Float32Array<ArrayBuffer>;
  /** 몸 위에 얇게 얹는 한 색. 폭주의 붉은 기운처럼 원화를 그대로 두고 색만 한 겹 덮는다. */
  private bodyFill: { color: number; amount: number } = { color: 0, amount: 0 };
  /**
   * 동작을 그 자리에서 멈춘다. 멈춘 동안의 시간은 버린다 — 풀면 멈춘 프레임에서 그대로 이어지고
   * 지나간 만큼을 한꺼번에 따라잡지 않는다(따라잡으면 풀리는 순간 자세가 툭 튄다).
   */
  private animationFrozen = false;
  /**
   * 기본 자세로 가라앉는 정도(1 = 동작 그대로, 0 = 원화 기본 자세). `setAnimationRested` 참고.
   * 지금 동작의 움직임 크기(`playStrength`)에 이 값을 곱해 재생기에 넘긴다.
   */
  private restLevel = 1;
  private restTarget = 1;
  private restMs = 0;
  /** 기본 자세에 닿은 뒤 흔들림(secondary)이 가라앉도록 더 굴리는 시간. 다 지나면 멈춘다. */
  private restHoldMs = 0;
  private restSettled = false;
  /** 지금 재생 중인 동작의 원래 움직임 크기. 쉬는 동안 줄였다가 이 값으로 되돌린다. */
  private playStrength = 1;
  /**
   * 자세를 빌려 오는 개체. 있으면 제 재생기를 굴리지 않고 그 개체가 계산한 정점을 그대로 쓴다.
   *
   * 같은 묶음·같은 동작을 같은 순간에 시작한 개체들은 어차피 **매 프레임 같은 정점**을 만든다 —
   * 대작전 미리보기의 열다섯은 다섯 자매가 셋씩 되풀이되는데, 한 몸에 정점이 1만 6천 개라 열다섯이
   * 저마다 스키닝하면 그것만으로 한 프레임을 넘겼다. 정점은 Puppet 로컬 좌표라 자리·크기·뒤집기는
   * 그릴 때의 행렬이 맡고, 빌려 와도 그림은 바뀌지 않는다.
   */
  private poseLeader?: IndexedPuppetCreature;
  private mirroredLeaderVersion = -1;

  private constructor(scene: Phaser.Scene, puppet: Puppet, textureKey: string) {
    super(scene, 0, 0, textureKey);
    if (!puppet.mesh) throw new Error(`Mesh가 없는 Puppet은 그릴 수 없습니다: ${puppet.name}`);
    this.puppet = puppet;
    // 투명 셀의 삼각형은 그리지 않는다(PuppetForge v0.42.0 런타임과 같은 판정, `drawableCells.ts`).
    // 정점·UV 배열은 그대로라 변형과 가중치는 바뀌지 않는다. 일꾼이 고르지 못했으면 전체 격자다.
    const mesh = puppet.mesh;
    const drawable = lookupDrawableIndices(drawableKey(puppet.name, puppet.project.character.texture, mesh.cols, mesh.rows));
    this.indices = drawable ?? new Uint16Array(mesh.indices);
    // 그리지 않는 정점은 매 프레임 변형 계산도 건너뛴다(PuppetForge v0.43.0). 그 정점의 좌표를 읽는
    // 곳은 이 렌더러뿐이고(잔상·폭주 테두리도 같은 인덱스로 다시 그린다), 그리는 정점의 값은 같다.
    // 변형된 정점 좌표를 다른 용도(판정·경계·굽기)로 읽게 되면 이 줄을 먼저 다시 본다.
    if (drawable) puppet.setDrawIndices(drawable);
    this.uvs = new Float32Array(puppet.uv);
    this.positions = new Float32Array(puppet.restVertices);
    this.meshData = { rest: new Float32Array(puppet.restVertices), uvs: this.uvs, indices: this.indices };
    this.meshKey = meshKey(this.meshData);
    this.setOrigin(0.5);
    scene.add.existing(this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.step, this);
    this.once(Phaser.GameObjects.Events.DESTROY, this.release, this);
  }

  /** 텍스처를 준비한 뒤 독립 재생기를 가진 indexed 개체를 씬에 추가한다. */
  static async fromPuppet(scene: Phaser.Scene, puppet: Puppet): Promise<IndexedPuppetCreature> {
    return new IndexedPuppetCreature(scene, puppet, await ensureTexture(scene, puppet));
  }

  /** 모션·고정 방식·속도 등 내보내기 설정을 가진 runtime-core 공개 진입점이다. */
  get core(): Puppet {
    return this.puppet;
  }

  get playing(): string | null {
    return this.puppet.playing;
  }

  play(name: string, options?: PlayOptions): boolean {
    const strength = options?.strength ?? this.puppet.project.animations[name]?.strength ?? 1;
    const played = this.puppet.play(name, this.restLevel < 1 ? { ...options, strength: strength * this.restLevel } : options);
    if (played) this.playStrength = strength;
    return played;
  }

  /**
   * 몸 뒤에 겹칠 잔상을 정한다. 빈 목록이면 지운다.
   *
   * 변위는 **월드 픽셀**이라 카메라·부모 변환을 화면이 다시 계산하지 않는다 — 그릴 때 좌표만
   * 잠깐 옮겨 같은 경로로 행렬을 만들기 때문이다.
   */
  setAfterimages(steps: readonly PuppetAfterimage[]): this {
    this.afterimages = steps;
    return this;
  }

  /** 몸 위에 한 색을 `amount`(0~1)만큼 덮는다. 0이면 원화 그대로다. */
  setBodyFill(color: number, amount: number): this {
    this.bodyFill = { color, amount: Phaser.Math.Clamp(amount, 0, 1) };
    return this;
  }

  /**
   * 동작 재생을 잠깐 멈추거나 다시 잇는다.
   *
   * 대사 화면의 몸짓(통통 뛰기·흔들기)은 몸 전체를 옮기는 연출이라, 그 사이에도 idle이 흐르면
   * 몸이 뛰는 동안 팔다리가 따로 흔들려 한 동작으로 읽히지 않는다. 몸짓 동안만 멈췄다가 끝나면
   * 멈춘 자리에서 이어 간다.
   */
  setAnimationFrozen(frozen: boolean): this {
    this.animationFrozen = frozen;
    return this;
  }

  /**
   * 동작을 원화의 기본 자세로 가라앉힌 뒤 멈추거나, 그 자리에서 다시 살려 낸다.
   *
   * `setAnimationFrozen`은 그 프레임 그대로 굳혀서, idle이 눈을 감는 순간에 멈추면 눈을 반쯤 감은 채로
   * 서 있었다(대사 화면에서 말하지 않는 사람 — 응태 2026-11-28). 이것은 움직임 크기를 `durationMs`에 걸쳐
   * 0까지 줄여 기본 자세(눈 뜬 원화)로 돌아간 뒤 흔들림이 가라앉으면 멈춘다. 풀면 멈춘 시각에서
   * 움직임 크기만 다시 차오르므로 자세가 튀지 않는다. `durationMs`가 0이면 곧바로 바꾼다.
   */
  setAnimationRested(rested: boolean, durationMs = 220): this {
    const target = rested ? 0 : 1;
    if (target === this.restTarget && durationMs > 0) return this;
    this.restTarget = target;
    this.restMs = Math.max(0, durationMs);
    this.restSettled = false;
    this.restHoldMs = rested ? REST_SETTLE_MS : 0;
    if (this.restMs <= 0) {
      this.restLevel = target;
      this.puppet.setStrength(this.playStrength * target);
    }
    return this;
  }

  /**
   * `leader`의 자세를 빌려 그린다(`undefined`면 다시 제 재생기를 굴린다). 같은 묶음이어야 하고,
   * 같은 동작을 같은 순간에 시작한 개체끼리만 묶는다 — 그래야 빌려도 원래 그렸을 그림과 같다.
   * 이끄는 개체가 사라지면 제 재생기로 돌아간다.
   */
  followPose(leader: IndexedPuppetCreature | undefined): this {
    if (leader === this) leader = undefined;
    if (leader && leader.puppet.name !== this.puppet.name) throw new Error(`다른 묶음의 자세는 빌릴 수 없습니다: ${leader.puppet.name} → ${this.puppet.name}`);
    this.poseLeader = leader;
    this.mirroredLeaderVersion = -1;
    return this;
  }

  /** 장식 갱신 예산. 전장 밖 Puppet은 `spawnPuppet`이 절전 정책으로 기본값을 건다(전투는 1). */
  setDecorativeUpdateFactor(factor: number): this {
    this.decorativeUpdateFactor = Phaser.Math.Clamp(factor, 0, 1);
    this.decorativeUpdateCredit = 0;
    return this;
  }

  /** Phaser scene update에서 원본 해상도의 변형 정점만 계산한다. */
  private step(_time: number, delta: number): void {
    // Scene UPDATE는 listener 목록을 순회하는 도중에도 씬 전환으로 개체를 파괴할 수 있다.
    // 이미 순회 목록에 담긴 콜백은 release()로 구독을 해제한 뒤 한 번 더 호출될 수 있으므로,
    // Phaser가 scene 참조를 비운 파괴 완료 개체는 game loop를 읽기 전에 즉시 건너뛴다.
    if (!this.active || !this.scene) return;
    // 어느 값이 실제 경과 시간인지는 프레임 제한 여부에 따라 달라진다(runtimeStep.ts 참고).
    // TimeStep.time은 rawDelta를 계속 더한 벽시계라 두 경우 모두에서 갱신 간격을 바로 준다.
    // **버리는 프레임에서도 먼저 갱신한다** — 아래 조기 반환(비가시성·정지)이 버린 시간은 그대로 잃어야
    // 하고("따라잡지 않는다"가 계약이다. 절전이 건너뛴 시간만 `decorativeCarryMs`로 넘긴다), 여기서 갱신하지 않으면
    // 다음에 도는 프레임이 그 시간까지 한꺼번에 삼켜 오히려 건너뛴 만큼을 되돌린다.
    const loop = this.scene.game.loop;
    const loopElapsed = this.lastLoopTime >= 0 ? loop.time - this.lastLoopTime : undefined;
    this.lastLoopTime = loop.time;
    // 브라우저 비가시성은 저장된 절전과 별도 정지이며 hidden delta를 임의 애니메이션으로 따라잡지 않는다.
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    // 멈춘 동안은 시간만 흘려보낸다. 위에서 벽시계를 먼저 갱신했으므로 풀린 뒤 따라잡지 않는다.
    if (this.animationFrozen || this.restSettled || !this.visible || this.alpha <= 0) return;
    const leader = this.poseLeader;
    if (leader) {
      if (leader.active) {
        // 이끄는 개체가 새 자세를 계산했을 때만 넘겨받는다 — 올리기(bufferSubData)도 그때만 돈다.
        if (leader.poseVersion !== this.mirroredLeaderVersion) {
          this.mirroredLeaderVersion = leader.poseVersion;
          this.positions = leader.positions;
          this.skin = leader.skin;
          this.poseVersion += 1;
        }
        return;
      }
      this.poseLeader = undefined;
    }
    const frameElapsed = puppetElapsedMs(loop.rawDelta, delta, loopElapsed);
    // 절전은 **갱신 횟수**를 줄이지 동작 속도를 늦추지 않는다. 건너뛴 프레임의 시간을 버리던 때는
    // 절전을 켜면 idle이 절반 속도의 슬로 모션이 되었다. 비가시성·정지와 달리 이 시간은 다음 갱신이 함께 적분한다.
    this.decorativeUpdateCredit += this.decorativeUpdateFactor;
    if (this.decorativeUpdateCredit < 1) { this.decorativeCarryMs = Math.min(this.decorativeCarryMs + frameElapsed, 250); return; }
    this.decorativeUpdateCredit -= 1;
    const elapsed = frameElapsed + this.decorativeCarryMs;
    this.decorativeCarryMs = 0;
    this.stepRest(elapsed);
    // 편집기보다 긴 프레임을 한 번에 적분하면 pinnedSoft 발 주변의 spring이 튀므로 잘게 나눈다.
    const started = debugPerfEnabled ? performance.now() : 0;
    // GPU 스키닝을 쓸 수 있으면 관절 행렬만 굴린다. 못 쓰는 기기로 판명되면 예전처럼 정점을 옮긴다.
    if (gpuSkinningAvailable !== false && !gpuSkinningDisabled) {
      const frame = advancePuppetSkin(this.puppet, elapsed / 1000);
      if (frame) this.acceptSkinFrame(frame);
    } else {
      const next = advancePuppet(this.puppet, elapsed / 1000);
      if (next) { this.positions = next; this.skin = null; this.poseVersion += 1; }
    }
    if (debugPerfEnabled) countDebugPuppetUpdate(performance.now() - started);
  }

  /** 기본 자세로 가라앉거나 다시 살아나는 움직임 크기를 이번 프레임만큼 옮긴다. 다 가라앉으면 멈춘다. */
  private stepRest(elapsedMs: number): void {
    if (this.restLevel !== this.restTarget) {
      const step = this.restMs > 0 ? elapsedMs / this.restMs : 1;
      this.restLevel = this.restTarget > this.restLevel
        ? Math.min(this.restTarget, this.restLevel + step)
        : Math.max(this.restTarget, this.restLevel - step);
      this.puppet.setStrength(this.playStrength * this.restLevel);
      return;
    }
    if (this.restTarget !== 0) return;
    // 이번 프레임은 그대로 그리고, 흔들림이 가라앉을 시간이 다 지났으면 다음 프레임부터 멈춘다.
    this.restHoldMs -= elapsedMs;
    if (this.restHoldMs <= 0) this.restSettled = true;
  }

  private acceptSkinFrame(frame: PuppetSkinFrame): void {
    if (frame.mode === "palette") {
      this.skin = { table: frame.table, palette: frame.palette };
    } else {
      this.skin = null;
      this.positions = frame.vertices;
    }
    this.poseVersion += 1;
  }

  /** 계수표 버퍼를 붙잡는다. 없으면 만들고, 컨텍스트가 바뀐 뒤라면 다시 만든다. */
  private holdTable(gl: WebGLRenderingContext, table: SkinTable): TableBuffers {
    let held = tableBuffers.get(table);
    if (held && held.generation !== gpuGeneration) {
      // 죽은 컨텍스트의 손잡이는 지우지 않고 버린다. 쓰는 개체 수는 그대로 이어 간다.
      held = { ...createTableBuffers(gl, table), users: held.users };
      tableBuffers.set(table, held);
    }
    if (!held) {
      held = { ...createTableBuffers(gl, table), users: 0 };
      tableBuffers.set(table, held);
    }
    if (!this.heldTables.has(table)) {
      this.heldTables.add(table);
      held.users += 1;
    }
    return held;
  }

  /**
   * 최초 렌더 때만 격자 버퍼를 붙잡는다. 같은 내용의 격자를 다른 개체가 이미 올렸으면 그것을 쓰고,
   * UV와 index는 이후 다시 올리지 않는다.
   */
  private ensureBuffers(gl: WebGLRenderingContext): MeshBuffers {
    const held = this.buffers;
    if (held && held.generation === gpuGeneration) return held;
    if (held) {
      // 컨텍스트가 죽었다 살아난 뒤다. 예전 손잡이는 **다른 컨텍스트의 것**이라 새 컨텍스트에
      // 지우라고 하면 오류가 난다. 지우지 않고 그 자리에서 다시 올린다 — 같은 항목을 나눠 쓰는
      // 다른 개체도 함께 새 손잡이를 본다. 쓰는 개체 수는 그대로 이어 간다.
      Object.assign(held, uploadMesh(gl, held.data));
      return held;
    }
    const existing = meshBuffers.get(this.meshKey);
    if (existing && sameMesh(existing.data, this.meshData)) {
      if (existing.generation !== gpuGeneration) Object.assign(existing, uploadMesh(gl, existing.data));
      existing.users += 1;
      this.buffers = existing;
      return existing;
    }
    // 같은 키인데 내용이 다르면(해시 충돌) 나눠 쓰지 않고 제 것을 든다.
    const created: MeshBuffers = { key: existing ? null : this.meshKey, data: this.meshData, users: 1, ...uploadMesh(gl, this.meshData) };
    if (created.key) meshBuffers.set(created.key, created);
    this.buffers = created;
    return created;
  }

  /** CPU 경로의 위치 버퍼. 처음 쓰일 때 만들고, 컨텍스트가 바뀌었으면 다시 만든다. */
  private ensurePositionBuffer(gl: WebGLRenderingContext): WebGLBuffer {
    if (this.positionBuffer && this.positionGeneration === gpuGeneration) return this.positionBuffer;
    const position = gl.createBuffer();
    if (!position) throw new Error("Puppet GPU buffer를 만들 수 없습니다.");
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions.byteLength, gl.DYNAMIC_DRAW);
    this.uploadedPoseVersion = -1;
    this.positionBuffer = position;
    this.positionGeneration = gpuGeneration;
    return position;
  }

  /** Phaser batch 사이에서 원본 indexed mesh를 한 번의 GPU draw call로 그린다. */
  renderWebGL(
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    _src: IndexedPuppetCreature,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix?: Phaser.GameObjects.Components.TransformMatrix,
  ): void {
    camera.addToRenderList(this);
    // Phaser의 newType/nextTypeMatch는 Image를 상속한 Puppet과 일반 Image를 구별하지 못한다.
    // 따라서 매 draw를 명시적인 batch 경계로 두어 직전 Phaser batch를 먼저 flush한다.
    renderer.pipelines.clear();
    try {
      const gl = renderer.gl;
      // 복구 신호를 듣지 않으면 컨텍스트가 돌아온 뒤 죽은 program으로 계속 그린다.
      watchContextRestore(renderer);
      const shared = programs.get(gl) ?? createProgram(gl);
      programs.set(gl, shared);
      const buffers = this.ensureBuffers(gl);
      const frameTexture = this.frame.glTexture.webGLTexture;
      // 콘텍스 복구 직후에는 Phaser frame이 아직 GL texture를 못 가질 수 있다.
      if (!frameTexture) return;

      gl.useProgram(shared.program);
      const skin = this.skin;
      const gpuSkin = skin !== null && shared.skinning && skin.palette.length <= SKIN_MAX_BONES * SKIN_PALETTE_STRIDE;
      if (gpuSkin) {
        // 정점은 기준 자세 그대로 두고 관절 행렬만 올린다. 정점 계수는 묶음끼리 나눠 쓰는 정적 버퍼다.
        const table = this.holdTable(gl, skin.table);
        gl.uniform4fv(shared.palette, skin.palette);
        bindAttribute(gl, shared.position, buffers.rest, 2);
        bindAttribute(gl, shared.skinBones, table.bones, SKIN_MAX_INFLUENCES);
        bindAttribute(gl, shared.skinNormal, table.normal, SKIN_MAX_INFLUENCES);
        bindAttribute(gl, shared.skinPosed, table.posed, SKIN_MAX_INFLUENCES);
      } else {
        if (skin) {
          // GPU 스키닝을 못 쓰는 기기에서 행렬로 받은 자세 — 셰이더와 같은 식으로 CPU가 정점을 푼다.
          // 자세가 바뀌었을 때만 푼다(같은 자세를 여러 카메라가 그리는 경우).
          if (this.uploadedPoseVersion !== this.poseVersion) {
            this.positions = applySkinTable(this.puppet.restVertices, skin.table, skin.palette, this.cpuPositions ??= new Float32Array(this.positions.length));
          }
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.ensurePositionBuffer(gl));
        // 같은 자세를 여러 카메라가 그리거나 정지했을 때는 GPU 전송을 반복하지 않는다.
        if (this.uploadedPoseVersion !== this.poseVersion) {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions);
          this.uploadedPoseVersion = this.poseVersion;
        }
        gl.enableVertexAttribArray(shared.position);
        gl.vertexAttribPointer(shared.position, 2, gl.FLOAT, false, 0, 0);
        if (shared.skinning) {
          // 계수를 0으로 두면 같은 program이 올린 정점을 그대로 그린다.
          for (const location of shared.skinLocations) {
            if (location < 0) continue;
            gl.disableVertexAttribArray(location);
            gl.vertexAttrib4f(location, 0, 0, 0, 0);
          }
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
      gl.enableVertexAttribArray(shared.uv);
      gl.vertexAttribPointer(shared.uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

      // GetCalcMatrix가 개체 로컬 → 부모 Container → Camera 순으로 이동·배율·회전을 합성한다.
      // Puppet 정점은 이미지 좌상단 픽셀이므로 displayOrigin을 로컬에서 먼저 빼고, flip도 원점
      // 둘레의 로컬 반전으로 행렬에 포함한다. vec4 이동/축 배율로는 부모 회전과 shear를 보존할 수 없다.
      gl.uniform2f(shared.viewport, renderer.width, renderer.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, frameTexture);
      gl.uniform1i(shared.sampler, 0);

      /*
       * **잔상을 먼저, 먼 것부터 그린다.** 몸을 먼저 그리면 반투명 겹이 그 위에 얹혀 진짜 몸이
       * 흐려지고, 지나온 길이 아니라 몸에 묻은 얼룩으로 읽힌다.
       *
       * 변위는 부모·카메라의 축으로 옮겨 확대·회전된 화면에서도 본체에 붙인다.
       * 색은 기본이 검정이다 — 개체 색으로 채우면 잔상이 아니라 발광이 된다. 폭주 테두리처럼
       * 몸 둘레로 비껴 세우는 겹만 `color`로 제 색을 갖는다.
       */
      // 본체 행렬은 한 번만 합성한다. camera는 부모 Container까지 합성한 공간이므로
      // 잔상 변위만 그 축으로 옮기면 각 겹에서 x/y를 바꿔 재합성한 결과와 같다.
      const matrices = Phaser.GameObjects.GetCalcMatrix(this, camera, parentMatrix);
      const transform = puppetAffineUniform(matrices.calc, this.displayOriginX, this.displayOriginY, this.flipX, this.flipY, this.transformUniform ??= new Float32Array(9));
      for (const ghost of this.afterimages) {
        gl.uniformMatrix3fv(shared.transform, false, puppetOffsetUniform(transform, matrices.camera, ghost.dx, ghost.dy, this.afterimageUniform ??= new Float32Array(9)));
        gl.uniform3f(shared.tint, 1, 1, 1);
        const ghostColor = ghost.color ?? 0;
        gl.uniform4f(shared.fill, ((ghostColor >> 16) & 0xff) / 255, ((ghostColor >> 8) & 0xff) / 255, (ghostColor & 0xff) / 255, 1);
        gl.uniform1f(shared.alpha, puppetShaderAlpha(this.alpha * ghost.alpha, camera.alpha));
        gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
      }

      // GetCalcMatrix가 개체 로컬 → 부모 Container → Camera 순으로 이동·배율·회전을 합성한다.
      // Puppet 정점은 이미지 좌상단 픽셀이므로 displayOrigin을 로컬에서 먼저 빼고, flip도 원점
      // 둘레의 로컬 반전으로 행렬에 포함한다. vec4 이동/축 배율로는 부모 회전과 shear를 보존할 수 없다.
      gl.uniformMatrix3fv(shared.transform, false, transform);
      gl.uniform3f(
        shared.tint,
        ((this.tintTopLeft >> 16) & 0xff) / 255,
        ((this.tintTopLeft >> 8) & 0xff) / 255,
        (this.tintTopLeft & 0xff) / 255,
      );
      const fill = this.bodyFill;
      gl.uniform4f(shared.fill, ((fill.color >> 16) & 0xff) / 255, ((fill.color >> 8) & 0xff) / 255, (fill.color & 0xff) / 255, fill.amount);
      // Container renderer가 호출 직전에 누적 부모 alpha를 this.alpha에 곱하므로 카메라 alpha만 마저 합친다.
      gl.uniform1f(shared.alpha, puppetShaderAlpha(this.alpha, camera.alpha));
      gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
      if (gpuSkin) {
        // Phaser의 다음 batch가 남은 attribute 배열을 제 것으로 오해하지 않게 스키닝 배열은 꺼 둔다.
        for (const location of shared.skinLocations) {
          if (location >= 0) gl.disableVertexAttribArray(location);
        }
      }
    } finally {
      // texture 누락·shader/buffer 오류를 포함한 모든 종료 경로에서 Phaser의 program과
      // vertex state를 복원해, 뒤따르는 Image·Graphics·Text가 Puppet shader로 그려지지 않게 한다.
      renderer.pipelines.rebind();
    }
  }

  /** 붙잡은 계수표 버퍼를 놓는다. 마지막 개체가 놓으면 지운다(죽은 컨텍스트의 것이면 버리기만 한다). */
  private releaseTables(): void {
    const gl = (this.scene?.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined)?.gl;
    for (const table of this.heldTables) {
      const held = tableBuffers.get(table);
      if (!held) continue;
      held.users -= 1;
      if (held.users > 0) continue;
      tableBuffers.delete(table);
      if (gl && held.generation === gpuGeneration) {
        gl.deleteBuffer(held.bones);
        gl.deleteBuffer(held.normal);
        gl.deleteBuffer(held.posed);
      }
    }
    this.heldTables.clear();
  }

  /** scene 종료 시 update listener와 GPU Buffer를 함께 해제한다. 나눠 쓰는 격자는 마지막 개체가 지운다. */
  private release(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.step, this);
    this.releaseTables();
    const gl = (this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined)?.gl;
    // 컨텍스트가 바뀐 뒤라면 손잡이는 죽은 컨텍스트의 것이다. 새 컨텍스트에 지우라고 하면
    // INVALID_OPERATION이므로 참조만 버린다 — 죽은 컨텍스트의 자원은 브라우저가 회수한다.
    if (this.positionBuffer && gl && this.positionGeneration === gpuGeneration) gl.deleteBuffer(this.positionBuffer);
    this.positionBuffer = undefined;
    const held = this.buffers;
    this.buffers = undefined;
    if (!held) return;
    held.users -= 1;
    if (held.users > 0) return;
    if (held.key && meshBuffers.get(held.key) === held) meshBuffers.delete(held.key);
    if (gl && held.generation === gpuGeneration) {
      gl.deleteBuffer(held.rest);
      gl.deleteBuffer(held.uv);
      gl.deleteBuffer(held.index);
    }
  }
}

/** 한 attribute를 정적 버퍼에 묶는다. */
function bindAttribute(gl: WebGLRenderingContext, location: number, buffer: WebGLBuffer, size: number): void {
  if (location < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

/** 계수표를 정적 버퍼로 올린다. 고정 방식이 같은 동안 다시 올리지 않는다. */
function createTableBuffers(gl: WebGLRenderingContext, table: SkinTable): Omit<TableBuffers, "users"> {
  return {
    generation: gpuGeneration,
    bones: uploadStatic(gl, gl.ARRAY_BUFFER, table.bones),
    normal: uploadStatic(gl, gl.ARRAY_BUFFER, table.normal),
    posed: uploadStatic(gl, gl.ARRAY_BUFFER, table.posed),
  };
}

/** 격자(기준 정점·UV·index)를 정적 버퍼로 올린다. */
function uploadMesh(gl: WebGLRenderingContext, data: MeshData): Pick<MeshBuffers, "generation" | "rest" | "uv" | "index"> {
  return {
    generation: gpuGeneration,
    rest: uploadStatic(gl, gl.ARRAY_BUFFER, data.rest),
    uv: uploadStatic(gl, gl.ARRAY_BUFFER, data.uvs),
    index: uploadStatic(gl, gl.ELEMENT_ARRAY_BUFFER, data.indices),
  };
}

function uploadStatic(gl: WebGLRenderingContext, target: number, data: ArrayBufferView): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Puppet GPU buffer를 만들 수 없습니다.");
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

/** 격자 내용의 키. 길이와 바이트 해시(FNV-1a)다 — 같은 키여도 `sameMesh`가 한 번 더 본다. */
export function meshKey(data: MeshData): string {
  // 바이트가 아니라 낱말(4바이트·index는 2바이트) 단위로 섞는다 — 개체를 세울 때 한 번이지만 정점이 1만 6천 개다.
  let hash = 0x811c9dc5;
  for (const view of [data.rest, data.uvs]) {
    const words = new Uint32Array(view.buffer, view.byteOffset, view.length);
    for (let i = 0; i < words.length; i++) hash = Math.imul(hash ^ words[i], 0x01000193);
  }
  for (let i = 0; i < data.indices.length; i++) hash = Math.imul(hash ^ data.indices[i], 0x01000193);
  return `${data.rest.length}:${data.uvs.length}:${data.indices.length}:${(hash >>> 0).toString(36)}`;
}

/** 두 격자의 내용이 한 글자도 다르지 않은가. 나눠 쓰기 직전에 한 번만 본다. */
export function sameMesh(a: MeshData, b: MeshData): boolean {
  return sameArray(a.rest, b.rest) && sameArray(a.uvs, b.uvs) && sameArray(a.indices, b.indices);
}

function sameArray(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
