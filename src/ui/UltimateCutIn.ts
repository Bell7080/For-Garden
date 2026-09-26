import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { spawnPuppet } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { COLOR, textStyle } from "./theme";
import type { UltimatePresentation } from "../data/ultimatePresentations";
import { ultimateCutInDurations, type UltimatePresentationTiming } from "../core/battleControls";
import { CUT_IN_HALFTONE, CUT_IN_PORTRAIT_PUSH, CUT_IN_STREAKS, CUT_IN_SWEEP, CUT_IN_TITLE, CUT_IN_PUSH_ANGLE, cutInPushDirection } from "./ultimateCutInStyle";
import { presentationPolicy } from "../core/settings";
import { flashPolicy } from "./signatureEffects";
import { ultimateCutInMaskLayout, type CutInPoint } from "./ultimateCutInLayout";
import { InterruptibleStep } from "./InterruptibleStep";
import { shrinkTextToWidth } from "./textFit";

/** 컷인이 서는 층. 공격 판정 시각은 이 프리팹이 아니라 BattleScene이 소유한다. */
const CUT_IN = { depth: 900, dimAlpha: 0.58 } as const;
/** 도트 무늬 텍스처 키. 한 번 굽고 모든 컷인이 함께 쓴다. */
const HALFTONE_KEY = "fx-cutin-halftone";

/** 로컬 배치점을 컨테이너의 회전·배율·이동이 모두 반영된 월드 좌표로 투영한다. */
function worldPoints(matrix: Phaser.GameObjects.Components.TransformMatrix, points: readonly CutInPoint[]): Phaser.Geom.Point[] {
  return points.map((point) => {
    const world = matrix.transformPoint(point.x, point.y);
    return new Phaser.Geom.Point(world.x, world.y);
  });
}

/** 도트 한 칸 — 칸 안에 어긋난 마름모 둘. 동그라미를 쓰지 않는다(화면 전체의 문법). */
function ensureHalftoneTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(HALFTONE_KEY)) return;
  const { cell, dot } = CUT_IN_HALFTONE;
  const graphics = scene.make.graphics({}, false);
  graphics.fillStyle(0xffffff, 1);
  for (const [cx, cy] of [[cell * 0.25, cell * 0.25], [cell * 0.75, cell * 0.75]] as const) {
    graphics.fillPoints([new Phaser.Geom.Point(cx, cy - dot), new Phaser.Geom.Point(cx + dot * 0.8, cy), new Phaser.Geom.Point(cx, cy + dot), new Phaser.Geom.Point(cx - dot * 0.8, cy)], true);
  }
  graphics.generateTexture(HALFTONE_KEY, cell, cell);
  graphics.destroy();
}

/** 닦아 내듯 드러나는 제목 한 줄. 마스크의 오른쪽 끝(`reveal`)을 트윈이 민다. */
interface TitleWipe { reveal: number; mask: Phaser.GameObjects.Graphics; geometry: Phaser.Display.Masks.GeometryMask; top: number; bottom: number }

/**
 * 전신 Puppet 캐시를 그대로 쓰는 근미래 궁극기 컷인.
 * 별도 둥근 패널이나 사방 테두리 대신 비네트, 비대칭 사선 유리면과 위 hairline만 겹친다.
 *
 * **재생 전에는 보이지 않는다.** 원화를 읽는 동안 판이 제자리에 불투명하게 서 있다가 재생
 * 순간 화면 밖으로 옮겨 다시 들어오던 때는, 컷인이 한 번 번쩍 튕겼다가 새로 뜨는 것처럼 보였다.
 * 화면을 누르는 어둠도 판과 **따로** 둔다 — 판과 함께 옆에서 밀려 들어오면 화면 절반만 어두운
 * 프레임이 지나간다. 어둠은 제자리에서 옅어졌다 짙어지고, 판만 옆에서 들어온다.
 *
 * 흐름은 늘 **왼쪽 → 오른쪽**이다(값은 `ultimateCutInStyle.ts`). 판이 왼쪽에서 들어와 오른쪽으로
 * 빠지고, 전신은 왼쪽 아래에서 오른쪽 위로 밀려 올라오며 속도선이 그 뒤를 따른다.
 */
export class UltimateCutIn extends Phaser.GameObjects.Container {
  private disposed = false;
  /** 현재 tween 또는 hold 하나를 소유해 모든 중단 경로가 같은 Promise를 해제하도록 한다. */
  private readonly step = new InterruptibleStep();
  /** 원화용(판 + 상체 띠)과 무늬용(판만) 두 마스크. 컨테이너 변환을 물려받지 않아 매 프레임 다시 그린다. */
  private readonly portraitMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly panelMaskGraphics: Phaser.GameObjects.Graphics;
  private readonly portraitMask: Phaser.Display.Masks.GeometryMask;
  private readonly panelMask: Phaser.Display.Masks.GeometryMask;
  private readonly wipes: TitleWipe[] = [];
  private readonly syncMasks: () => void;
  /** 판과 따로 제자리에서 옅어졌다 짙어지는 어둠. */
  private readonly dim: Phaser.GameObjects.Rectangle;
  private readonly halftone?: Phaser.GameObjects.TileSprite;
  private readonly streaks: Phaser.GameObjects.Graphics[] = [];
  private readonly sweep?: Phaser.GameObjects.Rectangle;
  /** 제목 두 줄이 닦여 나올 때 그 끝을 따라 달리는 빛 조각. */
  private readonly wipeEdges: Phaser.GameObjects.Rectangle[] = [];
  private portrait?: Phaser.GameObjects.GameObject & { x: number; y: number; setPosition(x: number, y: number): unknown };
  /** 원화가 끼어들 자리 — 무늬 위, 빛 띠·글자 아래. */
  private readonly portraitSlot: number;
  /** 판을 꾸미는 트윈. 중간에 부서져도 죽은 객체를 계속 만지지 않게 함께 멈춘다. */
  private readonly decor: Phaser.Tweens.Tween[] = [];

  private constructor(scene: Phaser.Scene, relic: RelicDef, private readonly presentation: Readonly<UltimatePresentation>, private readonly policy: { graphicsQuality: "high" | "balanced" | "low"; reduceFlashes: boolean }) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(CUT_IN.depth).setVisible(false);
    // create가 Puppet 로딩을 await하는 동안에도 Scene 종료만으로 빈 컨테이너가 남지 않게 한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);

    // 밝은 전장에서도 이름이 묻히지 않도록 화면 전체를 한 번 누른다 — 판과 따로 선다.
    this.dim = scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, CUT_IN.dimAlpha).setDepth(CUT_IN.depth - 1).setAlpha(0);

    // 마스크와 유리면이 서로 어긋나지 않도록 한 순수 배치 결과를 함께 사용한다.
    const layout = ultimateCutInMaskLayout(BASE_WIDTH);
    this.portraitMaskGraphics = scene.make.graphics({}, false);
    this.panelMaskGraphics = scene.make.graphics({}, false);
    const { wipe: band } = CUT_IN_TITLE;
    // 이름 줄 · 스킬 줄 · 두 줄을 잇는 빗금 — 셋이 저마다 제 띠로 닦여 나온다.
    for (const [top, bottom] of [[band.top, band.split], [band.split, band.bottom], [band.top, band.bottom]] as const) {
      const mask = scene.make.graphics({}, false);
      this.wipes.push({ reveal: 0, mask, geometry: mask.createGeometryMask(), top, bottom });
    }
    // GeometryMask는 Container 변환을 상속하지 않으므로 렌더 직전 현재 월드 행렬로 다시 그린다.
    this.syncMasks = (): void => {
      if (this.disposed || !this.active) return;
      const matrix = this.getWorldTransformMatrix();
      const panel = worldPoints(matrix, layout.panel);
      this.panelMaskGraphics.clear().fillStyle(0xffffff, 1).fillPoints(panel, true);
      this.portraitMaskGraphics.clear().fillStyle(0xffffff, 1).fillPoints(panel, true);
      this.portraitMaskGraphics.fillPoints(worldPoints(matrix, layout.upperBand), true);
      for (const wipe of this.wipes) {
        const rect = [{ x: -40, y: wipe.top }, { x: wipe.reveal, y: wipe.top }, { x: wipe.reveal, y: wipe.bottom }, { x: -40, y: wipe.bottom }];
        wipe.mask.clear().fillStyle(0xffffff, 1).fillPoints(worldPoints(matrix, rect), true);
      }
    };
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.syncMasks);
    this.syncMasks();
    this.portraitMask = this.portraitMaskGraphics.createGeometryMask();
    this.panelMask = this.panelMaskGraphics.createGeometryMask();

    const glass = scene.add.graphics();
    glass.fillStyle(COLOR.void, 0.82);
    glass.fillPoints(layout.panel.map((point) => new Phaser.Geom.Point(point.x, point.y)), true);
    this.add(glass);

    // **도트 무늬와 속도선은 판 안에서만, 원화 뒤에서 흐른다.** 낮은 그래픽에서는 세우지 않는다.
    const decorated = policy.graphicsQuality !== "low";
    if (decorated) {
      ensureHalftoneTexture(scene);
      this.halftone = scene.add.tileSprite(BASE_WIDTH / 2, 855, BASE_WIDTH + 220, 1120, HALFTONE_KEY)
        .setTint(COLOR.accent).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setMask(this.panelMask);
      this.add(this.halftone);
      for (const line of CUT_IN_STREAKS.lines) {
        // 가로로 그려 두고 밀어 올리는 각도로 돌린다 — 늘어나는 것은 배율(scaleX) 하나다.
        const streak = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setRotation(CUT_IN_PUSH_ANGLE).setMask(this.panelMask);
        streak.fillStyle(0xffffff, 1).fillPoints([
          new Phaser.Geom.Point(-CUT_IN_STREAKS.length, 0), new Phaser.Geom.Point(0, -line.width / 2),
          new Phaser.Geom.Point(CUT_IN_STREAKS.length * 0.08, 0), new Phaser.Geom.Point(0, line.width / 2),
        ], true);
        this.streaks.push(streak);
        this.add(streak);
      }
    }
    this.portraitSlot = this.list.length;
    if (decorated && !policy.reduceFlashes) {
      // 판을 한 번 훑고 지나가는 빛 띠 — 밀어 올리는 방향에 수직으로 선다.
      this.sweep = scene.add.rectangle(-CUT_IN_SWEEP.width, 855, CUT_IN_SWEEP.width, 1800, 0xffffff, 1)
        .setRotation(CUT_IN_PUSH_ANGLE).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setMask(this.panelMask);
      this.add(this.sweep);
    }

    // 황동 hairline과 짧은 사선만으로 홀로그램 계층을 만든다.
    const lines = scene.add.graphics();
    lines.lineStyle(3, COLOR.accent, 0.8).beginPath().moveTo(0, 470).lineTo(BASE_WIDTH, 320).strokePath();
    lines.lineStyle(2, COLOR.accent, 0.36).beginPath().moveTo(710, 350).lineTo(1010, 305).strokePath();
    this.add(lines);
    this.addTitle(relic);
  }

  /**
   * 제목 — 위에 개체 이름, 아래에 **크게** 스킬 이름. 왼쪽의 굵은 빗금이 둘을 판에 묶고, 스킬
   * 이름 밑으로 강조선이 판 끝까지 흐른다. 이름은 데이터 문구 표를 지나므로 언어를 따라 바뀌고,
   * 긴 언어는 칸을 넓히지 않고 글자만 줄인다.
   */
  private addTitle(relic: RelicDef): void {
    const scene = this.scene;
    const title = CUT_IN_TITLE;
    const [nameWipe, skillWipe, slashWipe] = this.wipes;
    const slash = scene.add.graphics();
    slash.fillStyle(0x000000, 0.55).fillPoints([
      new Phaser.Geom.Point(title.slash.x + title.slash.lean + 6, title.slash.top + 6), new Phaser.Geom.Point(title.slash.x + title.slash.lean + title.slash.width + 6, title.slash.top + 6),
      new Phaser.Geom.Point(title.slash.x + title.slash.width + 6, title.slash.bottom + 6), new Phaser.Geom.Point(title.slash.x + 6, title.slash.bottom + 6),
    ], true);
    slash.fillStyle(COLOR.accent, 1).fillPoints([
      new Phaser.Geom.Point(title.slash.x + title.slash.lean, title.slash.top), new Phaser.Geom.Point(title.slash.x + title.slash.lean + title.slash.width, title.slash.top),
      new Phaser.Geom.Point(title.slash.x + title.slash.width, title.slash.bottom), new Phaser.Geom.Point(title.slash.x, title.slash.bottom),
    ], true);
    slash.setMask(slashWipe.geometry);
    const underline = scene.add.graphics();
    underline.fillStyle(COLOR.accent, 0.9).fillRect(title.slash.x + title.slash.width, title.underline.y, BASE_WIDTH, title.underline.height);
    underline.fillStyle(COLOR.accent, 0.35).fillRect(title.slash.x + title.slash.width, title.underline.y + title.underline.height + 6, BASE_WIDTH, 2);
    underline.setMask(skillWipe.geometry);

    const name = scene.add.text(title.x, title.name.y, relic.name, textStyle({ role: "display", size: title.name.size, color: COLOR.ink })).setOrigin(0, 1);
    name.setStroke("#000000", 6).setShadow(0, 4, "#000000", 6, false, true).setMask(nameWipe.geometry);
    const skill = scene.add.text(title.x, title.skill.y, relic.ultimate.name, textStyle({ role: "display", size: title.skill.size, color: COLOR.accentText })).setOrigin(0, 0.5);
    shrinkTextToWidth(skill, title.skill.maxWidth);
    skill.setStroke("#000000", 10).setShadow(0, 6, "#000000", 8, false, true).setMask(skillWipe.geometry);
    this.add([slash, underline, name, skill]);
    for (const wipe of [nameWipe, skillWipe]) {
      // 닦이는 끝을 따라 달리는 빛 조각 — 글자가 어디서 나오는지 손끝처럼 짚는다.
      const edge = scene.add.rectangle(0, (wipe.top + wipe.bottom) / 2, title.wipe.edge, wipe.bottom - wipe.top, COLOR.accent, 1)
        .setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.wipeEdges.push(edge);
      this.add(edge);
    }
  }

  /** 캐시된 원화를 준비한 뒤에만 진입시켜 빈 컷인 프레임이 보이지 않게 한다. */
  static async create(scene: Phaser.Scene, relic: RelicDef, presentation: Readonly<UltimatePresentation>, policy: { graphicsQuality: "high" | "balanced" | "low"; reduceFlashes: boolean } = { graphicsQuality: "high", reduceFlashes: false }): Promise<UltimateCutIn> {
    const cutIn = new UltimateCutIn(scene, relic, presentation, policy);
    // 외형 선택은 manager/resolver가 소유하고 컷인은 결정된 전신만 연출한다.
    const asset = relicAppearanceManager.portraitAssetFor(relic.id);
    let portrait: Awaited<ReturnType<typeof spawnPuppet>>;
    try {
      portrait = await spawnPuppet(scene, asset, {
        // 데이터의 기준점과 배율만 해석하며 렐릭 ID에 따른 UI 분기는 만들지 않는다.
        focus: { anchor: "core", ...presentation.artworkOrigin }, height: 1280 * presentation.artworkScale * presentationPolicy(policy.graphicsQuality).fullBodyScale,
      });
    } catch (error) {
      // 로딩 실패는 호출자에게 전달하되 await 전에 만든 빈 컨테이너는 이 경계에서 회수한다.
      cutIn.destroy();
      throw error;
    }
    if (cutIn.disposed || !scene.scene.isActive()) { portrait.destroy(); return cutIn; }
    portrait.setMask(cutIn.portraitMask);
    cutIn.addAt(portrait, cutIn.portraitSlot);
    cutIn.portrait = portrait;
    return cutIn;
  }

  /**
   * 왼쪽 진입 → 이름 노출 → 오른쪽 퇴장을 하나의 await 계약으로 제공한다.
   *
   * **시간은 배속을 받지 않는다**(`ultimateCutInDurations`). 포효를 기다리지 않는다 — 컷인은 이
   * 한 장으로 끝나고, 곧바로 전장의 SD가 커지며 친다.
   */
  async play(timing: UltimatePresentationTiming): Promise<void> {
    if (this.disposed) return;
    const [enterMs, holdMs, exitMs] = ultimateCutInDurations(this.presentation.cutInHoldMs, timing.skipLeadIn);
    if (enterMs + holdMs + exitMs === 0) return;
    const flashes = flashPolicy(this.policy.reduceFlashes);
    // 섬광 감소에서는 투명→불투명 점멸 대신 화면 밖 이동만으로 진입을 알린다.
    this.setX(-BASE_WIDTH).setAlpha(flashes.fadeFromTransparent ? 0 : 1).setVisible(true);
    this.syncMasks();
    this.decorate(enterMs, enterMs + holdMs + exitMs);
    this.decor.push(this.scene.tweens.add({ targets: this.dim, alpha: 1, duration: enterMs, ease: "Quad.Out" }));
    await this.tween({ targets: this, x: 0, alpha: 1, duration: enterMs, ease: "Expo.Out" });
    if (this.disposed) return;
    await this.hold(holdMs);
    if (this.disposed) return;
    this.decor.push(this.scene.tweens.add({ targets: this.dim, alpha: 0, duration: exitMs, ease: "Quad.In" }));
    // 들어온 방향 그대로 오른쪽으로 빠진다 — 되돌아 나가면 한 번 튕긴 것처럼 읽힌다.
    await this.tween({ targets: this, x: BASE_WIDTH, alpha: 0, duration: exitMs, ease: "Cubic.In" });
  }

  /** 전신이 밀려 올라오고, 속도선이 따라붙고, 도트가 쏟아지고, 빛 띠가 훑고, 제목이 닦여 나온다. */
  private decorate(enterMs: number, totalMs: number): void {
    const tweens = this.scene.tweens;
    const push = cutInPushDirection();
    if (this.portrait) {
      // 전신은 판보다 한 뼘 더 먼 왼쪽 아래에서 출발해 비스듬히 올라오고, 머무는 동안에도 조금 더 밀린다.
      const portrait = this.portrait;
      const home = { x: portrait.x, y: portrait.y };
      const from = { x: home.x - push.x * CUT_IN_PORTRAIT_PUSH.from, y: home.y - push.y * CUT_IN_PORTRAIT_PUSH.from };
      portrait.setPosition(from.x, from.y);
      this.decor.push(tweens.add({ targets: portrait, x: home.x, y: home.y, duration: enterMs * 1.25, ease: "Expo.Out" }));
      this.decor.push(tweens.add({
        targets: portrait, x: home.x + push.x * CUT_IN_PORTRAIT_PUSH.drift, y: home.y + push.y * CUT_IN_PORTRAIT_PUSH.drift,
        delay: enterMs * 1.25, duration: Math.max(1, totalMs - enterMs * 1.25), ease: "Linear",
      }));
    }
    if (this.halftone) {
      // 인물이 치고 나가는 반대쪽(왼쪽 아래)으로 쏟아진다. 칸의 정수배만큼 흘러 끝난 자리가 이음매 없이 같다.
      const { cell, travel } = CUT_IN_HALFTONE;
      this.decor.push(tweens.add({ targets: this.halftone, alpha: CUT_IN_HALFTONE.alpha, duration: enterMs * 0.6 }));
      this.decor.push(tweens.add({ targets: this.halftone, tilePositionX: cell * travel.x, tilePositionY: -cell * travel.y, duration: totalMs, ease: "Cubic.Out" }));
    }
    const normal = { x: -push.y, y: push.x };
    this.streaks.forEach((streak, index) => {
      const line = CUT_IN_STREAKS.lines[index];
      const startX = CUT_IN_STREAKS.origin.x + normal.x * line.offset;
      const startY = CUT_IN_STREAKS.origin.y + normal.y * line.offset;
      streak.setPosition(startX, startY).setAlpha(0).setScale(0.15, 1);
      this.decor.push(tweens.add({
        targets: streak,
        x: startX + push.x * CUT_IN_STREAKS.travel,
        y: startY + push.y * CUT_IN_STREAKS.travel,
        scaleX: 1,
        duration: CUT_IN_STREAKS.ms,
        delay: index * CUT_IN_STREAKS.staggerMs,
        ease: "Cubic.Out",
        onStart: () => streak.setAlpha(line.alpha),
        onUpdate: (tween) => streak.setAlpha(line.alpha * (1 - tween.progress * tween.progress)),
      }));
    });
    if (this.sweep) {
      this.sweep.setX(-CUT_IN_SWEEP.width).setAlpha(CUT_IN_SWEEP.alpha);
      this.decor.push(tweens.add({ targets: this.sweep, x: BASE_WIDTH + CUT_IN_SWEEP.width, alpha: 0, duration: CUT_IN_SWEEP.ms, delay: enterMs * 0.4, ease: "Cubic.Out" }));
    }
    // 제목은 판이 거의 선 뒤 왼쪽에서 오른쪽으로 촤라락 닦여 나온다 — 개체 이름이 먼저, 스킬 이름이 뒤따른다.
    const { wipe } = CUT_IN_TITLE;
    this.wipes.forEach((line, index) => {
      // 빗금(셋째 띠)은 이름과 같은 박자로 닦이고, 끝을 따라 달리는 빛 조각은 두 글자 줄에만 붙는다.
      const edge = this.wipeEdges[index] as Phaser.GameObjects.Rectangle | undefined;
      line.reveal = 0;
      edge?.setX(0).setAlpha(0);
      this.decor.push(tweens.add({
        targets: line, reveal: BASE_WIDTH + 80, duration: wipe.ms, delay: enterMs * 0.45 + (index === 1 ? wipe.skillDelay : wipe.nameDelay), ease: "Cubic.Out",
        onStart: () => edge?.setAlpha(0.7),
        onUpdate: (tween) => edge?.setX(line.reveal).setAlpha(0.7 * (1 - tween.progress)),
        onComplete: () => edge?.setAlpha(0),
      }));
    });
  }

  /** tween complete/stop이 모두 같은 멱등 finish를 호출하고 destroy는 실제 Tween까지 제거한다. */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return this.step.wait((finish) => {
      const activeTween = this.scene.tweens.add({ ...config, onComplete: finish, onStop: finish });
      return () => { activeTween.stop(); activeTween.remove(); };
    });
  }

  /** 홀드 TimerEvent도 tween과 같은 중단 계약 아래 두어 씬 종료 시 대기만 남지 않게 한다. */
  private hold(duration: number): Promise<void> {
    return this.step.wait((finish) => {
      const timer = this.scene.time.delayedCall(duration, finish);
      return () => timer.remove(false);
    });
  }

  /** Phaser EventEmitter의 context까지 고정해 destroy에서 정확히 같은 리스너를 해제한다. */
  private handleSceneShutdown(): void { this.destroy(true); }

  override destroy(fromScene?: boolean): void {
    if (this.disposed) return;
    this.disposed = true;
    // resolve가 tween/timer 정리보다 먼저 실행되어 play 호출자의 finally가 반드시 진행된다.
    this.step.cancel();
    this.decor.forEach((tween) => tween.stop());
    this.decor.length = 0;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    // Scene 이벤트는 Container 파괴만으로 해제되지 않으므로 등록한 정확한 콜백을 먼저 제거한다.
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.syncMasks);
    this.dim.destroy();
    super.destroy(fromScene);
    // 마스크는 그것이 자르는 판과 같은 목숨을 산다 — 판이 먼저 죽은 뒤에 푼다.
    this.portraitMask.destroy();
    this.panelMask.destroy();
    this.portraitMaskGraphics.destroy();
    this.panelMaskGraphics.destroy();
    for (const wipe of this.wipes) { wipe.geometry.destroy(); wipe.mask.destroy(); }
  }
}
