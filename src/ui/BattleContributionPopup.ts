import Phaser from "phaser";
import type { BattleContributionResult, ContributionCategory } from "../core/battleContribution";
import { contributionRenderModel, CONTRIBUTION_CATEGORIES } from "./battleContributionRenderModel";
import { HoloBar } from "./holo";
import { addPopupBackButton } from "./IconButton";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 결과판 위에 쌓이며 원본 결과판이나 서버 영수증 객체를 소유·파괴하지 않는 공용 기여도 판이다. */
export class BattleContributionPopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  /** 아군 종료 스냅샷만 받고 탭 전환 때도 변경 가능한 전투 상태를 다시 읽지 않는다. */
  open(result: BattleContributionResult): void {
    const width = 936; const height = 1320;
    this.popups.open({ width, height, title: "전투 기여도", titleSize: 34, dim: true, dimAlpha: 0.36, closeOnBackdrop: false, hideCloseButton: true }, (body, close) => {
      let category: ContributionCategory = "attack";
      const content = this.scene.add.container(0, 0); body.add(content);
      const labels = CONTRIBUTION_CATEGORIES.map((item, index) => {
        const x = -250 + index * 250;
        const label = this.scene.add.text(x, -535, item.label, textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5);
        const hit = this.scene.add.rectangle(x, -535, 210, 82, 0xffffff, 0).setInteractive({ useHandCursor: true });
        // 넓은 투명 입력면은 접근성 배율에서도 글자 자체를 정확히 누를 필요가 없게 한다.
        hit.on("pointerup", () => { category = item.id; render(); }); body.add([label, hit]);
        return label;
      });
      const render = (): void => {
        content.removeAll(true);
        labels.forEach((label, index) => { const selected = CONTRIBUTION_CATEGORIES[index].id === category; label.setColor(selected ? COLOR.accentText : COLOR.inkDim).setScale(selected ? 1.08 : 1); });
        const rows = contributionRenderModel(category, result.rows[category]);
        const replayTotal = result.rows.attack.reduce((sum, row) => sum + row.total, 0);
        // 서버 보정이 있을 때만 두 기준을 병기하고 개별 막대는 행동 재생 결과를 그대로 유지한다.
        const header = category === "attack" && result.confirmedAttackTotal !== undefined && result.confirmedAttackTotal !== replayTotal
          ? `서버 확정 ${result.confirmedAttackTotal.toLocaleString()} · 행동 재생 ${replayTotal.toLocaleString()}` : "아군 기여도";
        content.add(this.scene.add.text(0, -445, header, textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
        rows.rows.slice(0, 5).forEach((row, index) => {
          const y = -330 + index * 158;
          // 긴 이름은 말줄임으로 막대와 K/M 축약 수치의 고정 열을 침범하지 않는다.
          const name = row.source.name.length > 14 ? `${row.source.name.slice(0, 13)}…` : row.source.name;
          content.add(this.scene.add.text(-360, y, name, textStyle({ role: "body", size: 27, color: COLOR.ink })).setOrigin(0, 0.5).setFixedSize(500, 48));
          content.add(this.scene.add.text(360, y, row.value, textStyle({ role: "display", size: 27, color: COLOR.inkDim })).setOrigin(1, 0.5));
          const bar = new HoloBar(this.scene, 0, y + 55, 720, 18, { color: rows.color, trackAlpha: 0.48 });
          bar.setValue(row.fill, rows.color); bar.addTo(content);
        });
      };
      render();
      // 기존 큰 팝업과 같은 우하단 뒤로가기 규칙으로 닫아 아래 결과판 입력을 다시 드러낸다.
      addPopupBackButton(this.scene, body, width, height, close);
    });
  }
}
