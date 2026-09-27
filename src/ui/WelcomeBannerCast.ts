import Phaser from "phaser";
import { getRelic } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { enableHitOnClick, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { session } from "../state/session";
import { AffinityBadge } from "./AffinityBadge";
import { ELEMENT_ICON } from "./affinityIcons";
import { drawGlyph } from "./glyphs";
import { drawLayer, slantedRect } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { RARITY_TONE } from "./rarityMark";
import { addSdFootShadow } from "./SdFootShadow";
import { ELEMENT_TINT } from "./skillArt";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";
import { WELCOME_CAST, welcomeCastPlateY } from "./welcomeCastLayout";

/**
 * 첫 복원 연구 원화(빈 방) 위에 서는 SSR 넷 — SD·발밑 그림자·이름판(등급·이름·속성)·돋보기.
 *
 * 원화에 인물이 그려져 있지 않아 **누가 나오는 판인지를 이 넷이 말한다.** 이름판은 등급 글자를
 * 희귀도 색(`RARITY_TONE`)으로, 윗변 강조선을 그 개체의 속성 색(`ELEMENT_TINT`)으로 칠하고 왼쪽
 * 끝에 속성 뱃지를 건다. SD나 돋보기를 누르면 그 개체의 정보창이 열린다(얻기 전이면 실루엣
 * 미리보기) — 픽업 배너의 「캐릭터 정보」 버튼과 같은 길이다.
 *
 * Puppet은 비동기로 서므로, 도착했을 때 이 판이 이미 걷혔으면 그 자리에서 놓는다.
 */
export class WelcomeBannerCast {
  private readonly root: Phaser.GameObjects.Container;
  private readonly puppets: PuppetCreature[] = [];
  private alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    relicIds: readonly string[],
    private readonly onInspect: (relicId: string) => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(WELCOME_CAST.depth);
    const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
    relicIds.slice(0, WELCOME_CAST.spots.length).forEach((relicId, index) => this.addMember(relicId, index, animate));
  }

  destroy(): void {
    this.alive = false;
    for (const puppet of this.puppets) puppet.destroy();
    this.puppets.length = 0;
    this.root.destroy(true);
  }

  private addMember(relicId: string, index: number, animate: boolean): void {
    const { scene } = this;
    const spot = WELCOME_CAST.spots[index];
    const member = scene.add.container(0, 0);
    this.root.add(member);

    addSdFootShadow(scene, spot.x, spot.groundY, spot.height * WELCOME_CAST.shadowRatio, member);
    // SD 자리 전체가 눌린다 — 작은 돋보기만 받으면 손이 SD를 누르고도 아무 일이 없다.
    const hit = scene.add.rectangle(spot.x, spot.groundY - spot.height / 2, spot.height * 0.7, spot.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.onInspect(relicId));
    member.add(hit);

    void spawnPuppet(scene, relicAppearanceManager.sdAssetFor(relicId), {
      x: spot.x, groundY: spot.groundY, height: spot.height, depth: WELCOME_CAST.depth,
    }).then((puppet) => {
      if (!this.alive || !member.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      this.puppets.push(puppet);
      member.addAt(puppet, 1);
      enableHitOnClick(scene, puppet);
      if (!animate) return;
      // 차례로 톡 떨어져 선다 — 넷이 한꺼번에 서면 단체 사진처럼 굳어 보인다.
      const y = puppet.y;
      puppet.setAlpha(0).setY(y - 36);
      scene.tweens.add({ targets: puppet, y, alpha: 1, duration: 320, delay: index * WELCOME_CAST.enterStagger, ease: "Back.Out" });
    }).catch(() => undefined);

    this.addPlate(member, relicId, index);
    if (!animate) return;
    member.setAlpha(0);
    scene.tweens.add({ targets: member, alpha: 1, duration: 260, delay: index * WELCOME_CAST.enterStagger });
  }

  private addPlate(member: Phaser.GameObjects.Container, relicId: string, index: number): void {
    const { scene } = this;
    const relic = getRelic(relicId);
    const spot = WELCOME_CAST.spots[index];
    const { plate, badge, magnifier } = WELCOME_CAST;
    const y = welcomeCastPlateY(index);
    const shape = slantedRect(plate.width, plate.height, plate.slant);
    member.add(drawLayer(scene, spot.x + 4, y + 6, shape, { fill: 0x000000, alpha: 0.4, shadow: false }));
    member.add(drawLayer(scene, spot.x, y, shape, { fill: 0x10151d, alpha: 0.88, edge: ELEMENT_TINT[relic.element], edgeAlpha: 0.95, edgeWidth: 3, shadow: false }));

    const tone = RARITY_TONE[relic.rarity];
    const rarity = scene.add.text(0, y, relic.rarity, textStyle({ role: "display", size: plate.raritySize, color: tone.ink }))
      .setOrigin(0, 0.5).setShadow(0, 0, tone.halo, 8, false, true);
    const name = scene.add.text(0, y, relic.name, textStyle({ role: "display", size: plate.nameSize, color: COLOR.ink })).setOrigin(0, 0.5);
    // 이름은 뱃지와 돋보기 사이에 선다. 긴 이름은 칸을 넓히지 않고 가로로만 누른다.
    const left = spot.x + badge.dx + badge.size / 2 + 4;
    const right = spot.x + magnifier.dx - magnifier.size;
    squeezeTextToWidth(name, right - left - rarity.width - 8);
    const lineWidth = rarity.width + 8 + name.displayWidth;
    rarity.x = (left + right) / 2 - lineWidth / 2;
    name.x = rarity.x + rarity.width + 8;
    member.add([rarity, name]);
    member.add(new AffinityBadge(scene, spot.x + badge.dx, y, ELEMENT_ICON[relic.element], badge.size, 0.6));

    const glass = scene.add.container(spot.x + magnifier.dx, y);
    glass.add(drawGlyph(scene, "magnifier", 0, 0, magnifier.size, 0xdfe6ee, 0.9, 4));
    member.add(glass);
    const hit = scene.add.rectangle(glass.x, y, magnifier.hit, magnifier.hit, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(glass));
    hit.on("pointerout", () => pressOut(glass, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(glass); this.onInspect(relicId); });
    member.add(hit);
  }
}
