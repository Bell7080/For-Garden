import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import type { BattleContributionRow, ContributionCategory } from "../core/battleContribution";
import { BATTLE_CONTRIBUTION_LAYOUT as L } from "./battleContributionLayout";
import { chipPoints, drawLayer, HoloBar, HOLO } from "./holo";
import { drawGlyph } from "./glyphs";
import { COLOR, textStyle } from "./theme";

/** 씬은 코어가 완성한 행 스냅샷만 넘기며 합산·정렬을 이 프리팹에서 다시 하지 않는다. */
export interface BattleContributionSnapshot {
  category: ContributionCategory;
  rows: readonly BattleContributionRow[];
}

interface RowView { name: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text; bar: HoloBar; lastValue: number }

const CATEGORY: readonly { id: ContributionCategory; label: string }[] = [
  { id: "attack", label: "공격" }, { id: "defense", label: "방어" }, { id: "healing", label: "회복" },
];

/** 전투 한 판 동안만 펼침·카테고리 상태를 소유하는 좌측 홀로그램 기여도 판이다. */
export class BattleContributionPanel {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly toggle: Phaser.GameObjects.Container;
  private readonly categoryHits: Phaser.GameObjects.Rectangle[] = [];
  private readonly categoryLabels: Phaser.GameObjects.Text[] = [];
  private readonly rows: RowView[] = [];
  private expanded = false;
  private category: ContributionCategory = "attack";
  private locked = false;
  private slide?: Phaser.Tweens.Tween;

  constructor(private readonly scene: Phaser.Scene, private readonly onCategory: (category: ContributionCategory) => void) {
    this.panel = scene.add.container(-L.panel.width, 0).setDepth(315);
    const shape = chipPoints(L.panel.width, L.panel.height, { bevel: { topLeft: 18, topRight: 30, bottomRight: 12, bottomLeft: 22 } });
    // drawLayer가 그림자·HOLO.glass 면·윗변 한 줄만 그려 사방 외곽선을 만들지 않는다.
    this.panel.add(drawLayer(scene, L.panel.left + L.panel.width / 2, L.panel.top + L.panel.height / 2, shape, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
    this.buildCategories();
    this.buildRows();
    this.toggle = this.buildToggle();
  }

  /** 최소 84px 폭의 직접 선택 칩 세 개를 한 줄에 두고 선택은 색·크기로만 알린다. */
  private buildCategories(): void {
    CATEGORY.forEach((item, index) => {
      const x = L.categories.left + L.categories.itemWidth * (index + 0.5);
      const label = this.scene.add.text(x, L.categories.top + L.categories.height / 2, item.label, textStyle({ role: "emphasis", size: 23, color: COLOR.inkDim })).setOrigin(0.5);
      const hit = this.scene.add.rectangle(x, L.categories.top + L.categories.height / 2, L.categories.itemWidth, L.categories.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => { if (!this.locked) this.selectCategory(item.id); });
      this.panel.add([label, hit]); this.categoryLabels.push(label); this.categoryHits.push(hit);
    });
    this.refreshCategoryStyle();
  }

  /** 최대 다섯 행은 생성 뒤 재사용해 매 프레임 Graphics나 Text를 새로 만들지 않는다. */
  private buildRows(): void {
    for (let index = 0; index < L.rows.count; index += 1) {
      const y = L.rows.top + index * (L.rows.height + L.rows.gap);
      const name = this.scene.add.text(L.rows.left, y, "", textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0);
      const value = this.scene.add.text(L.rows.left + L.rows.width, y, "0", textStyle({ role: "display", size: 21, color: COLOR.inkDim })).setOrigin(1, 0);
      const bar = new HoloBar(this.scene, L.rows.left + L.rows.width / 2, y + 48, L.rows.width, 15, { color: COLOR.sortie, trackAlpha: 0.48 }).addTo(this.panel);
      this.panel.add([name, value]); this.rows.push({ name, value, bar, lastValue: Number.NaN });
    }
  }

  /** IconButton과 같은 chipPoints·drawLayer·HOLO.glass 및 1.08 눌림 규칙의 전용 그래프 칩이다. */
  private buildToggle(): Phaser.GameObjects.Container {
    const button = this.scene.add.container(L.toggle.x, L.toggle.y).setDepth(316);
    const shape = chipPoints(L.toggle.width, L.toggle.height, { bevel: { topLeft: 7, topRight: 28, bottomRight: 6, bottomLeft: 24 } });
    button.add(drawLayer(this.scene, 0, 0, shape, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.55 }));
    button.add(drawGlyph(this.scene, "bar-chart", 0, 0, 42, COLOR.accent));
    const hit = this.scene.add.rectangle(0, 0, L.toggle.width, L.toggle.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => { if (!this.locked) button.setScale(1.08); });
    hit.on("pointerout", () => button.setScale(1));
    hit.on("pointerup", () => { button.setScale(1); if (!this.locked) this.setExpanded(!this.expanded); });
    button.add(hit); return button;
  }

  /** 이미 선택된 카테고리는 콜백을 반복하지 않아 불필요한 스냅샷 생성을 막는다. */
  private selectCategory(category: ContributionCategory): void {
    if (this.category === category) return;
    this.category = category;
    // 다른 분류에서 우연히 같은 숫자가 나온 행도 이름·색·막대를 반드시 한 번 다시 그린다.
    this.rows.forEach((row) => { row.lastValue = Number.NaN; });
    this.refreshCategoryStyle(); this.onCategory(category);
  }

  private refreshCategoryStyle(): void {
    CATEGORY.forEach((item, index) => {
      const selected = item.id === this.category;
      this.categoryLabels[index].setColor(selected ? COLOR.accentText : COLOR.inkDim).setFontSize(selected ? 26 : 23).setScale(selected ? 1.04 : 1);
    });
  }

  /** 최고 기여 행만 100%가 되며 실제 값이 달라진 행만 숫자와 HoloBar를 다시 그린다. */
  update(snapshot: BattleContributionSnapshot): void {
    if (snapshot.category !== this.category) return;
    const max = Math.max(0, ...snapshot.rows.map((row) => row.total));
    const color = this.category === "attack" ? COLOR.sortie : this.category === "defense" ? COLOR.contributionDefense : COLOR.hpFill;
    this.rows.forEach((view, index) => {
      const row = snapshot.rows[index];
      view.name.setVisible(Boolean(row)); view.value.setVisible(Boolean(row)); view.bar.objects.forEach((object) => object.setVisible(Boolean(row)));
      if (!row || view.lastValue === row.total) return;
      view.lastValue = row.total; view.name.setText(row.name); view.value.setText(formatCurrency(row.total)); view.bar.setValue(max > 0 ? row.total / max : 0, color);
    });
  }

  /** 컷인 중 입력만 잠그고 컨테이너 위치와 선택 카테고리는 그대로 둔다. */
  setInputLocked(locked: boolean): void { this.locked = locked; }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded; this.slide?.remove();
    this.slide = this.scene.tweens.add({ targets: this.panel, x: expanded ? 0 : -L.panel.width, duration: 190, ease: "Cubic.Out" });
  }

  /** 디버그/E2E는 Canvas 내부 상태를 이 읽기 전용 값으로만 관찰한다. */
  get state(): { expanded: boolean; category: ContributionCategory; locked: boolean } { return { expanded: this.expanded, category: this.category, locked: this.locked }; }

  /** 씬 종료 시 진행 중 슬라이드와 HoloBar의 독립 Graphics까지 함께 제거한다. */
  destroy(): void { this.slide?.remove(); this.rows.forEach((row) => row.bar.destroy()); this.panel.destroy(true); this.toggle.destroy(true); }
}
