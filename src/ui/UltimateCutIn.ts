import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { portraitAssetFor, portraitUsesRelicTint, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { COLOR, textStyle } from "./theme";
import type { UltimatePresentation } from "../data/ultimatePresentations";
import { scaleUltimateCutInDurations, type UltimatePresentationTiming } from "../core/battleControls";
import { ultimateCutInMaskLayout, type CutInPoint } from "./ultimateCutInLayout";
import { InterruptibleStep } from "./InterruptibleStep";

/** 컷인이 화면을 점유하는 짧은 구간. 공격 판정 시각은 이 프리팹이 아니라 BattleScene이 소유한다. */
// 전장을 가리는 이동 시간을 짧게 묶어 반복 궁극기에서도 흐름이 오래 끊기지 않게 한다.
const CUT_IN = { enterMs: 120, exitMs: 90, depth: 900 } as const;

/** 로컬 배치점을 컨테이너의 회전·배율·이동이 모두 반영된 월드 좌표로 투영한다. */
function worldPoints(matrix: Phaser.GameObjects.Components.TransformMatrix, points: readonly CutInPoint[]): Phaser.Geom.Point[] {
  return points.map((point) => {
    const world = matrix.transformPoint(point.x, point.y);
    return new Phaser.Geom.Point(world.x, world.y);
  });
}

/** Phaser tween을 await 가능한 한 번의 단계로 바꿔 궁극기 시퀀스를 읽는 순서 그대로 유지한다. */
/**
 * 전신 Puppet 캐시를 그대로 쓰는 근미래 궁극기 컷인.
 * 별도 둥근 패널이나 사방 테두리 대신 비네트, 비대칭 사선 유리면과 위 hairline만 겹친다.
 */
export class UltimateCutIn extends Phaser.GameObjects.Container {
  private disposed = false;
  /** 현재 tween 또는 hold 하나를 소유해 모든 중단 경로가 같은 Promise를 해제하도록 한다. */
  private readonly step = new InterruptibleStep();
  /** Puppet에 연결한 GeometryMask와 그 도형을 명시적으로 소유해 반복 재생 때 함께 정리한다. */
  private portraitMask?: Phaser.Display.Masks.GeometryMask;
  private portraitMaskGraphics?: Phaser.GameObjects.Graphics;
  private syncPortraitMask?: () => void;

  private constructor(scene: Phaser.Scene, relic: RelicDef, private readonly presentation: Readonly<UltimatePresentation>) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(CUT_IN.depth);
    // create가 Puppet 로딩을 await하는 동안에도 Scene 종료만으로 빈 컨테이너가 남지 않게 한다.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);

    // 밝은 전장에서도 이름이 묻히지 않도록 전체를 검정 비네트처럼 한 번 누른다.
    this.add(scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.58));
    const glass = scene.add.graphics();
    // 마스크와 유리면이 서로 어긋나지 않도록 한 순수 배치 결과를 함께 사용한다.
    const maskLayout = ultimateCutInMaskLayout(BASE_WIDTH);
    glass.fillStyle(COLOR.void, 0.82);
    glass.fillPoints(maskLayout.panel.map((point) => new Phaser.Geom.Point(point.x, point.y)), true);
    // 황동 hairline과 짧은 사선만으로 홀로그램 계층을 만든다.
    glass.lineStyle(3, COLOR.accent, 0.8).beginPath().moveTo(0, 470).lineTo(BASE_WIDTH, 320).strokePath();
    glass.lineStyle(2, COLOR.accent, 0.36).beginPath().moveTo(710, 350).lineTo(1010, 305).strokePath();
    this.add(glass);
    this.add(scene.add.text(64, 1040, relic.name, textStyle({ role: "display", size: 62, color: COLOR.ink })).setOrigin(0, 1));
    this.add(scene.add.text(70, 1102, relic.ultimate.name, textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(0, 0));
  }

  /** 캐시된 원화를 준비한 뒤에만 진입시켜 빈 컷인 프레임이 보이지 않게 한다. */
  static async create(scene: Phaser.Scene, relic: RelicDef, presentation: Readonly<UltimatePresentation>): Promise<UltimateCutIn> {
    const cutIn = new UltimateCutIn(scene, relic, presentation);
    const asset = portraitAssetFor(relic.portraitAssetId);
    let portrait: Awaited<ReturnType<typeof spawnPuppet>>;
    try {
      portrait = await spawnPuppet(scene, asset, {
        // 데이터의 기준점과 배율만 해석하며 렐릭 ID에 따른 UI 분기는 만들지 않는다.
        focus: { anchor: "core", ...presentation.artworkOrigin }, height: 1280 * presentation.artworkScale,
        tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : 0xffffff,
      });
    } catch (error) {
      // 로딩 실패는 호출자에게 전달하되 await 전에 만든 빈 컨테이너는 이 경계에서 회수한다.
      cutIn.destroy();
      throw error;
    }
    if (cutIn.disposed || !scene.scene.isActive()) { portrait.destroy(); return cutIn; }
    const layout = ultimateCutInMaskLayout(BASE_WIDTH);
    const maskGraphics = scene.make.graphics({});
    // GeometryMask는 Container 변환을 상속하지 않으므로 렌더 직전 현재 월드 행렬로 두 영역을
    // 다시 그린다. 같은 Graphics에 두 폴리곤을 채우면 패널과 상단 띠의 합집합이 된다.
    const syncPortraitMask = (): void => {
      if (cutIn.disposed || !cutIn.active || !maskGraphics.active) return;
      const matrix = cutIn.getWorldTransformMatrix();
      maskGraphics.clear().fillStyle(0xffffff, 1);
      maskGraphics.fillPoints(worldPoints(matrix, layout.panel), true);
      maskGraphics.fillPoints(worldPoints(matrix, layout.upperBand), true);
    };
    cutIn.portraitMaskGraphics = maskGraphics;
    cutIn.syncPortraitMask = syncPortraitMask;
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncPortraitMask);
    syncPortraitMask();
    cutIn.portraitMask = maskGraphics.createGeometryMask();
    portrait.setMask(cutIn.portraitMask);
    cutIn.addAt(portrait, 2);
    return cutIn;
  }

  /**
   * 측면 진입 → 짧은 이름 노출 → 반대편 퇴장을 하나의 await 계약으로 제공한다.
   *
   * 포효를 기다리지 않는다. 컷인은 이 한 장으로 끝나고, 곧바로 전장의 SD가 커지며 친다.
   */
  async play(timing: UltimatePresentationTiming): Promise<void> {
    if (this.disposed) return;
    // 진입 방향의 부호를 퇴장에도 재사용해 한 프리셋이 동선 전체를 설명하게 한다.
    const direction = this.presentation.enterFrom === "left" ? -1 : 1;
    this.setX(direction * BASE_WIDTH).setScale(0.82).setAlpha(0);
    // 구간별 한 프레임 하한과 별도로 전체 가시 시간도 보장해 빠른 배속에서 섬광처럼 사라지지 않게 한다.
    const [enterMs, holdMs, exitMs] = scaleUltimateCutInDurations(CUT_IN.enterMs, this.presentation.cutInHoldMs, CUT_IN.exitMs, timing);
    await this.tween({ targets: this, x: 0, scale: 1, alpha: 1, duration: enterMs, ease: "Cubic.Out" });
    if (this.disposed) return;
    await this.hold(holdMs);
    if (this.disposed) return;
    await this.tween({ targets: this, x: -direction * BASE_WIDTH, alpha: 0, duration: exitMs, ease: "Cubic.In" });
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
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    // Scene 이벤트는 Container 파괴만으로 해제되지 않으므로 등록한 정확한 콜백을 먼저 제거한다.
    if (this.syncPortraitMask) this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.syncPortraitMask);
    this.portraitMask?.destroy();
    this.portraitMaskGraphics?.destroy();
    this.portraitMask = undefined;
    this.portraitMaskGraphics = undefined;
    this.syncPortraitMask = undefined;
    super.destroy(fromScene);
  }
}
