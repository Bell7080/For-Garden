import Phaser from "phaser";
import type { RelicDef } from "../core/types";
import { portraitAssetFor, portraitUsesRelicTint, spawnPuppet } from "../puppets/assets";
import { tintFor } from "../puppets/tints";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { COLOR, textStyle } from "./theme";
import type { UltimatePresentation } from "../data/ultimatePresentations";

/** 컷인이 화면을 점유하는 짧은 구간. 공격 판정 시각은 이 프리팹이 아니라 BattleScene이 소유한다. */
const CUT_IN = { enterMs: 210, exitMs: 170, depth: 900 } as const;

/** Phaser tween을 await 가능한 한 번의 단계로 바꿔 궁극기 시퀀스를 읽는 순서 그대로 유지한다. */
function tween(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}

/**
 * 전신 Puppet 캐시를 그대로 쓰는 근미래 궁극기 컷인.
 * 별도 둥근 패널이나 사방 테두리 대신 비네트, 비대칭 사선 유리면과 위 hairline만 겹친다.
 */
export class UltimateCutIn extends Phaser.GameObjects.Container {
  private disposed = false;

  private constructor(scene: Phaser.Scene, relic: RelicDef, private readonly presentation: Readonly<UltimatePresentation>) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(CUT_IN.depth);

    // 밝은 전장에서도 이름이 묻히지 않도록 전체를 검정 비네트처럼 한 번 누른다.
    this.add(scene.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.58));
    const glass = scene.add.graphics();
    glass.fillStyle(COLOR.void, 0.82);
    glass.fillPoints([
      new Phaser.Geom.Point(-80, 470), new Phaser.Geom.Point(BASE_WIDTH, 320),
      new Phaser.Geom.Point(BASE_WIDTH + 80, 1240), new Phaser.Geom.Point(0, 1390),
    ], true);
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
    const portrait = await spawnPuppet(scene, asset, {
      // 데이터의 기준점과 배율만 해석하며 렐릭 ID에 따른 UI 분기는 만들지 않는다.
      focus: { anchor: "core", ...presentation.artworkOrigin }, height: 1280 * presentation.artworkScale,
      tint: portraitUsesRelicTint(relic.portraitAssetId) ? tintFor(relic.id) : 0xffffff,
    });
    if (cutIn.disposed || !scene.scene.isActive()) { portrait.destroy(); return cutIn; }
    cutIn.addAt(portrait, 2);
    return cutIn;
  }

  /** 측면 진입+확대, 짧은 이름 노출, 공격 직전 반대편 퇴장을 하나의 await 계약으로 제공한다. */
  async play(): Promise<void> {
    if (this.disposed) return;
    // 진입 방향의 부호를 퇴장에도 재사용해 한 프리셋이 동선 전체를 설명하게 한다.
    const direction = this.presentation.enterFrom === "left" ? -1 : 1;
    this.setX(direction * BASE_WIDTH).setScale(0.82).setAlpha(0);
    await tween(this.scene, { targets: this, x: 0, scale: 1, alpha: 1, duration: CUT_IN.enterMs, ease: "Cubic.Out" });
    await new Promise<void>((resolve) => this.scene.time.delayedCall(this.presentation.cutInDurationMs, resolve));
    if (this.disposed) return;
    await tween(this.scene, { targets: this, x: -direction * BASE_WIDTH, alpha: 0, duration: CUT_IN.exitMs, ease: "Cubic.In" });
  }

  override destroy(fromScene?: boolean): void {
    this.disposed = true;
    super.destroy(fromScene);
  }
}
