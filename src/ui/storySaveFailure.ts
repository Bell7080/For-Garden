import type Phaser from "phaser";
import type { PopupLayer } from "./PopupLayer";
import { t } from "../i18n";

/** 실패를 삼키고 다음 관문으로 이동하지 않는다. 확인한 같은 이야기 저장을 다시 시도한다. */
export function showStorySaveFailure(scene: Phaser.Scene, popups: PopupLayer, retry: () => void): void {
  if (!scene.scene.isActive()) return;
  popups.confirm({ title: t("settings.account.notice"), message: t("story.saveFailed"), confirmLabel: t("battle.result.retry"), cancelLabel: false }, retry);
}
