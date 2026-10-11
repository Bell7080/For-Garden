import Phaser from "phaser";
import { t } from "../i18n";
import { getStage } from "../data/stages";
import { recollectionEntriesOf, RECOLLECTION_GROUPS, type RecollectionEntry, type RecollectionGroup } from "../data/recollectionCatalog";
import { storyManager } from "../managers/StoryManager";
import { addCategoryTab } from "./CategoryTab";
import { chipPoints, drawLayer, drawShapeEdge, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";
import { fitTextToBox } from "./textFit";

/** 한 줄 높이·간격 — 탭마다 줄 수가 달라도 한 판에 들어간다(1장이 가장 길다). */
const ROW = { width: 880, height: 88, gap: 12 } as const;
const POPUP = { width: 980, height: 1360 } as const;
const TAB = { width: 250, height: 70 } as const;

/** 줄에 적을 글. 관문과 묶인 이야기는 `1-5 붕괴한 온실 · 출격 전`, 아니면 제 제목이다. */
export function recollectionRowLabel(entry: RecollectionEntry): string {
  if (entry.titleKey) return t(entry.titleKey);
  const stage = getStage(entry.stageId ?? "");
  const phase = entry.phase ? t(entry.phase === "pre" ? "recollection.phase.pre" : "recollection.phase.post") : "";
  return `${stage.id}  ${stage.name}${phase ? ` · ${phase}` : ""}`;
}

/**
 * 회고 — 본 이야기를 모아 다시 읽는 곳.
 *
 * 본편의 전·후 대사, 오프닝, 곁 이야기가 한 목록에 모인다. 아직 보지 않은 이야기는 이름을 가리고
 * (`???`) 누를 수 없다. 다시 보기를 관문 쪽에 두지 않으므로 이야기를 다시 읽는 길은 여기뿐이다.
 */
export class RecollectionPopup {
  private tab: RecollectionGroup = "chapter1";
  private list?: Phaser.GameObjects.Container;
  private tabs?: Phaser.GameObjects.Container;
  private body?: Phaser.GameObjects.Container;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly onPlay: (storyId: string) => void) {}

  open(): void {
    if (this.body) return;
    this.popups.open({ width: POPUP.width, height: POPUP.height, title: t("recollection.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: true, backButton: true, onClose: () => { this.body = undefined; this.list = undefined; this.tabs = undefined; } }, (body) => {
      this.body = body;
      this.render();
    });
  }

  private render(): void {
    const body = this.body; if (!body) return;
    const previousList = this.list; const previousTabs = this.tabs;
    const list = this.scene.add.container(0, 0);
    const entries = recollectionEntriesOf(this.tab);
    const top = -POPUP.height / 2 + 150;
    entries.forEach((entry, index) => this.addRow(list, entry, top + ROW.height / 2 + index * (ROW.height + ROW.gap)));
    body.add(list);
    const tabs = this.scene.add.container(0, 0);
    const startX = -((RECOLLECTION_GROUPS.length - 1) * (TAB.width + 8)) / 2;
    RECOLLECTION_GROUPS.forEach((group, index) => {
      addCategoryTab(this.scene, tabs, {
        x: startX + index * (TAB.width + 8), y: POPUP.height / 2 - 110, width: TAB.width, height: TAB.height,
        label: t(`recollection.tab.${group}`), selected: group === this.tab,
        onSelect: () => { if (group === this.tab) return; this.tab = group; this.render(); },
      });
    });
    body.add(tabs);
    previousList?.destroy(); previousTabs?.destroy();
    this.list = list; this.tabs = tabs;
  }

  private addRow(parent: Phaser.GameObjects.Container, entry: RecollectionEntry, y: number): void {
    const done = storyManager.isCompleted(entry.storyId);
    const row = this.scene.add.container(0, y);
    const shape = chipPoints(ROW.width, ROW.height, { bevel: { topLeft: 22, topRight: 0, bottomRight: 22, bottomLeft: 0 } });
    row.add(drawLayer(this.scene, 0, 0, shape, { fill: done ? 0x1e2a38 : 0x12161b, alpha: done ? HOLO.glass : 0.62 }));
    if (done) row.add(drawShapeEdge(this.scene, 0, 0, shape, "top", { color: COLOR.accent, alpha: 0.7, width: 3 }));
    const label = this.scene.add.text(-ROW.width / 2 + 40, 0, done ? recollectionRowLabel(entry) : t("recollection.locked"), textStyle({ role: "emphasis", size: 30, color: done ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5);
    fitTextToBox(label, { width: ROW.width - 80, height: ROW.height - 20 });
    row.add(label);
    if (done) {
      const hit = this.scene.add.rectangle(0, 0, ROW.width, ROW.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(row));
      hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(row); this.onPlay(entry.storyId); });
      row.add(hit);
    }
    parent.add(row);
  }
}
