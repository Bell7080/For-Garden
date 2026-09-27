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
import { WELCOME_CAST, welcomeCastTagY } from "./welcomeCastLayout";

/**
 * 첫 복원 연구 원화(빈 방) 위에 서는 SSR 넷 — 크게 엇갈려 선 SD와 머리 위에 떠 있는 이름표.
 *
 * 원화에 인물이 그려져 있지 않아 **누가 나오는 판인지를 이 넷이 말한다.** 이름표는 발밑의 판이
 * 아니라 SD 머리 위에 둥실 떠서 꼬리로 제 주인을 가리키는 표다 — 면은 그 개체의 속성 색을 눌러
 * 칠하고, 왼쪽 끝에 속성 뱃지, 왼쪽 위 모서리에 희귀도 색 보석 칩(SSR), 오른쪽 끝에 돋보기가
 * 걸린다. SD·이름표·돋보기 어디를 눌러도 그 개체가 톡 뛰고 정보창(얻기 전이면 실루엣 미리보기)이
 * 열린다 — 픽업 배너의 「캐릭터 정보」 버튼과 같은 길이다.
 *
 * Puppet은 비동기로 서므로, 도착했을 때 이 판이 이미 걷혔으면 그 자리에서 놓는다.
 */
export class WelcomeBannerCast {
  private readonly root: Phaser.GameObjects.Container;
  private readonly puppets = new Map<number, PuppetCreature>();
  private readonly animate: boolean;
  private alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    relicIds: readonly string[],
    private readonly onInspect: (relicId: string) => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(WELCOME_CAST.depth);
    this.animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
    // 뒷줄부터 세워 앞줄 SD와 이름표가 그 위에 겹친다.
    const members = relicIds.slice(0, WELCOME_CAST.spots.length).map((relicId, index) => ({ relicId, index }));
    members.sort((a, b) => WELCOME_CAST.spots[a.index].groundY - WELCOME_CAST.spots[b.index].groundY);
    for (const { relicId, index } of members) this.addMember(relicId, index);
  }

  destroy(): void {
    this.alive = false;
    for (const puppet of this.puppets.values()) puppet.destroy();
    this.puppets.clear();
    this.root.destroy(true);
  }

  private addMember(relicId: string, index: number): void {
    const { scene } = this;
    const spot = WELCOME_CAST.spots[index];
    const member = scene.add.container(0, 0);
    this.root.add(member);

    addSdFootShadow(scene, spot.x, spot.groundY, spot.height * WELCOME_CAST.shadowRatio, member);
    // SD 자리 전체가 눌린다 — 작은 돋보기만 받으면 손이 SD를 누르고도 아무 일이 없다.
    const hit = scene.add.rectangle(spot.x, spot.groundY - spot.height / 2, spot.height * 0.62, spot.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.inspect(relicId, index));
    member.add(hit);

    const delay = index * WELCOME_CAST.enterStagger;
    void spawnPuppet(scene, relicAppearanceManager.sdAssetFor(relicId), {
      x: spot.x, groundY: spot.groundY, height: spot.height, flipX: spot.flipX, depth: WELCOME_CAST.depth,
    }).then((puppet) => {
      if (!this.alive || !member.active) { puppet.destroy(); return; }
      puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      this.puppets.set(index, puppet);
      member.addAt(puppet, 1);
      enableHitOnClick(scene, puppet);
      if (!this.animate) return;
      // 차례로 톡 떨어져 선다 — 넷이 한꺼번에 서면 단체 사진처럼 굳어 보인다.
      const y = puppet.y;
      puppet.setAlpha(0).setY(y - 48);
      scene.tweens.add({ targets: puppet, y, alpha: 1, duration: 360, delay, ease: "Back.Out" });
    }).catch(() => undefined);

    const tag = this.addTag(relicId, index);
    member.add(tag);
    if (!this.animate) return;
    tag.setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: tag, scale: 1, alpha: 1, duration: 320, delay: delay + 200, ease: "Back.Out" });
    // 이름표는 머리 위에 둥실 떠 있다. 넷이 같은 박자로 오르내리면 한 판처럼 굳어 보여 박자를 어긋낸다.
    const { bob } = WELCOME_CAST.tag;
    scene.tweens.add({
      targets: tag, y: tag.y - bob.distance, duration: bob.duration, yoyo: true, repeat: -1, ease: "Sine.InOut",
      delay: delay + 520 + index * 230,
    });
  }

  /** 누르면 그 개체가 톡 뛰고 정보창이 열린다. 뛰는 것을 기다리지 않는다. */
  private inspect(relicId: string, index: number): void {
    const puppet = this.puppets.get(index);
    if (puppet && this.animate && !this.scene.tweens.isTweening(puppet)) {
      const { hop } = WELCOME_CAST;
      this.scene.tweens.add({ targets: puppet, y: puppet.y - hop.height, duration: hop.duration, yoyo: true, ease: "Quad.Out" });
    }
    this.onInspect(relicId);
  }

  /** 머리 위 이름표 — 속성 색 면 + 꼬리 + 속성 뱃지 + SSR 보석 칩 + 이름 + 돋보기. */
  private addTag(relicId: string, index: number): Phaser.GameObjects.Container {
    const { scene } = this;
    const relic = getRelic(relicId);
    const { tag: spec } = WELCOME_CAST;
    const tint = ELEMENT_TINT[relic.element];
    const face = shade(tint, spec.shade);
    const tag = scene.add.container(WELCOME_CAST.spots[index].x, welcomeCastTagY(index));
    const shape = slantedRect(spec.width, spec.height, spec.slant);

    // 꼬리는 면과 같은 색으로 아래를 가리키고, 그림자는 면과 함께 아래로 한 겹 떨어진다.
    const tail = scene.add.graphics();
    const { width: tw, height: th } = spec.tail;
    const tailTop = spec.height / 2 - 2;
    tail.fillStyle(0x000000, 0.4).fillTriangle(-tw / 2 + 4, tailTop + 6, tw / 2 + 4, tailTop + 6, 4, tailTop + th + 6);
    tail.fillStyle(face, 0.96).fillTriangle(-tw / 2, tailTop, tw / 2, tailTop, 0, tailTop + th);
    tag.add(drawLayer(scene, 4, 6, shape, { fill: 0x000000, alpha: 0.42, shadow: false }));
    tag.add(tail);
    tag.add(drawLayer(scene, 0, 0, shape, { fill: face, alpha: 0.96, edge: tint, edgeAlpha: 1, edgeWidth: 4, shadow: false }));
    // 면 아래쪽에 옅은 한 줄 — 평평한 판이 아니라 떠 있는 표로 읽히게 하는 얇은 반사.
    const shine = scene.add.graphics();
    shine.lineStyle(2, 0xffffff, 0.18).lineBetween(-spec.width / 2 + spec.slant + 10, spec.height / 2 - 7, spec.width / 2 - 14, spec.height / 2 - 7);
    tag.add(shine);

    const { badge, rarity, magnifier } = spec;
    const left = badge.dx + badge.size / 2;
    const right = magnifier.dx - magnifier.radius;
    const name = scene.add.text((left + right) / 2, -1, relic.name, textStyle({ role: "display", size: spec.nameSize, color: COLOR.ink }))
      .setOrigin(0.5).setStroke("#05070a", 6).setShadow(0, 3, "#000000", 4, false, true);
    squeezeTextToWidth(name, right - left - 8);
    tag.add(name);
    tag.add(new AffinityBadge(scene, badge.dx, 0, ELEMENT_ICON[relic.element], badge.size, 0.7));

    // 희귀도는 모서리에 비스듬히 박힌 보석 칩이다 — 이름줄에 같은 크기로 끼우면 이름과 무게가 같아진다.
    const tone = RARITY_TONE[relic.rarity];
    const gem = scene.add.container(rarity.dx, rarity.dy).setAngle(rarity.angle);
    const gemShape = slantedRect(rarity.width, rarity.height, 8);
    gem.add(drawLayer(scene, 2, 3, gemShape, { fill: 0x000000, alpha: 0.45, shadow: false }));
    gem.add(drawLayer(scene, 0, 0, gemShape, { fill: tone.chip, alpha: 1, edge: 0xffffff, edgeAlpha: 0.7, edgeWidth: 2, shadow: false }));
    gem.add(scene.add.text(0, 0, relic.rarity, textStyle({ role: "display", size: rarity.size, color: tone.ink }))
      .setOrigin(0.5).setStroke("#2a1600", 4).setShadow(0, 0, tone.halo, 8, false, true));
    tag.add(gem);

    const glass = scene.add.container(magnifier.dx, 0);
    const glassShape = slantedRect(magnifier.radius * 2, magnifier.radius * 2, 7);
    glass.add(drawLayer(scene, 2, 3, glassShape, { fill: 0x000000, alpha: 0.45, shadow: false }));
    glass.add(drawLayer(scene, 0, 0, glassShape, { fill: 0x10151d, alpha: 0.95, edge: tint, edgeAlpha: 1, edgeWidth: 2, shadow: false }));
    glass.add(drawGlyph(scene, "magnifier", 0, 0, magnifier.glyph, 0xf1f5f9, 1, 4));
    tag.add(glass);

    // 이름표 전체가 눌린다. 돋보기는 눌린 손맛만 따로 받는다.
    const hit = scene.add.rectangle(0, 0, spec.width + magnifier.radius * 2, spec.height + 20, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(glass));
    hit.on("pointerout", () => pressOut(glass, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(glass); this.inspect(relicId, index); });
    tag.add(hit);
    return tag;
  }
}

/** 색을 `amount`만큼 검정 쪽으로 누른다. */
function shade(color: number, amount: number): number {
  const keep = 1 - amount;
  const r = Math.round(((color >> 16) & 0xff) * keep);
  const g = Math.round(((color >> 8) & 0xff) * keep);
  const b = Math.round((color & 0xff) * keep);
  return (r << 16) | (g << 8) | b;
}
