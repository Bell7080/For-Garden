import Phaser from "phaser";
import { t } from "../i18n";
import { contentUnlockedBetween, type ContentId } from "../core/contentUnlock";
import { PLAYER_LEVEL_UP_REWARD } from "../core/playerLevel";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { staminaMaxForResearchLevel } from "../core/stamina";
import { findItem } from "../data/items";
import { PROFILE_FRAMES } from "../data/profileFrames";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { settingsManager } from "../managers/SettingsManager";
import { spawnPuppet } from "../puppets/assets";
import type { PortraitAssetId } from "../core/types";
import { session } from "../state/session";
import { drawIcon } from "./BottomNav";
import { Button } from "./Button";
import { latinEcho } from "./latinEcho";
import { ExpeditionEntryButton } from "./ExpeditionEntryButton";
import { contentNameKey } from "./contentLock";
import { drawGlyph, type GlyphName } from "./glyphs";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { LEVEL_UP_POPUP as L, levelUpPopupHeight, levelUpRewardHeight, levelUpUnlockCells } from "./levelUpPopupLayout";
import type { PopupLayer } from "./PopupLayer";
import { ProfileAvatar } from "./ProfileAvatar";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { addSectionTitle } from "./SectionTitle";
import { addGlowStar } from "./stars";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface LevelUpPopupOptions {
  from: number;
  to: number;
  /** 새 테두리 칸이 씌울 얼굴 — 프로필 카드와 같은 값이다. */
  portraitAssetId?: PortraitAssetId;
  fallback: string;
  /** 판이 닫힌 뒤 — 로비는 여기서 열림 연출과 출석을 차례로 잇는다. */
  onClosed: () => void;
}

/**
 * 열린 콘텐츠의 그림. 로비·출격판에서 그 콘텐츠를 여는 버튼이 쓰는 그림과 같은 것을 고른다 — 다른 그림이면
 * 「열렸다」는 말을 듣고도 어느 버튼을 눌러야 하는지 이어지지 않는다. 입구가 아이콘이 아니라 **버튼 판**인 콘텐츠
 * (로비의 교류·발굴, 출격판의 대작전·현상수배)는 그 판을 작게 본떠 세운다(`entrance`).
 */
type ContentPicture =
  | { glyph: GlyphName }
  | { nav: "lab" | "archaeology" }
  | { entrance: "lobby" }
  | { entrance: "sortie"; artKey: string; split: "left" | "right" };

const CONTENT_PICTURE: Readonly<Record<ContentId, ContentPicture>> = {
  excavation: { entrance: "lobby" },
  shop: { glyph: "shop" },
  trade: { glyph: "exchange" },
  cakeOperation: { entrance: "sortie", artKey: "content-cake-entry", split: "left" },
  bounty: { entrance: "sortie", artKey: "content-bounty-entry", split: "right" },
  friends: { glyph: "friends" },
  interaction: { entrance: "lobby" },
  duel: { glyph: "arena-tier" },
  guild: { glyph: "guild" },
  raid: { glyph: "expedition-boss" },
  expedition: { glyph: "expedition" },
  lab: { nav: "lab" },
  archaeology: { nav: "archaeology" },
};

type Unlock = { kind: "content"; id: ContentId } | { kind: "frame"; frameId: string; name: string };

/**
 * 연구원 레벨업 판 — 여러 레벨이 한꺼번에 올라도 **한 장**에 `LV.1 › LV.4`로 모아 알린다.
 *
 * 영웅 줄에는 애착 렐릭 SD가 통통 뛰며 축하하고, 큰 LV 둘레에 네 갈래 별이 반짝인다. 받은 것은 글줄이 아니라
 * **액자**(에너지 드링크 · 스테미나 상한)로, 열린 것은 그 콘텐츠의 **그림 칸**과 새 테두리를 씌운 얼굴로 선다 —
 * 줄글로 「새 콘텐츠 「교류」」를 늘어놓던 때는 무엇이 열렸는지 그림으로 이어지지 않았다.
 * 고를 것이 없는 영수증이라 화면 아무 곳이나 눌러 닫는다.
 */
export function openLevelUpPopup(scene: Phaser.Scene, popups: PopupLayer, options: LevelUpPopupOptions): void {
  const { from, to } = options;
  const unlocks: Unlock[] = [
    ...contentUnlockedBetween(from, to).map((entry) => ({ kind: "content" as const, id: entry.id })),
    ...PROFILE_FRAMES.filter((frame) => frame.unlockLevel > from && frame.unlockLevel <= to)
      .map((frame) => ({ kind: "frame" as const, frameId: frame.id, name: frame.displayName })),
  ];
  const height = levelUpPopupHeight(unlocks.length);
  const reduced = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
  let hint: Phaser.GameObjects.Text | undefined;
  popups.open({
    width: L.width, height, title: t("profile.levelUp.title"),
    dim: true, dimAlpha: 0.62, closeOnBackdrop: true, closeOnBody: true, hideCloseButton: true,
    onClose: () => { hint?.destroy(); options.onClosed(); },
  }, (body) => {
    // 로비의 우하단 뒤로가기(2100)보다 위에 선다.
    body.parentContainer?.setDepth(4000);
    let y = -height / 2 + L.topRoom;
    buildHero(scene, body, y, from, to, reduced);
    y += L.hero.height + L.section.gap;
    buildRewards(scene, body, y, from, to, reduced);
    y += levelUpRewardHeight();
    if (unlocks.length > 0) buildUnlocks(scene, body, y + L.section.gap, unlocks, options, reduced);
    hint = scene.add.text(scene.scale.width / 2, scene.scale.height - 130, t("reward.tapHint"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5).setAlpha(0.62).setDepth(4000).setShadow(0, 3, "#000000", 4, false, true);
  });
}

/** 애착 렐릭 SD + `LV.n ›` + 큰 `LV.m` + 반짝임. */
function buildHero(scene: Phaser.Scene, body: Phaser.GameObjects.Container, top: number, from: number, to: number, reduced: boolean): void {
  const H = L.hero;
  // 큰 LV 뒤에 납작한 마름모 빛을 깐다 — 동그란 후광은 쓰지 않는다.
  const glowY = top + H.toY;
  const glow = drawLayer(scene, H.levelX, glowY, [
    0, -110, 260, 0, 0, 110, -260, 0,
  ], { fill: COLOR.accent, alpha: 0.12 });
  body.add(glow);
  if (!reduced) scene.tweens.add({ targets: glow, alpha: { from: 0.55, to: 1 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

  body.add(scene.add.text(H.levelX, top + H.fromY, `LV.${from}  ›`, textStyle({ role: "display", size: H.fromSize, color: COLOR.inkDim })).setOrigin(0.5));
  const big = scene.add.text(H.levelX, glowY, `LV.${to}`, textStyle({ role: "display", size: H.toSize, color: COLOR.accentText }))
    .setOrigin(0.5).setStroke("#05070a", 10).setShadow(0, 8, "#000000", 0, true, true);
  body.add(big);
  body.add(scene.add.text(H.levelX, top + H.gainY, t("profile.levelUp.gain", { count: to - from }), textStyle({ role: "emphasis", size: H.gainSize, color: COLOR.sortieText })).setOrigin(0.5));
  if (!reduced) {
    big.setScale(0.4).setAlpha(0);
    scene.tweens.add({ targets: big, scale: 1, alpha: 1, duration: 520, ease: "Back.easeOut" });
  }

  H.sparkles.forEach((spot, index) => {
    const star = scene.add.container(H.levelX + spot.x, glowY + spot.y);
    addGlowStar(scene, star, 0, 0, spot.size, undefined, 4);
    body.add(star);
    if (reduced) return;
    star.setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: star, scale: 1, alpha: 1, duration: 520, delay: 180 + index * 140, yoyo: true, hold: 380, repeat: -1, repeatDelay: 600 + index * 170, ease: "Sine.easeInOut" });
  });

  // 애착 렐릭이 왼쪽에서 통통 뛰며 함께 축하한다. 원화가 늦으면 그 자리만 비고 판은 그대로 선다.
  const groundY = top + H.height * H.sd.groundRatio;
  addSdFootShadow(scene, H.sd.x, groundY, H.sd.shadow, body);
  const stage = scene.add.container(0, 0);
  body.add(stage);
  void spawnPuppet(scene, relicAppearanceManager.sdAssetFor(session.favorite), { x: H.sd.x, groundY, height: H.sd.height, depth: 0 }).then((puppet) => {
    if (!stage.active) { puppet.destroy(); return; }
    puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
    puppet.disableInteractive();
    stage.add(puppet);
    puppet.setAlpha(0);
    scene.tweens.add({ targets: puppet, alpha: 1, duration: 240 });
    const hop = startPuppetHop(scene, puppet, 0);
    stage.once(Phaser.GameObjects.Events.DESTROY, () => hop.stop());
  }).catch((error) => console.warn("레벨업 SD 표시 실패", error));
}

/** 레벨업 보상 — 에너지 드링크 액자 + 스테미나 상한 액자. */
function buildRewards(scene: Phaser.Scene, body: Phaser.GameObjects.Container, top: number, from: number, to: number, reduced: boolean): void {
  const R = L.reward;
  addSectionTitle(scene, -L.width / 2 + 56, top + L.section.titleSize / 2, t("profile.levelUp.rewards"), { parent: body, size: L.section.titleSize });
  const frameY = top + L.section.titleRoom + R.frame / 2;
  const item = findItem(PLAYER_LEVEL_UP_REWARD.itemId);
  const cells: Array<{ texture: string; amount?: string; caption: string }> = [];
  if (item?.icon.kind === "asset") cells.push({ texture: item.icon.key, amount: String((to - from) * PLAYER_LEVEL_UP_REWARD.quantity), caption: item.name });
  // 상한은 액자 수로 적지 않는다 — 아래 줄이 「스테미나 상한 +N」으로 이미 말한다(한 창에 같은 수를 두 번 적지 않는다).
  cells.push({ texture: "currency-stamina", caption: t("profile.levelUp.stamina", { amount: staminaMaxForResearchLevel(to) - staminaMaxForResearchLevel(from) }) });
  const total = cells.length * R.frame + (cells.length - 1) * R.spacing;
  cells.forEach((cell, index) => {
    const x = -total / 2 + R.frame / 2 + index * (R.frame + R.spacing);
    const holder = scene.add.container(x, frameY);
    body.add(holder);
    addFramedIcon(scene, holder, 0, 0, R.frame, cell.texture, cell.amount ? { amount: cell.amount } : {});
    const caption = squeezeTextToWidth(scene.add.text(0, R.frame / 2 + R.captionGap, cell.caption, textStyle({ role: "emphasis", size: R.captionSize, color: COLOR.ink })).setOrigin(0.5), R.captionWidth);
    holder.add(caption);
    if (reduced) return;
    holder.setAlpha(0).setY(frameY - 40);
    scene.tweens.add({ targets: holder, alpha: 1, y: frameY, duration: 280, delay: 320 + index * 120, ease: "Back.Out" });
  });
}

/**
 * 입구 버튼 판의 축소판. 로비·출격판과 **같은 프리팹**을 칸 크기로 세우고 입력만 끈다 — 비슷하게 따로 그리면
 * 버튼 양식이 바뀔 때 이 판만 옛 모습으로 남는다.
 */
function entranceMiniature(scene: Phaser.Scene, id: ContentId, picture: Extract<ContentPicture, { entrance: string }>): Phaser.GameObjects.Container {
  const U = L.unlock;
  const label = t(contentNameKey(id));
  const mini: Phaser.GameObjects.Container = picture.entrance === "lobby"
    ? new Button(scene, 0, U.entranceY, {
      width: U.width - 22, height: 74, label, sub: id === "excavation" ? t("lobby.excavation.sub") : latinEcho(label, "EXCHANGE"), fontSize: 26, subFontSize: 13,
      perspective: "left", tilt: 6, accentColor: COLOR.exchange, accentTextColor: COLOR.exchangeText, onClick: () => undefined,
    })
    : new ExpeditionEntryButton(scene, 0, U.entranceY, {
      width: U.width - 22, height: 118, label, labelSize: 26, status: "", split: picture.split,
      artKey: picture.artKey, accentColor: COLOR.exchange, accentTextColor: COLOR.exchangeText, onClick: () => undefined,
    });
  const inert = (object: Phaser.GameObjects.GameObject): void => {
    if (object.input) object.disableInteractive();
    if (object instanceof Phaser.GameObjects.Container) object.each(inert);
  };
  inert(mini);
  // 칸이 입구보다 훨씬 좁다 — 긴 이름(치즈케이크 대작전)은 판 안에 들도록 가로로만 누른다.
  mini.each((child: Phaser.GameObjects.GameObject) => {
    if (child instanceof Phaser.GameObjects.Text && child.text === label) squeezeTextToWidth(child, U.width - 60);
  });
  return mini;
}

/** 새로 열린 것 — 콘텐츠는 그 입구의 그림, 테두리는 지금 얼굴에 씌운 모습으로 선다. */
function buildUnlocks(scene: Phaser.Scene, body: Phaser.GameObjects.Container, top: number, unlocks: readonly Unlock[], options: LevelUpPopupOptions, reduced: boolean): void {
  const U = L.unlock;
  addSectionTitle(scene, -L.width / 2 + 56, top + L.section.titleSize / 2, t("profile.levelUp.unlocks"), { parent: body, size: L.section.titleSize });
  const gridTop = top + L.section.titleRoom;
  levelUpUnlockCells(unlocks.length).forEach((cell, index) => {
    const unlock = unlocks[index]!;
    const y = gridTop + cell.row * (U.height + U.gapY) + U.height / 2;
    const tile = scene.add.container(cell.x, y);
    body.add(tile);
    const tone = unlock.kind === "content" ? COLOR.sortie : COLOR.accent;
    const picture = unlock.kind === "content" ? CONTENT_PICTURE[unlock.id] : undefined;
    const entrance = picture !== undefined && "entrance" in picture;
    tile.add(drawLayer(scene, 0, 0, chipPoints(U.width, U.height, { bevel: { topLeft: 26, bottomRight: 26 } }), { fill: 0x0b0f15, alpha: 0.94, edge: tone, edgeAlpha: 0.85 }));
    // 그림 뒤의 옅은 마름모 빛 — 칸이 「무엇이 새로 생겼다」로 먼저 읽히게 한다. 버튼 판을 본뜬 칸은 판이 그 몫을 한다.
    if (!entrance) tile.add(drawLayer(scene, 0, U.glyphY, [
      0, -58, 70, 0, 0, 58, -70, 0,
    ], { fill: tone, alpha: 0.14 }));
    if (unlock.kind === "content" && picture) {
      if ("glyph" in picture) tile.add(drawGlyph(scene, picture.glyph, 0, U.glyphY, U.glyph, tone, 1, 5));
      else if ("nav" in picture) tile.add(drawIcon(scene, picture.nav, 0, U.glyphY, tone).setScale(1.7));
      else tile.add(entranceMiniature(scene, unlock.id, picture));
    } else if (unlock.kind === "frame") {
      tile.add(new ProfileAvatar(scene, 0, U.glyphY, { size: U.avatar, frameId: unlock.frameId, portraitAssetId: options.portraitAssetId, fallback: options.fallback }));
    }
    const name = unlock.kind === "content" ? t(contentNameKey(unlock.id)) : unlock.name;
    // 버튼 판을 본뜬 칸은 판이 이미 이름을 적고 있다 — 아래에 한 번 더 적지 않는다.
    if (!entrance) tile.add(squeezeTextToWidth(scene.add.text(0, U.nameY, name, textStyle({ role: "emphasis", size: U.nameSize, color: unlock.kind === "content" ? COLOR.sortieText : COLOR.accentText })).setOrigin(0.5), U.width - 24));
    // 왼쪽 위 깎인 모서리를 피해 오른쪽 위에 「NEW」 표식을 단다.
    const badge = scene.add.container(U.width / 2 - 40, -U.height / 2 + 20);
    badge.add(drawLayer(scene, 0, 0, chipPoints(62, 28, { bevel: { topLeft: 8, bottomRight: 8 } }), { fill: tone, alpha: 0.95 }));
    badge.add(scene.add.text(0, 0, "NEW", textStyle({ role: "display", size: 18, color: "#05070a" })).setOrigin(0.5));
    tile.add(badge);
    if (reduced) return;
    tile.setScale(0.6).setAlpha(0);
    scene.tweens.add({ targets: tile, scale: 1, alpha: 1, duration: 320, delay: 560 + index * 110, ease: "Back.easeOut" });
  });
}
