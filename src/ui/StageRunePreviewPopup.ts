import type Phaser from "phaser";
import { t } from "../i18n";
import { runePartLabel, runeRarityLabel } from "../core/runes";
import type { StageFirstClearReward } from "../core/stageRewards";
import { drawHairline } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { COLOR, textStyle } from "./theme";

/** 쪽지의 자리. 폭과 높이를 손으로 적지 않고 줄 수에서 거꾸로 구한다. */
const RUNE_PREVIEW = { width: 640, pad: 40, frame: 128, rowTop: 200, rowGap: 52, bottom: 44 } as const;

/**
 * 초회 보상 룬의 **미리보기 쪽지** — 받기 전에는 등급과 자리만 말한다.
 *
 * 옵션과 특성은 받을 때 서버가 굴리므로 여기서는 「알 수 없음」으로 가린다. 미리 보여 준 값이 받은
 * 룬과 다르면 거짓말이 된다. 특성만은 **붙는지 안 붙는지**가 정해져 있어(1-5는 없음, 장의 끝은 확정)
 * 그 사실까지는 적고 종류는 가린다.
 */
export function openStageRunePreview(scene: Phaser.Scene, popups: PopupLayer, reward: Extract<StageFirstClearReward, { kind: "rune" }>, anchor?: { x: number; y: number }): void {
  const rows: [string, string][] = [
    [t("rune.mainOption"), t("stageRune.unknown")],
    [t("rune.subOption"), t("stageRune.unknown")],
    [t("rune.trait.title"), reward.trait ? t("stageRune.traitGuaranteed") : t("stageRune.traitNone")],
  ];
  const height = RUNE_PREVIEW.rowTop + rows.length * RUNE_PREVIEW.rowGap + RUNE_PREVIEW.bottom;
  const accent = RUNE_ACCENT[reward.rarity];
  popups.open({ width: RUNE_PREVIEW.width, height, title: t("stageRune.title"), ...(anchor ? { anchor } : {}) }, (body) => {
    const top = -height / 2;
    const left = -RUNE_PREVIEW.width / 2 + RUNE_PREVIEW.pad;
    const frameY = top + 40 + RUNE_PREVIEW.frame / 2;
    body.add(addRuneFrame(scene, left + RUNE_PREVIEW.frame / 2, frameY, RUNE_PREVIEW.frame, reward.rarity, reward.part));
    const textX = left + RUNE_PREVIEW.frame + 32;
    body.add(scene.add.text(textX, frameY - 20, t("rune.baseName", { part: runePartLabel(reward.part) }), textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0.5));
    body.add(scene.add.text(textX, frameY + 24, runeRarityLabel(reward.rarity), textStyle({ role: "emphasis", size: 24, color: `#${accent.toString(16).padStart(6, "0")}` })).setOrigin(0, 0.5));
    body.add(drawHairline(scene, 0, top + RUNE_PREVIEW.rowTop - 26, RUNE_PREVIEW.width - RUNE_PREVIEW.pad * 2, { color: COLOR.accent, alpha: 0.3 }));
    rows.forEach(([label, value], index) => {
      const y = top + RUNE_PREVIEW.rowTop + index * RUNE_PREVIEW.rowGap;
      body.add(scene.add.text(left, y, label, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const known = index === 2 && reward.trait;
      body.add(scene.add.text(RUNE_PREVIEW.width / 2 - RUNE_PREVIEW.pad, y, value, textStyle({ role: "body", size: 24, color: known ? COLOR.accentText : COLOR.inkDim })).setOrigin(1, 0.5));
    });
  });
}
