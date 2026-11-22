import Phaser from "phaser";
import { LAB_AURORA, LAB_AURORA_PALETTE, labAuroraDue, labAuroraPlan, type LabAuroraTone } from "../core/labAurora";
import { session } from "../state/session";

/**
 * 연구소 모집 원화 위의 오로라 일렁임(값은 `core/labAurora.ts`).
 *
 * 셰이더는 **표시 목록에 넣지 않는다.** Phaser의 Shader는 텍스처로 그리게 하면 보이든 말든 매 프레임 그리므로,
 * 표시 목록 밖에 세워 두고 이 층이 정한 박자(`hz`)에만 손으로 한 번씩 그린다. 화면에는 그 작은 텍스처를
 * 늘린 이미지 한 장만 선다 — 화면 크기의 셰이더를 돌리지 않는다.
 *
 * WebGL이 없거나 셰이더를 세우지 못하면 아무것도 세우지 않는다(원화만 선다). 컨텍스트 복구는 Phaser의 Shader가
 * 제 program·framebuffer를 스스로 되살린다.
 */
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uIntensity;
uniform float uSparkle;
varying vec2 fragCoord;

// sin을 쓰지 않는 해시 — 모바일 mediump에서도 무늬가 깨지지 않는다.
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 위에서 드리우는 커튼 한 줄: 윗변은 또렷하고 아래로 길게 바랜다. 세로 결(rays)이 흔들린다.
float curtain(vec2 uv, float base, float amp, float freq, float speed, float phase, float t) {
  float x = uv.x;
  float line = base + amp * sin(x * freq + t * speed + phase) + amp * 0.45 * sin(x * freq * 2.3 - t * speed * 1.6 + phase * 1.7);
  float d = uv.y - line;
  float above = smoothstep(0.025, 0.0, d);
  float tail = exp(-max(-d, 0.0) * 7.0);
  float rays = 0.5 + 0.5 * sin(x * 42.0 + sin(x * 5.0 + t * 0.55 + phase) * 4.0 + t * 0.3);
  rays = rays * sqrt(rays);
  float edge = exp(-d * d * 1400.0);
  return tail * above * (0.2 + 0.8 * rays) * 0.9 + edge * 0.7;
}

void main() {
  vec2 uv = fragCoord / resolution;
  uv.y = 1.0 - uv.y;
  float t = uTime;
  float glow = 0.0;
  float hue = 0.0;
  float c1 = curtain(uv, 0.86, 0.05, 3.1, 0.45, 0.0, t);
  float c2 = curtain(uv, 0.70, 0.06, 2.4, -0.35, 2.1, t);
  float c3 = curtain(uv, 0.56, 0.04, 3.7, 0.28, 4.3, t);
  glow = c1 * 0.9 + c2 * 0.75 + c3 * 0.55;
  hue = clamp((c2 * 0.5 + c3) / max(glow, 0.001), 0.0, 1.0);
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.6, hue));
  col = mix(col, uColorC, smoothstep(0.55, 1.0, uv.x * 0.6 + hue * 0.4));
  // 띠 아래쪽은 원화 속으로 녹고, 인물이 서는 가운데는 한 뼘 옅다(얼굴을 뿌옇게 덮지 않게).
  float mask = smoothstep(0.25, 0.7, uv.y) * (0.55 + 0.45 * smoothstep(0.12, 0.42, abs(uv.x - 0.5)));
  float a = clamp(glow * mask, 0.0, 1.0) * uIntensity;

  // 별빛 반짝임: 칸마다 한 점, 오로라가 있는 자리에서만 잦게 켜졌다 꺼진다.
  if (uSparkle > 0.0) {
    vec2 grid = vec2(18.0, 22.0);
    vec2 cell = floor(uv * grid);
    float h = hash(cell);
    vec2 pos = (cell + vec2(hash(cell + 7.1), hash(cell + 3.7)) * 0.8 + 0.1) / grid;
    vec2 dd = (uv - pos) * resolution;
    float dot2 = exp(-dot(dd, dd) * 0.9);
    float blink = pow(max(0.0, sin(t * (0.8 + h * 1.6) + h * 6.2831)), 14.0);
    float s = dot2 * blink * step(0.55, h) * uSparkle * (0.35 + glow) * mask;
    col = mix(col, vec3(1.0), clamp(s, 0.0, 1.0));
    a = max(a, clamp(s, 0.0, 1.0));
  }
  gl_FragColor = vec4(col * a, a);
}
`;

let textureSerial = 0;

export class LabAurora {
  private readonly scene: Phaser.Scene;
  private readonly shader: Phaser.GameObjects.Shader;
  private readonly image: Phaser.GameObjects.Image;
  private readonly textureKey: string;
  private readonly plan = labAuroraPlan({
    quality: session.settings.presentation.graphicsQuality,
    powerSaving: session.settings.presentation.powerSaving,
    reduceMotion: session.settings.accessibility.reduceMotion,
  });
  private clockMs = 0;
  private sinceDrawMs = Number.POSITIVE_INFINITY;
  private paused = false;
  private destroyed = false;

  /** 세울 수 없으면(WebGL 없음·낮음 품질·셰이더 실패) `undefined`. */
  static create(scene: Phaser.Scene, depth: number, tone: LabAuroraTone): LabAurora | undefined {
    try {
      if (!(scene.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return undefined;
      const plan = labAuroraPlan({
        quality: session.settings.presentation.graphicsQuality,
        powerSaving: session.settings.presentation.powerSaving,
        reduceMotion: session.settings.accessibility.reduceMotion,
      });
      if (!plan.enabled) return undefined;
      return new LabAurora(scene, depth, tone);
    } catch {
      return undefined;
    }
  }

  private constructor(scene: Phaser.Scene, depth: number, tone: LabAuroraTone) {
    this.scene = scene;
    const { buffer, band } = LAB_AURORA;
    const base = new Phaser.Display.BaseShader("lab-aurora", FRAGMENT, undefined, {
      uTime: { type: "1f", value: 0 },
      uColorA: { type: "3f", value: { x: 1, y: 1, z: 1 } },
      uColorB: { type: "3f", value: { x: 1, y: 1, z: 1 } },
      uColorC: { type: "3f", value: { x: 1, y: 1, z: 1 } },
      uIntensity: { type: "1f", value: 0 },
      uSparkle: { type: "1f", value: 0 },
    });
    // 표시 목록에 넣지 않는다 — `scene.add.shader`가 아니라 생성자로 세운다.
    this.shader = new Phaser.GameObjects.Shader(scene, base, 0, 0, buffer.width, buffer.height);
    if (!this.shader.program) { this.shader.destroy(); throw new Error("aurora shader unavailable"); }
    this.textureKey = `lab-aurora-${++textureSerial}`;
    this.shader.setRenderToTexture(this.textureKey);
    this.image = scene.add.image(band.x, band.y, this.textureKey)
      .setOrigin(0.5, 0)
      .setDisplaySize(band.width, band.height)
      .setBlendMode(Phaser.BlendModes.SCREEN)
      .setDepth(depth)
      .setAlpha(0);
    this.setTone(tone);
    this.draw();
    scene.tweens.add({ targets: this.image, alpha: 1, duration: LAB_AURORA.fadeInMs, ease: "Sine.Out" });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** 배너가 바뀌면 색과 세기만 갈아 끼운다. 멈춘 오로라는 한 번 다시 그린다. */
  setTone(tone: LabAuroraTone): void {
    if (this.destroyed) return;
    const palette = LAB_AURORA_PALETTE[tone];
    const [a, b, c] = palette.colors;
    this.shader.setUniform("uColorA.value", { x: a[0], y: a[1], z: a[2] });
    this.shader.setUniform("uColorB.value", { x: b[0], y: b[1], z: b[2] });
    this.shader.setUniform("uColorC.value", { x: c[0], y: c[1], z: c[2] });
    this.shader.setUniform("uIntensity.value", palette.intensity);
    this.shader.setUniform("uSparkle.value", this.plan.animate ? palette.sparkle : 0);
    if (!this.plan.animate) this.draw();
  }

  /** 화면이 덮였을 때(연출·결과판) 그리기와 표시를 함께 멈춘다. */
  setPaused(paused: boolean): void {
    if (this.destroyed || this.paused === paused) return;
    this.paused = paused;
    this.image.setVisible(!paused);
  }

  private tick(_time: number, delta: number): void {
    if (this.destroyed || this.paused || !this.plan.animate) return;
    this.clockMs += delta;
    this.sinceDrawMs += delta;
    if (!labAuroraDue(this.sinceDrawMs, this.plan.hz)) return;
    this.draw();
  }

  private draw(): void {
    const renderer = this.scene.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) || renderer.contextLost) return;
    this.sinceDrawMs = 0;
    this.shader.setUniform("uTime.value", this.clockMs / 1000);
    renderer.pipelines.clear();
    this.shader.load();
    this.shader.flush();
    renderer.pipelines.rebind();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.image.destroy();
    // Shader가 제 framebuffer·텍스처(키 포함)를 함께 놓는다.
    this.shader.destroy();
  }
}
