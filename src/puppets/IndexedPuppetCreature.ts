import Phaser from "phaser";
import type { PlayOptions, Puppet } from "puppetforge";
import { advancePuppet } from "./runtimeStep";

/** GPU 프로그램과 정적 attribute 위치는 렌더러 하나당 한 번만 만든다. */
interface SharedGpuProgram {
  program: WebGLProgram;
  position: number;
  uv: number;
  transform: WebGLUniformLocation;
  viewport: WebGLUniformLocation;
  tint: WebGLUniformLocation;
  alpha: WebGLUniformLocation;
  sampler: WebGLUniformLocation;
}

/** 개체별 GPU Buffer. 위치만 매 프레임 갱신하고 UV와 index는 내보낸 원본을 그대로 쓴다. */
interface CreatureGpuBuffers {
  position: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
}

const programs = new WeakMap<WebGLRenderingContext, SharedGpuProgram>();

const VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUv;
uniform vec4 uTransform;
uniform vec2 uViewport;
varying vec2 vUv;
void main() {
  vec2 screen = uTransform.xy + aPosition * uTransform.zw;
  vec2 clip = vec2(screen.x / uViewport.x * 2.0 - 1.0, 1.0 - screen.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec4 color = texture2D(uTexture, vUv);
  gl_FragColor = vec4(color.rgb * uTint, color.a * uAlpha);
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

/** Puppet 전용 indexed WebGL 프로그램을 만들고 uniform 위치를 검증한다. */
function createProgram(gl: WebGLRenderingContext): SharedGpuProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
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
  return {
    program,
    position: gl.getAttribLocation(program, "aPosition"),
    uv: gl.getAttribLocation(program, "aUv"),
    transform: uniform("uTransform"),
    viewport: uniform("uViewport"),
    tint: uniform("uTint"),
    alpha: uniform("uAlpha"),
    sampler: uniform("uTexture"),
  };
}

/** 같은 Puppet 이미지는 Phaser Texture Manager에 한 번만 디코딩해서 모든 개체가 공유한다. */
async function ensureTexture(scene: Phaser.Scene, puppet: Puppet): Promise<string> {
  const key = `puppetforge:indexed:${puppet.name}`;
  if (scene.textures.exists(key)) return key;
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
  private positions: Float32Array;
  private buffers?: CreatureGpuBuffers;

  private constructor(scene: Phaser.Scene, puppet: Puppet, textureKey: string) {
    super(scene, 0, 0, textureKey);
    if (!puppet.mesh) throw new Error(`Mesh가 없는 Puppet은 그릴 수 없습니다: ${puppet.name}`);
    this.puppet = puppet;
    this.indices = new Uint16Array(puppet.mesh.indices);
    this.uvs = new Float32Array(puppet.uv);
    this.positions = new Float32Array(puppet.restVertices);
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
    return this.puppet.play(name, options);
  }

  /** Phaser scene update에서 원본 해상도의 변형 정점만 계산한다. */
  private step(_time: number, delta: number): void {
    // 편집기보다 긴 프레임을 한 번에 적분하면 pinnedSoft 발 주변의 spring이 튀므로 잘게 나눈다.
    const next = advancePuppet(this.puppet, delta / 1000);
    if (next) this.positions = next;
  }

  /** 최초 렌더 때만 GPU Buffer를 만들며, UV와 index는 이후 다시 올리지 않는다. */
  private ensureBuffers(gl: WebGLRenderingContext): CreatureGpuBuffers {
    if (this.buffers) return this.buffers;
    const position = gl.createBuffer();
    const uv = gl.createBuffer();
    const index = gl.createBuffer();
    if (!position || !uv || !index) throw new Error("Puppet GPU buffer를 만들 수 없습니다.");

    gl.bindBuffer(gl.ARRAY_BUFFER, uv);
    gl.bufferData(gl.ARRAY_BUFFER, this.uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    this.buffers = { position, uv, index };
    return this.buffers;
  }

  /** Phaser batch 사이에서 원본 indexed mesh를 한 번의 GPU draw call로 그린다. */
  renderWebGL(
    renderer: Phaser.Renderer.WebGL.WebGLRenderer,
    _src: IndexedPuppetCreature,
    camera: Phaser.Cameras.Scene2D.Camera,
  ): void {
    camera.addToRenderList(this);
    renderer.pipelines.clear();

    const gl = renderer.gl;
    const shared = programs.get(gl) ?? createProgram(gl);
    programs.set(gl, shared);
    const buffers = this.ensureBuffers(gl);
    const frameTexture = this.frame.glTexture.webGLTexture;
    if (!frameTexture) {
      renderer.pipelines.rebind();
      return;
    }

    gl.useProgram(shared.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(shared.position);
    gl.vertexAttribPointer(shared.position, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
    gl.enableVertexAttribArray(shared.uv);
    gl.vertexAttribPointer(shared.uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

    const zoom = camera.zoom;
    const screenX = camera.x + (this.x - camera.scrollX) * zoom;
    const screenY = camera.y + (this.y - camera.scrollY) * zoom;
    const signedScaleX = this.scaleX * (this.flipX ? -1 : 1) * zoom;
    const scaleY = this.scaleY * (this.flipY ? -1 : 1) * zoom;
    // Puppet 정점은 이미지 좌상단 기준이므로 Image 원점(중앙)만큼 GPU 변환 전에 되돌린다.
    const centeredX = screenX - (this.width / 2) * signedScaleX;
    const centeredY = screenY - (this.height / 2) * scaleY;
    gl.uniform4f(shared.transform, centeredX, centeredY, signedScaleX, scaleY);
    gl.uniform2f(shared.viewport, renderer.width, renderer.height);
    gl.uniform3f(
      shared.tint,
      ((this.tintTopLeft >> 16) & 0xff) / 255,
      ((this.tintTopLeft >> 8) & 0xff) / 255,
      (this.tintTopLeft & 0xff) / 255,
    );
    gl.uniform1f(shared.alpha, this.alpha * camera.alpha);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(shared.sampler, 0);
    gl.drawElements(gl.TRIANGLES, this.indices.length, gl.UNSIGNED_SHORT, 0);
    renderer.pipelines.rebind();
  }

  /** scene 종료 시 update listener와 개체 전용 GPU Buffer를 함께 해제한다. */
  private release(): void {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.step, this);
    if (!this.buffers) return;
    const gl = (this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    gl.deleteBuffer(this.buffers.position);
    gl.deleteBuffer(this.buffers.uv);
    gl.deleteBuffer(this.buffers.index);
    this.buffers = undefined;
  }
}
