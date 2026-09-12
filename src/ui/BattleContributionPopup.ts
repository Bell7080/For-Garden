import Phaser from "phaser";
import { t } from "../i18n";
import type { BattleContributionResult, ContributionCategory } from "../core/battleContribution";
import { getRelic } from "../data/relics";
import { contributionCategoryLabel, contributionRenderModel, CONTRIBUTION_CATEGORIES } from "./battleContributionRenderModel";
import { Button } from "./Button";
import { FaceFrame } from "./FaceFrame";
import { HoloBar } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/**
 * 결과 기여도 한 줄의 자리.
 *
 * 얼굴 액자를 키우고 막대를 그만큼 줄인 값이 여기 한 곳에 있다 — 화면에 손으로 적으면 다섯
 * 줄 중 하나만 고쳐도 줄이 어긋난다.
 */
const CONTRIBUTION_ROW = { faceX: -396, faceSize: 120, nameX: -316, barX: 40, barY: 74, barWidth: 640, barHeight: 16 } as const;

/** 결과판 위에 쌓이며 원본 결과판이나 서버 영수증 객체를 소유·파괴하지 않는 공용 기여도 판이다. */
export class BattleContributionPopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  /**
   * 아군 종료 스냅샷만 받고 탭 전환 때도 변경 가능한 전투 상태를 다시 읽지 않는다.
   *
   * `onClosed`는 이 판을 연 쪽(결과 팝업)이 숨겨 둔 버튼을 다시 보여줄 때 쓴다 — 그래서 이
   * 판이 실제로 닫힐 때 정확히 한 번만 불러야 한다.
   */
  open(result: BattleContributionResult, onClosed?: () => void): void {
    const width = 936; const height = 1320;
    this.popups.open({
      width, height, title: t("contribution.title"), titleSize: 34, dim: true, dimAlpha: 0.36,
      closeOnBackdrop: false, hideCloseButton: true, onClose: () => onClosed?.(),
    }, (body, close) => {
      let category: ContributionCategory = "attack";
      const content = this.scene.add.container(0, 0); body.add(content);
      const labels = CONTRIBUTION_CATEGORIES.map((item, index) => {
        const x = -250 + index * 250;
        const label = this.scene.add.text(x, -535, contributionCategoryLabel(item), textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5);
        const hit = this.scene.add.rectangle(x, -535, 210, 82, 0xffffff, 0).setInteractive({ useHandCursor: true });
        // 넓은 투명 입력면은 접근성 배율에서도 글자 자체를 정확히 누를 필요가 없게 한다.
        hit.on("pointerup", () => { category = item; render(); }); body.add([label, hit]);
        return label;
      });
      const render = (): void => {
        content.removeAll(true);
        labels.forEach((label, index) => { const selected = CONTRIBUTION_CATEGORIES[index] === category; label.setColor(selected ? COLOR.accentText : COLOR.inkDim).setScale(selected ? 1.08 : 1); });
        const rows = contributionRenderModel(category, result.rows[category]);
        const replayTotal = result.rows.attack.reduce((sum, row) => sum + row.total, 0);
        // 서버 보정이 있을 때만 두 기준을 병기하고 개별 막대는 행동 재생 결과를 그대로 유지한다.
        const header = category === "attack" && result.confirmedAttackTotal !== undefined && result.confirmedAttackTotal !== replayTotal
          ? t("contribution.totals", { confirmed: result.confirmedAttackTotal.toLocaleString(), replay: replayTotal.toLocaleString() }) : t("contribution.allies");
        content.add(this.scene.add.text(0, -445, header, textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
        rows.rows.slice(0, 5).forEach((row, index) => {
          const y = -330 + index * 158;
          // 긴 이름은 말줄임으로 막대와 K/M 축약 수치의 고정 열을 침범하지 않는다.
          const name = row.source.name.length > 14 ? `${row.source.name.slice(0, 13)}…` : row.source.name;
          // **먼저 읽어야 하는 것은 누구인가다.** 이름만으로는 늘어선 다섯 줄에서 한눈에
          // 읽히지 않아 얼굴 액자를 크게 세우고, 그만큼 막대를 짧게 줄였다 — 막대는 서로
          // 견주는 길이라 조금 짧아져도 뜻이 그대로지만, 얼굴은 작으면 누구인지 알 수 없다.
          const relic = getRelic(row.source.portraitId);
          content.add(new FaceFrame(this.scene, CONTRIBUTION_ROW.faceX, y, { portraitAssetId: relic.portraitAssetId, size: CONTRIBUTION_ROW.faceSize }));
          content.add(this.scene.add.text(CONTRIBUTION_ROW.nameX, y, name, textStyle({ role: "body", size: 28, color: COLOR.ink })).setOrigin(0, 0.5).setFixedSize(440, 48));
          content.add(this.scene.add.text(360, y, row.value, textStyle({ role: "display", size: 28, color: COLOR.inkDim })).setOrigin(1, 0.5));
          const bar = new HoloBar(this.scene, CONTRIBUTION_ROW.barX, y + CONTRIBUTION_ROW.barY, CONTRIBUTION_ROW.barWidth, CONTRIBUTION_ROW.barHeight, { color: rows.color, trackAlpha: 0.48 });
          bar.setValue(row.fill, rows.color); bar.addTo(content);
        });
      };
      render();
      // 결과 팝업이 숨긴 "공격 · 방어 · 회복" 버튼과 짝을 이루는 조작이라, 우하단 아이콘
      // 대신 판 우측(닫기 X가 원래 서는 자리)에 작은 t("contribution.back") 라벨 버튼을 둔다.
      body.add(new Button(this.scene, width / 2 - 90, -height / 2 + 40, { width: 140, height: 60, label: t("contribution.back"), fontSize: 20, onClick: close }));
    });
  }
}
