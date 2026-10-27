import type Phaser from "phaser";
import { STORY_DIFFICULTIES, STORY_DIFFICULTY, isStoryDifficultyUnlocked, type StoryDifficulty } from "../core/storyDifficulty";
import { t } from "../i18n";
import { session } from "../state/session";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

export function openStoryDifficultyPicker(scene: Phaser.Scene, popups: PopupLayer, selected: StoryDifficulty, onSelect: (difficulty: StoryDifficulty) => void): void {
  popups.open({ width: 900, height: 870, title: t("storyDifficulty.title"), dim: true, closeOnBackdrop: true }, (body, close) => {
    body.add(scene.add.text(0, -315, t("storyDifficulty.intro"), textStyle({ role: "body", size: 27, color: COLOR.inkDim, wrap: 780, align: "center" })).setOrigin(.5));
    STORY_DIFFICULTIES.forEach((difficulty, index) => {
      const tone = STORY_DIFFICULTY[difficulty];
      const unlocked = isStoryDifficultyUnlocked(difficulty, session.cleared);
      const y = -175 + index * 200;
      body.add(new Button(scene, 0, y, { width: 760, height: 100, label: `${selected === difficulty ? "◆ " : ""}${t(`storyDifficulty.${difficulty}`)}${unlocked ? "" : "  🔒"}`, fontSize: 36,
        accentColor: tone.color, accentTextColor: tone.text, variant: "primary", onClick: () => { if (unlocked) { close(); onSelect(difficulty); } },
      }).setEnabled(unlocked));
      const text = unlocked ? t(`storyDifficulty.${difficulty}.detail`) : t("storyDifficulty.locked", { difficulty: t(`storyDifficulty.${difficulty === "hard" ? "normal" : "easy"}`) });
      body.add(scene.add.text(0, y + 77, text, textStyle({ role: "body", size: 25, color: unlocked ? tone.text : COLOR.inkDim, wrap: 780, align: "center" })).setOrigin(.5));
    });
  });
}

export function openStoryDifficultyUnlocked(scene: Phaser.Scene, popups: PopupLayer, difficulty: StoryDifficulty): Promise<void> {
  const tone = STORY_DIFFICULTY[difficulty];
  return new Promise(resolve => popups.open({ width: 900, height: 740, title: t("storyDifficulty.unlocked.title"), dim: true, hideCloseButton: true, closeOnBackdrop: false, onClose: resolve }, (body, close) => {
    body.add(scene.add.text(0, -205, "✦", textStyle({ role: "display", size: 88, color: tone.text })).setOrigin(.5));
    body.add(scene.add.text(0, -105, t(`storyDifficulty.${difficulty}`), textStyle({ role: "display", size: 54, color: tone.text })).setOrigin(.5));
    body.add(scene.add.text(0, 45, t("storyDifficulty.unlocked.body", { difficulty: t(`storyDifficulty.${difficulty}`) }), textStyle({ role: "body", size: 30, color: COLOR.ink, wrap: 750, align: "center", lineSpacing: 12 })).setOrigin(.5));
    body.add(new Button(scene, 0, 245, { width: 700, height: 94, label: t("settings.action.confirm"), variant: "primary", accentColor: tone.color, accentTextColor: tone.text, fontSize: 34, onClick: close }));
  }));
}
