import Phaser from "phaser";
import type { GameApi, InventoryItemDto } from "../api/contracts";
import type { ItemCategory } from "../data/items";
import { InventoryManager, inventoryScrollMetrics } from "../managers/InventoryManager";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { openRuneInfoPopup } from "./RunePopup";
import { COLOR, textStyle } from "./theme";

const CATEGORIES: readonly { id: ItemCategory; label: string }[] = [
  { id: "rune", label: "룬" }, { id: "currency", label: "재화" }, { id: "consumable", label: "소비품" }, { id: "material", label: "재료" },
];
const GRID = { columns: 2, cellWidth: 350, cellHeight: 210, viewportHeight: 1030 } as const;

/** 로비를 유지한 채 서버 확정 인벤토리를 표시하는 홀로그램 작업판이다. */
export class InventoryPopup {
  private body?: Phaser.GameObjects.Container;
  private view?: Phaser.GameObjects.Container;
  private category: ItemCategory = "rune";
  private items: InventoryItemDto[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClose?: () => void) {}

  /** 중복 열기를 막고 조회가 끝난 뒤 현재 탭을 그린다. */
  open(): void {
    if (this.body) return;
    this.body = this.popups.open({ width: 900, height: 1510, title: "인벤토리", dim: true, closeOnBackdrop: false, onClose: () => { this.body = undefined; this.view = undefined; this.onClose?.(); } }, (body) => {
      // 공용 팝업 판과 제목은 보존하고 교체 가능한 내용 전용 컨테이너만 다시 그린다.
      const view = this.scene.add.container(0, 0); this.view = view; body.add(view);
      void this.api.getInventory().then(({ items }) => { this.items = items; this.render(view); });
    });
  }

  close(): void { if (this.body) this.popups.closeTop(); }

  /** 탭과 목록만 다시 만들어 서버/세션 상태를 UI 객체가 직접 수정하지 않게 한다. */
  private render(body: Phaser.GameObjects.Container): void {
    body.removeAll(true);
    const visible = this.items.filter(({ category }) => category === this.category);
    const content = this.scene.add.container(-GRID.cellWidth, -600);
    const maskShape = this.scene.add.rectangle(540, 960, 740, GRID.viewportHeight, 0xffffff).setVisible(false);
    content.setMask(maskShape.createGeometryMask()); body.add(content);
    visible.forEach((item, index) => this.addCard(content, item, index));
    const metrics = inventoryScrollMetrics(visible.length); let offset = 0; let dragY = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); content.y = -600 + offset; };
    const hit = this.scene.add.rectangle(0, -85, 760, GRID.viewportHeight, 0xffffff, 0).setInteractive({ draggable: true, useHandCursor: true });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65)); body.add(hit);
    CATEGORIES.forEach((tab, index) => {
      const selected = tab.id === this.category;
      const label = this.scene.add.text(-285 + index * 190, 650, tab.label, textStyle({ role: "emphasis", size: 27, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5).setScale(selected ? 1.14 : 1).setInteractive({ useHandCursor: true });
      label.on("pointerup", () => { this.category = tab.id; this.render(body); }); body.add(label);
    });
  }

  /** 획득 팝업처럼 액자 우하단에 보유량을 겹쳐 한 그림과 한 수로 읽히게 한다. */
  private addCard(content: Phaser.GameObjects.Container, item: InventoryItemDto, index: number): void {
    const x = (index % GRID.columns) * GRID.cellWidth; const y = Math.floor(index / GRID.columns) * GRID.cellHeight;
    const shape = chipPoints(320, 180, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    const card = this.scene.add.container(x, y); card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x151a21, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const frame = chipPoints(102, 102, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
    card.add(drawLayer(this.scene, -92, -12, frame, { fill: 0x24282e, alpha: 1 })); card.add(drawShapeOutline(this.scene, -92, -12, frame, { color: COLOR.accent, alpha: 0.7 })); card.add(drawInnerVignette(this.scene, -92, -12, frame));
    card.add(drawGlyph(this.scene, item.category === "rune" ? "heart" : "scroll", -92, -12, 48, COLOR.accent));
    card.add(this.scene.add.text(-42, -48, this.label(item), textStyle({ role: "display", size: 22 })).setOrigin(0, 0));
    card.add(this.scene.add.text(-42, -10, this.description(item), textStyle({ role: "body", size: 17, color: COLOR.inkDim, wrap: 170 })).setOrigin(0, 0));
    card.add(this.scene.add.text(-43, 58, String(item.quantity), textStyle({ role: "emphasis", size: 24 })).setOrigin(1, 1).setStroke("#05070a", 5));
    const hit = this.scene.add.rectangle(0, 0, 320, 180, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerup", () => this.select(item, { x: 540 + content.x + x, y: 960 + content.y + y })); card.add(hit); content.add(card);
  }

  private label(item: InventoryItemDto): string { return item.rune?.customName ?? item.rune?.baseName ?? new InventoryManager(session).list(item.category).find(({ id }) => id === item.id)?.definition.name ?? item.definitionId; }
  private description(item: InventoryItemDto): string { return new InventoryManager(session).list(item.category).find(({ id }) => id === item.id)?.definition.description ?? ""; }

  /** 룬은 기존 정보창, 소비품은 확인 후 서버 결과, 재화·재료는 읽기 전용 상세로 연결한다. */
  private select(item: InventoryItemDto, anchor: { x: number; y: number }): void {
    if (item.rune) { openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: item.rune.instanceId, anchor, api: this.api }); return; }
    if (item.category !== "consumable") { this.popups.open({ width: 440, height: 280, title: this.label(item), anchor, dim: true }, (body) => body.add(this.scene.add.text(0, 0, `${this.description(item)}\n\n보유 ${item.quantity}`, textStyle({ role: "body", size: 22, align: "center", wrap: 340 })).setOrigin(0.5))); return; }
    this.popups.confirm({ title: this.label(item), message: "아이템을 1개 사용하시겠습니까?", confirmLabel: "사용" }, () => { void this.api.useConsumable({ itemId: item.definitionId, quantity: 1 }).then((result) => { this.items = result.items; this.popups.open({ width: 440, height: 250, title: "사용 완료", dim: true }, (body) => body.add(this.scene.add.text(0, 0, `스테미나 +${result.appliedAmount}`, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5))); if (this.view) this.render(this.view); }); });
  }
}
