import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { settingsManager } from "../managers/SettingsManager";
import { raiseSettingsAccess } from "./settingsAccess";
import { COLOR, textStyle } from "./theme";

/** 튜토리얼 안내가 서는 깊이. 팝업(2200~2400)과 결과판(5000대)보다 위다. */
export const TUTORIAL_SPOTLIGHT_DEPTH = 6000;

export interface TutorialSpotlightOptions {
  /** 밝게 남길 자리(씬 좌표). 이 안의 입력만 아래 화면으로 지나간다. */
  rect: { x: number; y: number; width: number; height: number };
  text: string;
  /** 안내 글이 구멍 위에 서는지 아래에 서는지. 기본은 위이고, 위가 모자라면 아래로 뒤집는다. */
  side?: "above" | "below";
  depth?: number;
  /**
   * 있으면 「여기서 저기로」를 휘어진 화살표로 그린다(씬 좌표). 글로만 "끌어 보세요"라 적으면 어디서
   * 어디로인지가 읽히지 않는다 — 화살표가 그 길을 되풀이해 그어 준다.
   */
  guide?: { from: { x: number; y: number }; to: { x: number; y: number }; bend?: number };
  /**
   * 있으면 안내만 하는 칸이다 — 구멍까지 막고 화면 어디를 눌러도 이 함수를 부른다. 소개 중에 버튼이
   * 눌려 다른 창이 열리면 안내 순서가 엉킨다.
   */
  onAdvance?: () => void;
  /** 안내 칸 밑에 작게 서는 말(「화면을 눌러 계속」·`2/5`). */
  hint?: string;
  /** 구멍 가장자리에서 안내 글까지의 거리. 화살표가 그 사이를 지나가야 하는 칸은 넓힌다. */
  textGap?: number;
  /** 구멍 둘레가 숨 쉬듯 번진다 — 「마지막으로 여기를 누르면 끝」을 말하는 마무리 칸이 쓴다. */
  pulse?: boolean;
  /**
   * 화면을 덮지 않고 **가리키기만** 한다. 어둠도 입력 막도 없어 안내를 따르지 않고 설정이나 다른 화면을 봐도
   * 된다 — 꼭 막아야 할 조작은 그 화면이 직접 잠근다. 글은 판 위에 서서 밝은 원화 위에서도 읽힌다.
   */
  passive?: boolean;
  /**
   * 가리킬 것의 실루엣(씬 좌표 점 목록 — `Button.outlineInScene`). 주면 강조선과 밝은 구멍이 네모가 아니라 그 모양을
   * 따른다 — 깎인 칩·원근 판을 네모로 두르면 강조가 버튼과 따로 논다. 없으면 이 게임의 기본 깎임(왼쪽 위·오른쪽 아래)이다.
   */
  shape?: ReadonlyArray<{ x: number; y: number }>;
  /**
   * 처음 서는 안내인가(기본 켜짐). 처음 서는 안내는 어둠·강조·글이 잠깐 번져 들어오고, 그동안(`SPOTLIGHT_SETTLE_MS`) 구멍도
   * 눌리지 않는다 — 앞 칸을 누른 손이 그대로 다음 칸까지 눌러 읽기도 전에 넘어가던 것을 막는다. 자리만 옮겨 다시 서는
   * 안내(`followTutorialTarget`)는 끈다.
   */
  enter?: boolean;
  /**
   * 어둠만 걷고 손은 받지 않는 곁 자리(씬 좌표 상자). 누를 것은 아니지만 함께 읽어야 할 것(세공 버튼을 가리키는 동안의
   * 옵션 줄)이 어둠에 묻히지 않게 한다. 강조선은 두르지 않는다 — 누를 자리는 여전히 구멍 하나다.
   */
  reveal?: ReadonlyArray<{ x: number; y: number; width: number; height: number }>;
}

/** 새 안내가 번져 들어오는 시간과, 그동안 구멍이 손을 받지 않는 시간. */
export const SPOTLIGHT_ENTER_MS = 220;
export const SPOTLIGHT_SETTLE_MS = 380;

/** 실루엣을 바깥으로 `pad`만큼 넓힌다 — 상자 가운데를 기준으로 가로·세로를 따로 늘린다. */
export function padOutline(points: ReadonlyArray<{ x: number; y: number }>, pad: number): { x: number; y: number }[] {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sx = (maxX - minX + pad * 2) / Math.max(1, maxX - minX), sy = (maxY - minY + pad * 2) / Math.max(1, maxY - minY);
  return points.map((p) => ({ x: cx + (p.x - cx) * sx, y: cy + (p.y - cy) * sy }));
}

/** 실루엣이 없을 때의 구멍 — 상자에 이 게임의 판·칩과 같은 깎임(왼쪽 위·오른쪽 아래)을 준다. */
export function chipOutline(left: number, top: number, right: number, bottom: number): { x: number; y: number }[] {
  const cut = Math.min(28, (bottom - top) * 0.28, (right - left) * 0.2);
  return [
    { x: left + cut, y: top }, { x: right, y: top }, { x: right, y: bottom - cut },
    { x: right - cut, y: bottom }, { x: left, y: bottom }, { x: left, y: top + cut },
  ];
}

const HOLE_PAD = 14;
const DIM_ALPHA = 0.66;

/**
 * 화면을 어둡게 덮고 한 자리만 밝게 뚫어 가리키는 튜토리얼 안내.
 *
 * **조각마다 객체를 얹어 깊이를 만지지 않는다.** 가리킬 것이 팝업 안의 버튼이든 하단 탭이든 그 위치(bounds)만
 * 알면 되도록, 구멍 둘레에 어두운 막 네 장을 두르고 구멍은 비워 둔다 — 구멍 안의 눌림은 아래 화면이 그대로
 * 받고, 막이 덮은 곳은 막이 삼킨다. 호출한 쪽은 구멍 안의 조작이 일어나면 `destroy()`로 걷는다.
 */
export class TutorialSpotlight {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private destroyed = false;
  private releaseSettings?: () => void;

  constructor(private readonly scene: Phaser.Scene, options: TutorialSpotlightOptions) {
    const depth = options.depth ?? TUTORIAL_SPOTLIGHT_DEPTH;
    const left = Math.max(0, options.rect.x - HOLE_PAD);
    const top = Math.max(0, options.rect.y - HOLE_PAD);
    const right = Math.min(BASE_WIDTH, options.rect.x + options.rect.width + HOLE_PAD);
    const bottom = Math.min(BASE_HEIGHT, options.rect.y + options.rect.height + HOLE_PAD);
    const outline = options.shape && options.shape.length >= 3 ? padOutline(options.shape, HOLE_PAD) : chipOutline(left, top, right, bottom);
    const toVectors = (points: ReadonlyArray<{ x: number; y: number }>, dx = 0, dy = 0) => points.map((p) => new Phaser.Math.Vector2(p.x - dx, p.y - dy));
    // 입력은 구멍 상자 밖 네 장이 삼킨다(보이지 않는다). 어둠은 실루엣 모양으로 뚫린 한 장이 그린다 — 네모 막 넷을 칠하면
    // 버튼이 깎였든 원근이 졌든 늘 네모 구멍이 뚫려, 강조가 그 버튼과 따로 논다.
    const block = (x: number, y: number, width: number, height: number): void => {
      if (width <= 0 || height <= 0) return;
      this.objects.push(scene.add.rectangle(x + width / 2, y + height / 2, width, height, 0x000000, 0).setDepth(depth).setInteractive());
    };
    if (!options.passive) {
      // 막이 덮는 동안에도 설정은 열린다 — 막 위로 올렸다가 막이 걷힐 때 내린다.
      this.releaseSettings = raiseSettingsAccess(scene, depth);
      block(0, 0, BASE_WIDTH, top);
      block(0, bottom, BASE_WIDTH, BASE_HEIGHT - bottom);
      block(0, top, left, bottom - top);
      block(right, top, BASE_WIDTH - right, bottom - top);
      // 화면 밖까지 넉넉히 덮는다 — 화면 흔들림(카메라)에도 가장자리가 비지 않게.
      const shade = scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH + 400, BASE_HEIGHT + 400, 0x000000, DIM_ALPHA).setDepth(depth);
      const holeShape = scene.make.graphics({}, false);
      holeShape.fillStyle(0xffffff, 1).fillPoints(toVectors(outline), true);
      for (const area of options.reveal ?? []) holeShape.fillPoints(toVectors(chipOutline(area.x - 6, area.y - 6, area.x + area.width + 6, area.y + area.height + 6)), true);
      const mask = holeShape.createGeometryMask();
      mask.setInvertAlpha(true);
      shade.setMask(mask);
      shade.once(Phaser.GameObjects.Events.DESTROY, () => mask.destroy());
      this.objects.push(shade, holeShape);
    }

    // 구멍 둘레의 얇은 강조선 — 어디까지가 눌러야 할 자리인지 말한다. 먹선 위에 강조색을 얹어 밝은 원화 위에서도 선다.
    const frame = scene.add.graphics().setDepth(depth + 1);
    frame.lineStyle(9, 0x05070a, 0.55).strokePoints(toVectors(outline), true, true);
    frame.lineStyle(4, COLOR.accent, 0.95).strokePoints(toVectors(outline), true, true);
    this.objects.push(frame);
    const reduceMotion = settingsManager.get().accessibility.reduceMotion;
    if (options.pulse || options.passive) {
      // 구멍에서 바깥으로 번지는 테두리 — 다른 칸보다 한 번 더 눈을 끌어 "마지막은 여기"를 말한다.
      const gx = (left + right) / 2, gy = (top + bottom) / 2;
      const glow = scene.add.graphics({ x: gx, y: gy }).setDepth(depth + 1);
      glow.lineStyle(6, COLOR.accent, 1).strokePoints(toVectors(outline, gx, gy), true, true);
      this.objects.push(glow);
      if (!reduceMotion) scene.tweens.add({ targets: glow, scale: 1.2, alpha: 0, duration: 900, repeat: -1, ease: "Quad.Out" });
      else glow.setAlpha(0.6);
    }
    if (options.onAdvance) {
      const onAdvance = options.onAdvance;
      // 구멍 위에도 투명한 막을 덮는다 — 안내 칸에서는 아래 버튼이 눌리면 안 된다.
      const cover = scene.add.rectangle((left + right) / 2, (top + bottom) / 2, right - left, bottom - top, 0, 0).setDepth(depth).setInteractive();
      this.objects.push(cover);
      const objects = this.objects.filter((object): object is Phaser.GameObjects.Rectangle => object instanceof Phaser.GameObjects.Rectangle);
      for (const object of objects) object.on("pointerup", () => { if (!this.destroyed) onAdvance(); });
    }
    if (options.guide) this.drawGuide(options.guide, depth + 2, reduceMotion);

    const roomAbove = top;
    const side = options.side === "below" || (options.side !== "above" && roomAbove < 260) ? "below" : "above";
    const cx = Math.min(BASE_WIDTH - 60, Math.max(60, (left + right) / 2));
    const gap = options.textGap ?? 150;
    const textY = side === "above" ? top - gap : bottom + gap;
    const arrowY = side === "above" ? top - 44 : bottom + 44;
    const label = scene.add.text(BASE_WIDTH / 2, textY, options.text, textStyle({ role: "display", size: 42, color: COLOR.accentText, wrap: BASE_WIDTH - 160, align: "center" }))
      .setOrigin(0.5).setDepth(depth + 2).setShadow(3, 4, "#05070a", 0, true, true);
    const arrow = scene.add.text(cx, arrowY, side === "above" ? "▼" : "▲", textStyle({ role: "display", size: 56, color: COLOR.accentText }))
      .setOrigin(0.5).setDepth(depth + 2);
    if (options.passive) {
      // 어둠이 없으니 글 뒤에 판 한 장을 깐다 — 밝은 원화 위에서도 안내가 떠오른다. 입력은 받지 않는다.
      const plate = scene.add.rectangle(BASE_WIDTH / 2, textY, Math.min(BASE_WIDTH - 80, label.width + 64), label.height + 30, 0x05070a, 0.78)
        .setDepth(depth + 1);
      plate.setStrokeStyle(3, COLOR.accent, 0.55);
      this.objects.push(plate);
    }
    this.objects.push(label, arrow);
    if (options.hint) {
      const hintY = side === "above" ? textY - label.height / 2 - 34 : textY + label.height / 2 + 34;
      const hint = scene.add.text(BASE_WIDTH / 2, hintY, options.hint, textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim }))
        .setOrigin(0.5).setDepth(depth + 2).setShadow(2, 3, "#05070a", 0, true, true);
      this.objects.push(hint);
      if (!reduceMotion) scene.tweens.add({ targets: hint, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    // 화살표가 길을 긋는 칸에서는 위아래로 까딱이는 ▼가 같은 말을 두 번 한다.
    if (options.guide) arrow.setVisible(false);
    if (options.enter !== false) this.enter(scene, depth, { left, top, right, bottom }, options, reduceMotion, [label, arrow, frame]);
    if (!reduceMotion) {
      scene.tweens.add({ targets: arrow, y: arrow.y + (side === "above" ? 16 : -16), duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  }

  /**
   * 휘어진 화살표 한 줄. 출발점에서 끝까지 **그어 나가고**, 끝에 촉이 박힌 뒤 잠깐 머물렀다 다시 긋는다 —
   * 3배로 훑어보는 손에도 한 프레임에 길과 방향이 함께 남도록 먹선 위에 굵은 강조색을 얹는다.
   */
  private drawGuide(guide: NonNullable<TutorialSpotlightOptions["guide"]>, depth: number, reduceMotion: boolean): void {
    const { from, to } = guide;
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    // 길의 가운데에서 수직으로 굽힌다. 기본은 위로 휘는 활 — 손가락이 SD를 들어 올려 옮기는 모양이다.
    const bend = guide.bend ?? -0.42;
    const cx = (from.x + to.x) / 2 + (-dy / length) * length * bend * (dx >= 0 ? 1 : -1);
    const cy = (from.y + to.y) / 2 + (dx / length) * length * bend * (dx >= 0 ? 1 : -1);
    const point = (t: number): { x: number; y: number } => ({
      x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x,
      y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y,
    });
    const g = this.scene.add.graphics().setDepth(depth);
    this.objects.push(g);
    const paint = (progress: number, alpha: number): void => {
      g.clear().setAlpha(alpha);
      const steps = Math.max(2, Math.round(28 * progress));
      const pts: Phaser.Geom.Point[] = [];
      for (let i = 0; i <= steps; i += 1) { const p = point((i / steps) * progress); pts.push(new Phaser.Geom.Point(p.x, p.y)); }
      g.lineStyle(22, 0x05070a, 0.7).strokePoints(pts, false);
      g.lineStyle(12, COLOR.accent, 1).strokePoints(pts, false);
      // 촉: 끝의 접선 방향으로 꺾인 세모. 먹선을 한 겹 두른다.
      const tip = point(progress), back = point(Math.max(0, progress - 0.04));
      const a = Math.atan2(tip.y - back.y, tip.x - back.x);
      const head = (size: number): Phaser.Geom.Point[] => [
        new Phaser.Geom.Point(tip.x + Math.cos(a) * size, tip.y + Math.sin(a) * size),
        new Phaser.Geom.Point(tip.x + Math.cos(a + 2.5) * size, tip.y + Math.sin(a + 2.5) * size),
        new Phaser.Geom.Point(tip.x + Math.cos(a - 2.5) * size, tip.y + Math.sin(a - 2.5) * size),
      ];
      g.fillStyle(0x05070a, 0.75).fillPoints(head(46), true);
      g.fillStyle(COLOR.accent, 1).fillPoints(head(34), true);
      // 출발점의 마름모 — 어디서 잡는지.
      const s = 16;
      g.fillStyle(0xffffff, 0.9).fillPoints([new Phaser.Geom.Point(from.x, from.y - s), new Phaser.Geom.Point(from.x + s, from.y), new Phaser.Geom.Point(from.x, from.y + s), new Phaser.Geom.Point(from.x - s, from.y)], true);
    };
    if (reduceMotion) { paint(1, 1); return; }
    const state = { progress: 0, alpha: 1 };
    paint(0.05, 1);
    this.chain = this.scene.tweens.chain({
      targets: state,
      loop: -1,
      tweens: [
        { progress: 1, alpha: 1, duration: 760, ease: "Quad.InOut", onUpdate: () => paint(Math.max(0.05, state.progress), state.alpha) },
        { alpha: 1, duration: 360 },
        { alpha: 0, duration: 260, onUpdate: () => paint(1, state.alpha), onComplete: () => { state.progress = 0; state.alpha = 1; } },
      ],
    });
  }

  private chain?: Phaser.Tweens.TweenChain;

  /** 처음 서는 순간 — 어둠·강조·글을 번져 들이고, 막는 칸이면 잠깐 구멍도 덮는다. */
  private enter(scene: Phaser.Scene, depth: number, hole: { left: number; top: number; right: number; bottom: number }, options: TutorialSpotlightOptions, reduceMotion: boolean, fade: Phaser.GameObjects.GameObject[]): void {
    if (!options.passive && !options.onAdvance) {
      const guard = scene.add.rectangle((hole.left + hole.right) / 2, (hole.top + hole.bottom) / 2, hole.right - hole.left, hole.bottom - hole.top, 0, 0)
        .setDepth(depth).setInteractive();
      this.objects.push(guard);
      // 씬 시계가 아니라 실제 시간 — 바쁜 프레임에서 씬 타이머가 밀리면 구멍이 한참 막힌다.
      setTimeout(() => { if (guard.scene) guard.destroy(); }, SPOTLIGHT_SETTLE_MS);
    }
    if (reduceMotion) return;
    const shade = this.objects.find((object) => object instanceof Phaser.GameObjects.Rectangle && object.fillAlpha === DIM_ALPHA);
    for (const object of shade ? [...fade, shade] : fade) {
      const target = object as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha;
      const alpha = target.alpha;
      target.setAlpha(0);
      scene.tweens.add({ targets: target, alpha, duration: SPOTLIGHT_ENTER_MS, ease: "Quad.Out" });
    }
  }

  get active(): boolean { return !this.destroyed; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.releaseSettings?.();
    // TweenChain.remove(tween)는 사슬에서 한 고리를 빼는 함수라 인자 없이 부르면 던진다 — 사슬 전체는 stop으로 멈춘다.
    this.chain?.stop();
    for (const object of this.objects) {
      if (!object.scene) continue;
      this.scene.tweens.killTweensOf(object);
      object.destroy();
    }
    this.objects.length = 0;
  }
}
