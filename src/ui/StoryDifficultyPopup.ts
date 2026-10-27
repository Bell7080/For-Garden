import Phaser from "phaser";
import { STORY_DIFFICULTIES, STORY_DIFFICULTY, isStoryDifficultyUnlocked, type StoryDifficulty } from "../core/storyDifficulty";
import { t } from "../i18n";
import { battleAssetFor, sdAssetFor, spawnPuppet, type PuppetAsset } from "../puppets/assets";
import { session } from "../state/session";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { addLockCover } from "./contentLock";
import { ExpeditionEntryButton, sortieEntryBevel, sortieEntrySdSpot } from "./ExpeditionEntryButton";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, drawShapeOutline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { startPuppetHop } from "./puppetHop";
import { addGlowStar } from "./stars";
import { addRankPips } from "./StoryDifficultyIcon";
import { Button } from "./Button";
import { COLOR, textStyle } from "./theme";

/**
 * 난이도마다 서는 무대 — 출격판 칸과 같은 원화 버튼(`ExpeditionEntryButton`)에 **그 난이도의 색으로 물든 원화**와
 * SD 하나를 세운다. 쉬움은 아군 토리카가 반기고, 보통은 공멸의 토비, 어려움은 1-10을 지키던 코마가 선다 —
 * 오르는 사다리가 그림으로도 읽힌다. 원화는 스토리 입구와 같은 그림이고 색만 짙어진다.
 */
export const STORY_DIFFICULTY_STAGE: Readonly<Record<StoryDifficulty, { artTint: number; sd: () => PuppetAsset; side: "left" | "right"; rank: number }>> = {
  easy: { artTint: 0xfff2d2, sd: () => sdAssetFor("torika"), side: "left", rank: 1 },
  normal: { artTint: 0xffc49a, sd: () => battleAssetFor("toby"), side: "right", rank: 2 },
  hard: { artTint: 0xff8e98, sd: () => battleAssetFor("koma"), side: "left", rank: 3 },
};

/** 난이도 고르기 판·개방 축하 판의 자리. 높이는 칸 수에서 거꾸로 구한다. */
export const STORY_DIFFICULTY_PICKER = {
  width: 900,
  // 칸 사이는 SD 머리가 윗변 밖으로 빠져나오는 높이만큼 벌린다 — 좁으면 아래 칸의 머리가 위 칸의 글을 덮는다.
  card: { width: 800, height: 220, gap: 108 },
  introY: 92,
  firstCardTop: 170,
  bottomPad: 52,
  sdShadow: { color: 0x05070a, alpha: 0.42 },
} as const;

export function storyDifficultyPickerHeight(): number {
  const P = STORY_DIFFICULTY_PICKER;
  return P.firstCardTop + STORY_DIFFICULTIES.length * P.card.height + (STORY_DIFFICULTIES.length - 1) * P.card.gap + P.bottomPad;
}

/**
 * 난이도 칸 하나 — 원화 버튼 + 그 칸에 갇힌 SD(그림자 한 겹과 함께) + 난이도 마름모. 잠긴 칸은 덮개가 막고
 * SD는 가라앉혀 선다. SD는 판(`owner`)이 소유해 판이 닫히면 늦게 도착한 것도 남지 않는다.
 */
function addDifficultyCard(
  scene: Phaser.Scene, owner: Phaser.GameObjects.Container, y: number, difficulty: StoryDifficulty,
  options: { status: string; locked?: string; selected?: boolean; hop?: boolean; onClick: () => void },
): ExpeditionEntryButton {
  const P = STORY_DIFFICULTY_PICKER;
  const tone = STORY_DIFFICULTY[difficulty];
  const stage = STORY_DIFFICULTY_STAGE[difficulty];
  const card = new ExpeditionEntryButton(scene, 0, y, {
    width: P.card.width, height: P.card.height, label: t(`storyDifficulty.${difficulty}`), labelSize: 56, status: options.status, statusSize: 24, statusWrap: 470,
    artKey: "content-story-entry", artTint: stage.artTint, accentColor: tone.color, accentTextColor: tone.text, sdSide: stage.side, onClick: options.onClick,
  });
  owner.add(card);
  // 난이도 마름모 — 글자가 선 쪽의 위 구석.
  const pipX = stage.side === "left" ? P.card.width / 2 - 90 : -P.card.width / 2 + 120;
  owner.add(addRankPips(scene, pipX, y - P.card.height / 2 + 40, 30, stage.rank, tone.color));
  if (options.selected) {
    // 지금 고른 칸 — 테두리를 한 겹 더 굵게 두르고 마름모 옆에 체크가 선다.
    owner.add(drawShapeOutline(scene, 0, y, chipPoints(P.card.width + 12, P.card.height + 12, { bevel: sortieEntryBevel(P.card.height + 12) }), { color: tone.color, alpha: 0.95, width: 5 }));
    const checkX = pipX + (stage.side === "left" ? -62 : 62);
    owner.add(drawGlyph(scene, "check", checkX + 2, y - P.card.height / 2 + 43, 36, 0x000000, 0.7));
    owner.add(drawGlyph(scene, "check", checkX, y - P.card.height / 2 + 40, 36, tone.color));
  }
  if (options.locked) owner.add(addLockCover(scene, undefined, P.card.width, P.card.height, { bevel: sortieEntryBevel(P.card.height), text: true, message: options.locked }).setPosition(0, y));
  const spot = sortieEntrySdSpot(P.card.width, P.card.height, stage.side);
  const layer = scene.add.container(0, 0);
  owner.add(layer);
  const dim = options.locked !== undefined;
  const spawn = (shadow: boolean) => spawnPuppet(scene, stage.sd(), {
    x: spot.x + (shadow ? spot.shadowOffsetX : 0), groundY: y + spot.groundY + (shadow ? spot.shadowOffsetY : 0), height: spot.height, depth: 0,
  }).then((puppet) => {
    if (!layer.active) { puppet.destroy(); return undefined; }
    puppet.disableInteractive();
    puppet.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
    if (card.sdMask) puppet.setMask(card.sdMask);
    if (shadow) puppet.setTint(P.sdShadow.color).setAlpha(P.sdShadow.alpha * (dim ? 0.5 : 1));
    else if (dim) puppet.setAlpha(0.45);
    // 그림자를 먼저 깔아 본체가 늘 그 위에 온다.
    if (shadow) layer.addAt(puppet, 0); else layer.add(puppet);
    return puppet;
  }).catch((error) => { console.warn("난이도 SD 표시 실패", error); return undefined; });
  void Promise.all([spawn(true), spawn(false)]).then(([shadow, body]) => {
    if (!options.hop || dim || !body || !layer.active) return;
    const hops = [startPuppetHop(scene, body, 0), ...(shadow ? [startPuppetHop(scene, shadow, 0)] : [])];
    layer.once(Phaser.GameObjects.Events.DESTROY, () => hops.forEach((hop) => hop.stop()));
  });
  return card;
}

/** 난이도 고르기 판 — 출격판처럼 원화와 SD가 선 칸 셋. 닫기는 판 밖 우하단 공용 뒤로가기다. */
export function openStoryDifficultyPicker(scene: Phaser.Scene, popups: PopupLayer, selected: StoryDifficulty, onSelect: (difficulty: StoryDifficulty) => void): void {
  const P = STORY_DIFFICULTY_PICKER;
  const height = storyDifficultyPickerHeight();
  popups.open({ width: P.width, height, title: t("storyDifficulty.title"), dim: true, closeOnBackdrop: true, hideCloseButton: true, backButton: true }, (body, close) => {
    const top = -height / 2;
    body.add(scene.add.text(0, top + P.introY, t("storyDifficulty.intro"), textStyle({ role: "body", size: 26, color: COLOR.inkDim, wrap: 780, align: "center" })).setOrigin(0.5));
    STORY_DIFFICULTIES.forEach((difficulty, index) => {
      const unlocked = isStoryDifficultyUnlocked(difficulty, session.cleared);
      const y = top + P.firstCardTop + P.card.height / 2 + index * (P.card.height + P.card.gap);
      const locked = unlocked ? undefined : t("storyDifficulty.locked", { difficulty: t(`storyDifficulty.${difficulty === "hard" ? "normal" : "easy"}`) });
      addDifficultyCard(scene, body, y, difficulty, {
        status: unlocked ? t(`storyDifficulty.${difficulty}.detail`) : "", locked, selected: selected === difficulty,
        onClick: () => { if (unlocked) { close(); onSelect(difficulty); } },
      });
    });
  });
}

/**
 * 난이도 개방 축하 판 — 열린 난이도의 칸이 크게 서고 SD가 통통 뛰며, 둘레에 그 난이도 색의 별이 반짝인다.
 * 고를 것이 없는 알림이라 확인 하나만 선다.
 */
export function openStoryDifficultyUnlocked(scene: Phaser.Scene, popups: PopupLayer, difficulty: StoryDifficulty): Promise<void> {
  const P = STORY_DIFFICULTY_PICKER;
  const tone = STORY_DIFFICULTY[difficulty];
  const height = 760;
  const reduced = motionPolicy(session.settings).nonEssentialRepeatFactor === 0;
  return new Promise(resolve => popups.open({ width: P.width, height, title: t("storyDifficulty.unlocked.title"), dim: true, hideCloseButton: true, closeOnBackdrop: false, onClose: resolve }, (body, close) => {
    const top = -height / 2;
    const cardY = top + 90 + P.card.height / 2 + 20;
    // 칸 뒤로 그 난이도 색의 납작한 마름모 빛 — 동그란 후광은 쓰지 않는다.
    const glow = drawLayer(scene, 0, cardY, [0, -190, 470, 0, 0, 190, -470, 0], { fill: tone.color, alpha: 0.16, shadow: false });
    body.add(glow);
    if (!reduced) scene.tweens.add({ targets: glow, alpha: { from: 0.5, to: 1 }, duration: 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const card = addDifficultyCard(scene, body, cardY, difficulty, { status: t(`storyDifficulty.${difficulty}.detail`), hop: true, onClick: () => undefined });
    if (!reduced) { card.setScale(0.6).setAlpha(0); scene.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 460, ease: "Back.easeOut" }); }
    const sparkles = [{ x: -430, y: -120, size: 30 }, { x: 420, y: -100, size: 24 }, { x: -380, y: 120, size: 20 }, { x: 440, y: 110, size: 32 }];
    sparkles.forEach((spot, index) => {
      const star = scene.add.container(spot.x, cardY + spot.y);
      addGlowStar(scene, star, 0, 0, spot.size, { shadow: 0x05070a, halo: tone.color, glow: tone.color, body: 0xffffff, bloom: 0.8 }, 4);
      body.add(star);
      if (reduced) return;
      star.setScale(0.2).setAlpha(0);
      scene.tweens.add({ targets: star, scale: 1, alpha: 1, duration: 480, delay: 220 + index * 140, yoyo: true, hold: 360, repeat: -1, repeatDelay: 520 + index * 160, ease: "Sine.easeInOut" });
    });
    body.add(scene.add.text(0, cardY + P.card.height / 2 + 120, t("storyDifficulty.unlocked.body", { difficulty: t(`storyDifficulty.${difficulty}`) }), textStyle({ role: "body", size: 30, color: COLOR.ink, wrap: 760, align: "center", lineSpacing: 12 })).setOrigin(0.5));
    body.add(new Button(scene, 0, height / 2 - 100, { width: 520, height: 96, label: t("settings.action.confirm"), variant: "primary", accentColor: tone.color, accentTextColor: tone.text, fontSize: 34, onClick: close }));
  }));
}
