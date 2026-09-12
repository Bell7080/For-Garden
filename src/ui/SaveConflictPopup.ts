import Phaser from "phaser";
import { t } from "../i18n";
import type { ProgressSummary } from "../api/AccountApi";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

export type SaveConflictChoice = "local" | "remote" | "cancel";

/** 로컬/서버가 다를 때 자동 덮어쓰기 대신 양쪽 핵심 진행을 나란히 보여 주는 선택 팝업이다. */
export function openSaveConflictPopup(scene: Phaser.Scene, popups: PopupLayer, local: ProgressSummary, remote: ProgressSummary, resolve: (choice: SaveConflictChoice) => void): void {
  popups.open({ width: 920, height: 610, title: t("saveConflict.title"), dim: true, closeOnBackdrop: false }, (body, close) => {
    body.add(scene.add.text(-390, -205, t("saveConflict.notice"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })));
    const summary = (x: number, title: string, value: ProgressSummary): void => {
      body.add(scene.add.text(x, -125, title, textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5));
      body.add(scene.add.text(x, -65, t("saveConflict.summary", { level: value.playerLevel, gems: value.currency.gems, gold: value.currency.gold, lastPlayed: value.lastPlayedAt }), textStyle({ role: "body", size: 23, align: "center", lineSpacing: 12 })).setOrigin(0.5, 0));
    };
    summary(-220, t("saveConflict.local"), local); summary(220, t("saveConflict.remote"), remote);
    const choice = (x: number, label: string, value: SaveConflictChoice): void => {
      const button = scene.add.text(x, 205, label, textStyle({ role: "emphasis", size: 26, color: value === "cancel" ? COLOR.inkDim : COLOR.accentText })).setOrigin(0.5).setInteractive({ useHandCursor: true });
      button.on("pointerdown", () => button.setScale(1.1)); button.on("pointerout", () => button.setScale(1));
      button.on("pointerup", () => { close(); resolve(value); }); body.add(button);
    };
    choice(-245, t("saveConflict.useLocal"), "local"); choice(0, t("saveConflict.cancel"), "cancel"); choice(245, t("saveConflict.useRemote"), "remote");
  });
}
