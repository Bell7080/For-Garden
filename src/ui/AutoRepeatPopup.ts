import Phaser from "phaser";
import { t } from "../i18n";
import { AUTO_REPEAT_RUN_CHOICES, type AutoRepeatOptions, type AutoRepeatRuns } from "../core/autoRepeat";
import { settingsManager } from "../managers/SettingsManager";
import { Button } from "./Button";
import { PopupLayer } from "./PopupLayer";
import { SettingsToggle } from "./SettingsToggle";
import { COLOR, textStyle } from "./theme";

/**
 * **자동 전투 옵션 창** — 편성 화면의 「자동 전투」가 연다.
 *
 * 옵션은 셋뿐이다(반복 횟수 · 패배 시 중단 · 에너지 드링크 자동 사용). 고른 값은 기기 설정
 * (`settings.game.autoRepeat`)에 남아 다음에 열 때 그대로 선다. 「시작」만 실제로 출격한다.
 */
export const AUTO_REPEAT_POPUP = {
  width: 1000,
  height: 720,
  label: { x: -440, size: 30 },
  runs: { y: -200, chipY: -120, chipWidth: 160, chipHeight: 80, gap: 16 },
  toggles: { x: -440, firstY: 20, gap: 110 },
  actions: { y: 270, width: 300, height: 104, gap: 40 },
  selectedFill: 0x4a3c1c,
} as const;

function runsLabel(runs: AutoRepeatRuns): string {
  return runs === 0 ? t("autoRepeat.runs.endless") : t("autoRepeat.runs.count", { count: runs });
}

export function openAutoRepeatPopup(scene: Phaser.Scene, popups: PopupLayer, onStart: (options: AutoRepeatOptions) => void): void {
  const L = AUTO_REPEAT_POPUP;
  const options: AutoRepeatOptions = { ...settingsManager.get().game.autoRepeat };
  const save = (): void => { settingsManager.update({ game: { autoRepeat: { ...options } } }); };

  popups.open({ width: L.width, height: L.height, title: t("autoRepeat.title"), dim: true, closeOnBackdrop: true }, (body, close) => {
    body.add(scene.add.text(L.label.x, L.runs.y, t("autoRepeat.runs"), textStyle({ role: "emphasis", size: L.label.size, color: COLOR.ink })).setOrigin(0, 0.5));
    const chips: Button[] = [];
    const total = AUTO_REPEAT_RUN_CHOICES.length * L.runs.chipWidth + (AUTO_REPEAT_RUN_CHOICES.length - 1) * L.runs.gap;
    const paintChips = (): void => {
      for (const chip of chips) chip.destroy();
      chips.length = 0;
      AUTO_REPEAT_RUN_CHOICES.forEach((runs, index) => {
        const selected = options.runs === runs;
        const chip = new Button(scene, -total / 2 + L.runs.chipWidth / 2 + index * (L.runs.chipWidth + L.runs.gap), L.runs.chipY, {
          width: L.runs.chipWidth,
          height: L.runs.chipHeight,
          label: runsLabel(runs),
          fontSize: 26,
          ...(selected ? { fill: L.selectedFill } : {}),
          onClick: () => {
            if (options.runs === runs) return;
            options.runs = runs;
            save();
            paintChips();
          },
        }).setAlpha(selected ? 1 : 0.72);
        chip.fitLabel(L.runs.chipWidth - 20);
        chips.push(chip);
        body.add(chip);
      });
    };
    paintChips();

    body.add(new SettingsToggle(scene, L.toggles.x, L.toggles.firstY, t("autoRepeat.stopOnDefeat"), options.stopOnDefeat, (value) => { options.stopOnDefeat = value; save(); }));
    body.add(new SettingsToggle(scene, L.toggles.x, L.toggles.firstY + L.toggles.gap, t("autoRepeat.autoDrink"), options.autoDrink, (value) => { options.autoDrink = value; save(); }));

    const offset = (L.actions.width + L.actions.gap) / 2;
    body.add(new Button(scene, -offset, L.actions.y, { width: L.actions.width, height: L.actions.height, label: t("popup.cancel"), fontSize: 32, onClick: close }));
    body.add(new Button(scene, offset, L.actions.y, {
      width: L.actions.width,
      height: L.actions.height,
      label: t("autoRepeat.start"),
      fontSize: 34,
      variant: "primary",
      onClick: () => {
        close();
        onStart({ ...options });
      },
    }));
  });
}
