import Phaser from "phaser";
import { t } from "../i18n";
import type { SubmitExpeditionBossScoreResponse } from "../api/contracts";
import { expeditionScoreDetailModel } from "./expeditionScoreDetailModel";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 최종 결과판 위에 서버 확정 점수의 두 구성값만 짧게 보여 주는 공용 팝업이다. */
export class ExpeditionScoreDetailPopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  open(receipt: SubmitExpeditionBossScoreResponse): void {
    // 모델은 서버 영수증을 그대로 투영하며 이 팝업은 어떤 점수도 합산하거나 보정하지 않는다.
    const score = expeditionScoreDetailModel(receipt);
    this.popups.open({ width: 760, height: 560, title: t("score.detail"), dim: true, dimAlpha: 0.36 }, (body) => {
      this.addRow(body, -90, t("score.normalNodes"), score.normalNodeScoreTotal);
      this.addRow(body, 90, t("score.bossDamage"), score.bossDamageScore);
    });
  }

  /** 두 구성값을 같은 행 문법으로 그려 어느 쪽도 총점처럼 과도하게 강조하지 않는다. */
  private addRow(body: Phaser.GameObjects.Container, y: number, label: string, value: number): void {
    body.add(this.scene.add.text(-270, y, label, textStyle({ role: "body", size: 27, color: COLOR.inkDim })).setOrigin(0, 0.5));
    body.add(this.scene.add.text(270, y, value.toLocaleString(), textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(1, 0.5));
  }
}
