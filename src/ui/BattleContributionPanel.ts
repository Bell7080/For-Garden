import Phaser from "phaser";
import type { BattleContributionRow, ContributionCategory } from "../core/battleContribution";
import { CONTRIBUTION_CATEGORIES, contributionRenderModel } from "./battleContributionRenderModel";
import { BATTLE_CONTRIBUTION_LAYOUT as L, battleContributionBounds, contributionRowCenterY, CONTRIBUTION_TOGGLE } from "./battleContributionLayout";
import { chipPoints, drawLayer, HoloBar, HOLO } from "./holo";
import { FaceFrame } from "./FaceFrame";
import { getRelic } from "../data/relics";
import { COLOR, textStyle } from "./theme";

/** 씬은 코어가 완성한 행 스냅샷만 넘기며 합산·정렬을 이 프리팹에서 다시 하지 않는다. */
export interface BattleContributionSnapshot {
  category: ContributionCategory;
  rows: readonly BattleContributionRow[];
}

/**
 * 한 전투원의 줄.
 *
 * **자리가 아니라 전투원이 줄을 소유한다.** 예전에는 다섯 줄이 순위 칸을 붙박이로 갖고 값만
 * 갈아 끼웠는데, 그러면 2위가 1위를 앞지른 순간 두 줄의 이름과 숫자가 **제자리에서 맞바뀌어**
 * 방금 읽던 줄이 다른 사람 것이 된다. 지금은 줄이 제 전투원을 데리고 새 순위 칸으로 옮겨
 * 가므로, 누가 누구를 앞질렀는지가 움직임으로 보인다.
 */
interface RowView {
  container: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  bar: HoloBar;
  lastValue: number;
  /** 지금 이 줄이 앉아 있는 순위 칸. 같은 칸이면 tween을 다시 걸지 않는다. */
  slot: number;
  slide?: Phaser.Tweens.Tween;
  /** 이 줄이 맡은 전투원. 순위가 바뀌어도 줄이 그 전투원을 따라간다. */
  fighterId?: string;
  /** 이 줄이 지금 그리고 있는 얼굴. 개체가 바뀔 때만 다시 만든다. */
  face?: FaceFrame;
  facePortraitId?: string;
}

/** 전투 한 판 동안만 펼침·카테고리 상태를 소유하는 좌측 홀로그램 기여도 판이다. */
export class BattleContributionPanel {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly categoryHits: Phaser.GameObjects.Rectangle[] = [];
  private readonly categoryLabels: Phaser.GameObjects.Text[] = [];
  private readonly rows: RowView[] = [];
  private expanded = false;
  private category: ContributionCategory = "attack";
  private locked = false;
  private slide?: Phaser.Tweens.Tween;
  /** 펼친 동안 판 밖을 눌렀는지 듣는 손잡이. 접으면 곧바로 뗀다. */
  private outsideTap?: (pointer: Phaser.Input.Pointer) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly onCategory: (category: ContributionCategory) => void) {
    this.panel = scene.add.container(L.slideOutX, 0).setDepth(315);
    const shape = chipPoints(L.panel.width, L.panel.height, { bevel: { topLeft: 18, topRight: 30, bottomRight: 12, bottomLeft: 22 } });
    // drawLayer가 그림자·HOLO.glass 면·윗변 한 줄만 그려 사방 외곽선을 만들지 않는다.
    this.panel.add(drawLayer(scene, L.panel.left + L.panel.width / 2, L.panel.top + L.panel.height / 2, shape, { fill: COLOR.panel, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 }));
    this.buildCategories();
    this.buildRows();
  }

  /** 최소 84px 폭의 직접 선택 칩 세 개를 한 줄에 두고 선택은 색·크기로만 알린다. */
  private buildCategories(): void {
    CONTRIBUTION_CATEGORIES.forEach((item, index) => {
      const x = L.categories.left + L.categories.itemWidth * (index + 0.5);
      const label = this.scene.add.text(x, L.categories.top + L.categories.height / 2, item.label, textStyle({ role: "emphasis", size: 23, color: COLOR.inkDim })).setOrigin(0.5);
      const hit = this.scene.add.rectangle(x, L.categories.top + L.categories.height / 2, L.categories.itemWidth, L.categories.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => { if (!this.locked) this.selectCategory(item.id); });
      this.panel.add([label, hit]); this.categoryLabels.push(label); this.categoryHits.push(hit);
    });
    this.refreshCategoryStyle();
  }

  /**
   * 최대 다섯 줄은 생성 뒤 재사용해 매 프레임 Graphics나 Text를 새로 만들지 않는다.
   *
   * 줄마다 컨테이너를 하나 두는 이유는 순위가 바뀔 때 **그 줄을 통째로 옮기기** 위해서다 —
   * 조각마다 y를 tween하면 얼굴·이름·막대가 따로 움직여 한 줄로 읽히지 않는다.
   */
  private buildRows(): void {
    for (let index = 0; index < L.rows.count; index += 1) {
      const container = this.scene.add.container(0, contributionRowCenterY(index));
      const name = this.scene.add.text(L.rows.left, 0, "", textStyle({ role: "body", size: 22, color: COLOR.ink })).setOrigin(0, 0.5);
      const value = this.scene.add.text(L.rows.left + L.rows.width, 0, "0", textStyle({ role: "display", size: 21, color: COLOR.inkDim })).setOrigin(1, 0.5);
      const bar = new HoloBar(this.scene, L.rows.left + L.bar.width / 2, L.bar.offsetY - 18, L.bar.width, L.bar.height, { color: COLOR.sortie, trackAlpha: 0.48 }).addTo(container);
      container.add([name, value]);
      this.panel.add(container);
      this.rows.push({ container, name, value, bar, lastValue: Number.NaN, slot: index });
    }
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
    CONTRIBUTION_CATEGORIES.forEach((item, index) => {
      const selected = item.id === this.category;
      this.categoryLabels[index].setColor(selected ? COLOR.accentText : COLOR.inkDim).setFontSize(selected ? 26 : 23).setScale(selected ? 1.04 : 1);
    });
  }

  /**
   * 최고 기여 행만 100%가 되며 실제 값이 달라진 행만 숫자와 HoloBar를 다시 그린다.
   *
   * **순위표는 전투 내내 굴러간다.** 그래서 줄을 자리에 묶지 않고 전투원에 묶어, 순서가
   * 바뀌면 그 줄이 새 칸으로 **스르륵 옮겨 간다** — 값만 갈아 끼우면 같은 자리에서 이름이
   * 바뀌어 방금 읽던 줄이 사라진 것처럼 보인다.
   */
  update(snapshot: BattleContributionSnapshot): void {
    if (snapshot.category !== this.category) return;
    const model = contributionRenderModel(this.category, snapshot.rows);
    const ranked = model.rows.slice(0, L.rows.count);
    // 이미 그 전투원을 맡고 있는 줄을 먼저 찾아 쓰고, 없으면 비어 있는 줄을 새로 맡긴다.
    const taken = new Set<RowView>();
    const assigned = ranked.map((rendered) => {
      const owner = this.rows.find((row) => row.fighterId === rendered.source.fighterId && !taken.has(row));
      const view = owner ?? this.rows.find((row) => !taken.has(row));
      if (view) taken.add(view);
      return { rendered, view };
    });
    for (const { rendered, view } of assigned) {
      if (!view) continue;
      const row = rendered.source;
      const slot = ranked.indexOf(rendered);
      this.showRow(view, true);
      if (view.fighterId !== row.fighterId) { view.fighterId = row.fighterId; view.lastValue = Number.NaN; }
      this.moveRow(view, slot);
      this.paintFace(view, row.portraitId);
      if (view.lastValue === row.total) continue;
      view.lastValue = row.total; view.name.setText(row.name); view.value.setText(rendered.value); view.bar.setValue(rendered.fill, model.color);
    }
    // 남은 줄은 비운다. 전투원 표식까지 지워야 다음 갱신에서 옛 주인을 다시 붙잡지 않는다.
    for (const view of this.rows) {
      if (taken.has(view)) continue;
      this.showRow(view, false); view.fighterId = undefined; view.lastValue = Number.NaN;
    }
  }

  /** 한 줄의 모든 조각을 함께 보이거나 감춘다. */
  private showRow(view: RowView, visible: boolean): void {
    view.container.setVisible(visible);
    view.face?.setVisible(visible);
  }

  /** 순위 칸이 바뀐 줄만 새 자리로 스르륵 옮긴다. 같은 칸이면 tween을 다시 걸지 않는다. */
  private moveRow(view: RowView, slot: number): void {
    if (view.slot === slot) return;
    view.slot = slot;
    view.slide?.remove();
    const y = contributionRowCenterY(slot);
    view.slide = this.scene.tweens.add({
      targets: view.container, y, duration: 260, ease: "Cubic.Out",
      onComplete: () => { view.slide = undefined; },
    });
    // 얼굴 액자는 판의 자식이지만 줄 컨테이너 밖에 있어(비동기로 만들어진다) 함께 옮긴다.
    if (view.face) {
      this.scene.tweens.add({ targets: view.face, y: y + L.face.offsetY - 18, duration: 260, ease: "Cubic.Out" });
    }
  }

  /**
   * 행 왼쪽의 얼굴 액자. 같은 개체가 그대로면 다시 만들지 않는다.
   *
   * 액자는 원화 텍스처를 비동기로 읽으므로 매 갱신마다 새로 만들면 그만큼이 프레임 비용이
   * 되고, 읽는 동안 빈 칸이 깜빡인다. 그래서 그 행에 선 개체가 바뀐 프레임에만 바꾼다.
   */
  private paintFace(view: RowView, portraitId: string): void {
    if (view.facePortraitId === portraitId) return;
    view.face?.destroy();
    view.facePortraitId = portraitId;
    const face = new FaceFrame(this.scene, L.face.x, contributionRowCenterY(view.slot) + L.face.offsetY - 18, {
      portraitAssetId: getRelic(portraitId).portraitAssetId, size: L.face.size,
    });
    view.face = face;
    this.panel.add(face);
  }

  /** 컷인 중 입력만 잠그고 컨테이너 위치와 선택 카테고리는 그대로 둔다. */
  setInputLocked(locked: boolean): void { this.locked = locked; }

  /** 전투 조작 줄의 칩이 부르는 단일 여닫기. 잠긴 동안(컷인)에는 움직이지 않는다. */
  toggle(): void { if (!this.locked) this.setExpanded(!this.expanded); }

  setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded; this.slide?.remove();
    // **접으면 확실히 사라진다.** 판 폭만큼 밀면 화면 왼쪽 여백만큼이 전장에 남는다.
    this.slide = this.scene.tweens.add({ targets: this.panel, x: expanded ? 0 : L.slideOutX, duration: 190, ease: "Cubic.Out" });
    if (this.outsideTap) { this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.outsideTap); this.outsideTap = undefined; }
    if (!expanded) return;
    // 투명한 판을 깔지 않고 씬의 포인터를 직접 듣는다 — 전장 위에 입력 면을 한 겹 깔면 그
    // 아래의 SD와 조작 칩이 함께 막히고, 이 판은 전투를 멈추는 창이 아니다.
    const bounds = battleContributionBounds(true);
    this.outsideTap = (pointer: Phaser.Input.Pointer): void => {
      if (this.locked) return;
      const inside = (box: { left: number; top: number; width: number; height: number }): boolean =>
        pointer.x >= box.left && pointer.x <= box.left + box.width && pointer.y >= box.top && pointer.y <= box.top + box.height;
      // 판 안(분류 칩)은 제 몫의 조작이 있고, 여는 칩은 **자기 손으로** 접으므로 둘 다 뺀다 —
      // 칩을 빼지 않으면 그 한 번의 누름이 여기서 접고 칩에서 다시 펴 제자리걸음이 된다.
      if (!inside(bounds) && !inside(CONTRIBUTION_TOGGLE)) this.setExpanded(false);
    };
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.outsideTap);
  }

  /** 디버그/E2E는 Canvas 내부 상태를 이 읽기 전용 값으로만 관찰한다. */
  get state(): { expanded: boolean; category: ContributionCategory; locked: boolean } { return { expanded: this.expanded, category: this.category, locked: this.locked }; }

  /** 씬 종료 시 진행 중 슬라이드와 HoloBar의 독립 Graphics까지 함께 제거한다. */
  destroy(): void {
    this.slide?.remove();
    if (this.outsideTap) this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.outsideTap);
    this.rows.forEach((row) => { row.slide?.remove(); row.bar.destroy(); });
    // 얼굴 액자와 줄 컨테이너는 판의 자식이라 판을 지우면 함께 사라진다.
    this.panel.destroy(true);
  }
}
