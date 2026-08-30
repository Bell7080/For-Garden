import Phaser from "phaser";
import { profileAvatarContent, type PlayerProfileDisplay, type PublicProfileModifier } from "../state/playerProfile";
import { HoloBar, chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { setDebugPlayerProfileOpen } from "../debug";
import { compactProfileText, PLAYER_PROFILE_LAYOUT } from "./playerProfileLayout";
import { PortraitCard, relicCardTint } from "./PortraitCard";
import { getRelic } from "../data/relics";
import { drawGlyph } from "./glyphs";

/** rarity는 의미 데이터이고 colorRole은 UI 토큰 선택자이므로 화면은 임의 색상 값을 받지 않는다. */
function modifierColor(modifier: PublicProfileModifier): number {
  return { neutral: COLOR.inkDimHex, research: COLOR.raritySR, expedition: COLOR.sortie, prestige: COLOR.raritySSR }[modifier.colorRole];
}

/** 공개 프로필 정보만 공용 PopupLayer에 배치하는 작은 읽기 전용 정보창이다. */
export class PlayerProfilePopup {
  private opened = false;

  constructor(private readonly scene: Phaser.Scene, private readonly layer: PopupLayer, private readonly profile: PlayerProfileDisplay, private readonly onClose: () => void) {}

  /** 아바타→이름/레벨→경험치→수식어 순으로 훑도록 헤더를 한 영역 안에 조립한다. */
  open(): void {
    if (this.opened || this.layer.isOpen) return;
    this.opened = true;
    setDebugPlayerProfileOpen(true);
    const layout = PLAYER_PROFILE_LAYOUT;
    this.layer.open({ ...layout.popup, title: "플레이어 정보", dim: true, closeOnBackdrop: true, onClose: () => {
      this.opened = false; setDebugPlayerProfileOpen(false); this.onClose();
    } }, (body) => {
      const avatar = profileAvatarContent(this.profile, (key) => this.scene.textures.exists(key));
      const avatarShape = chipPoints(layout.header.avatarSize, layout.header.avatarSize, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
      // profileFrameKey는 내부 키로 출력하지 않고, 알려진 프레임만 실제 윗변 장식 색으로 해석한다.
      const frameColor = this.profile.profileFrameKey === "holo-cyan" ? COLOR.raritySR : COLOR.accent;
      body.add(drawLayer(this.scene, layout.header.avatarX, layout.header.avatarY, avatarShape, { fill: 0x1f2632, alpha: HOLO.glass, edge: frameColor, edgeAlpha: 0.8, edgeWidth: 3 }));
      if (avatar.assetKey) body.add(this.scene.add.image(layout.header.avatarX, layout.header.avatarY, avatar.assetKey).setDisplaySize(116, 116));
      else body.add(this.scene.add.text(layout.header.avatarX, layout.header.avatarY, avatar.fallback, textStyle({ role: "display", size: 52, color: COLOR.accentText })).setOrigin(0.5));

      body.add(this.scene.add.text(layout.header.textLeft, -226, compactProfileText(this.profile.displayName, 18), textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(layout.header.textRight, -181, `LV.${Math.max(1, this.profile.level).toLocaleString()}`, textStyle({ role: "emphasis", size: 27 })).setOrigin(1, 0.5));
      const experience = new HoloBar(this.scene, layout.experience.x, layout.experience.y, layout.experience.width, layout.experience.height, { color: COLOR.accent, trackAlpha: 0.8, outline: true }).addTo(body);
      experience.setValue(this.profile.experience / Math.max(1, this.profile.experienceToNext));
      body.add(this.scene.add.text(layout.header.textRight, layout.experience.valueY, `${this.profile.experience.toLocaleString()} / ${this.profile.experienceToNext.toLocaleString()} EXP`, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(1, 0.5));

      // 빈 상태에는 개발용 안내 행을 만들지 않는다. 여러 칩도 한 줄/상한 3개라 본문 bounds를 침범하지 않는다.
      const count = this.profile.equippedModifiers.length;
      this.profile.equippedModifiers.forEach((modifier, index) => {
        const x = (index - (count - 1) / 2) * (layout.modifiers.width + layout.modifiers.gap);
        const color = modifierColor(modifier);
        body.add(drawLayer(this.scene, x, layout.modifiers.y, chipPoints(layout.modifiers.width, layout.modifiers.height, { bevel: { topLeft: 14, topRight: 0, bottomRight: 14, bottomLeft: 0 } }), { fill: 0x202832, alpha: HOLO.glassLight, edge: color, edgeAlpha: 0.72 }));
        body.add(this.scene.add.text(x, layout.modifiers.y, compactProfileText(modifier.displayName, 10), textStyle({ role: "emphasis", size: 18, color: `#${color.toString(16).padStart(6, "0")}` })).setOrigin(0.5));
      });

      const stats = this.profile.competitiveStats;
      const addStatChip = (x: number, y: number, label: string, value: string, glyph?: "arena-tier", textOffset = -86): void => {
        // 네 기록은 같은 크기/타이포그래피의 유리 칩으로 두어 어느 콘텐츠도 임의로 우선하지 않는다.
        body.add(drawLayer(this.scene, x, y, chipPoints(layout.stats.width, layout.stats.height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } }), { fill: 0x202832, alpha: HOLO.glassLight, edge: COLOR.inkDimHex, edgeAlpha: 0.45 }));
        if (glyph) body.add(drawGlyph(this.scene, glyph, x - 125, y, 48, COLOR.accent));
        body.add(this.scene.add.text(x + textOffset, y - 28, label, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(x + textOffset, y + 18, compactProfileText(value, 16), textStyle({ role: "emphasis", size: 24 })).setOrigin(0, 0.5));
      };
      if (stats.favoriteRelic) {
        const relic = getRelic(stats.favoriteRelic.relicId);
        addStatChip(layout.stats.leftX, layout.stats.firstY, "애착 렐릭", stats.favoriteRelic.displayName, undefined, -50);
        // 안전한 공개 portraitAssetId를 공용 PortraitCard에 전달하며 별도 크롭/원화 fallback을 만들지 않는다.
        body.add(new PortraitCard(this.scene, layout.stats.leftX - 112, layout.stats.firstY, { width: 92, height: 112, portraitAssetId: stats.favoriteRelic.portraitAssetId, tint: relicCardTint(relic) }));
      } else addStatChip(layout.stats.leftX, layout.stats.firstY, "애착 렐릭", "미지정");
      if (stats.arenaTier) addStatChip(layout.stats.rightX, layout.stats.firstY, "결투장 티어", stats.arenaTier.displayName, "arena-tier");
      addStatChip(layout.stats.leftX, layout.stats.secondY, "최대 클리어", stats.highestStage?.displayValue ?? "기록 없음");
      addStatChip(layout.stats.rightX, layout.stats.secondY, stats.expedition.label, stats.expedition.score.toLocaleString());

      const addValue = (y: number, label: string, value: string): void => {
        body.add(this.scene.add.text(-330, y, label, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.scene.add.text(330, y, compactProfileText(value, 24), textStyle({ role: "emphasis", size: 26 })).setOrigin(1, 0.5));
      };
      addValue(layout.rows.firstY, "공개 ID", this.profile.displayId);
    });
  }

  /** 씬 종료나 외부 조작도 PopupLayer의 단일 닫기 경로를 사용하게 한다. */
  close(): void { if (this.opened) this.layer.closeTop(); }
}
