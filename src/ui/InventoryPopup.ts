import Phaser from "phaser";
import type { GameApi, InventoryItemDto } from "../api/contracts";
import type { ItemCategory } from "../data/items";
import { InventoryManager, inventoryGridPosition, inventoryScrollMetrics } from "../managers/InventoryManager";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { openRuneInfoPopup } from "./RunePopup";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";

const CATEGORIES: readonly { id: ItemCategory; label: string }[] = [
  { id: "rune", label: "룬" }, { id: "currency", label: "재화" }, { id: "consumable", label: "소비품" }, { id: "material", label: "재료" },
];
const GRID = { columns: 2, cellWidth: 350, cellHeight: 210, viewportHeight: 1030 } as const;
const VIEWPORT = { x: 0, y: -35, width: 760, height: GRID.viewportHeight } as const;

/** 로비를 유지한 채 서버 확정 인벤토리를 표시하는 홀로그램 작업판이다. */
export class InventoryPopup {
  private body?: Phaser.GameObjects.Container;
  private view?: Phaser.GameObjects.Container;
  private category: ItemCategory = "rune";
  private items: InventoryItemDto[] = [];
  private maskShape?: Phaser.GameObjects.Rectangle;
  private geometryMask?: Phaser.Display.Masks.GeometryMask;
  /** 중첩 상세 팝업 유무와 무관하게 가방 자체를 닫는 전용 콜백이다. */
  private closePopup?: () => void;
  private readonly inventory = new InventoryManager(session);

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClose?: () => void, private readonly onWalletChanged?: () => void) {}

  /** 중복 열기를 막고 조회가 끝난 뒤 현재 탭을 그린다. */
  open(): void {
    if (this.body) return;
    const width = 900; const height = 1510;
    this.body = this.popups.open({ width, height, title: "가방", titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.destroyMask(); this.body = undefined; this.view = undefined; this.closePopup = undefined; this.onClose?.(); } }, (body, close) => {
      // 외부 돌아가기 버튼은 stack 최상단이 아니라 이 가방 판을 정확히 가리켜야 한다.
      this.closePopup = close;
      // 공용 팝업 판과 제목은 보존하고 교체 가능한 내용 전용 컨테이너만 다시 그린다.
      const view = this.scene.add.container(0, 0); this.view = view; body.add(view);
      // 닫기는 LobbyScene의 화면 우하단 공용 버튼 하나가 맡아 팝업에 붙은 중복 버튼을 만들지 않는다.
      void this.api.getInventory().then(({ items }) => { this.items = items; this.render(view); });
    });
  }

  close(): void { this.closePopup?.(); }

  /** 탭과 목록만 다시 만들어 서버/세션 상태를 UI 객체가 직접 수정하지 않게 한다. */
  private render(body: Phaser.GameObjects.Container): void {
    // 탭 전환 전에 display-list 밖의 GeometryMask까지 명시적으로 해제한다.
    this.destroyMask();
    body.removeAll(true);
    const visible = this.items.filter(({ category }) => category === this.category);
    // 첫 카드가 큰 작업판 제목의 세로 영역을 침범하지 않도록 기존 목록을 50px 내린다.
    // 첫 카드의 윗변을 마스크 윗변에 맞춰 아이콘/액자가 절반 잘리지 않게 한다.
    const contentStartY = VIEWPORT.y - VIEWPORT.height / 2 + GRID.cellHeight / 2;
    const content = this.scene.add.container(0, contentStartY);
    // 입력면과 마스크는 같은 팝업 로컬 사각형에서 만들어 좌표계 불일치를 차단한다.
    this.maskShape = this.scene.add.rectangle((this.body?.x ?? 0) + VIEWPORT.x, (this.body?.y ?? 0) + VIEWPORT.y, VIEWPORT.width, VIEWPORT.height, 0xffffff).setVisible(false);
    this.geometryMask = this.maskShape.createGeometryMask(); content.setMask(this.geometryMask); body.add(content);
    visible.forEach((item, index) => this.addCard(content, item, index));
    const metrics = inventoryScrollMetrics(visible.length); let offset = 0; let dragY = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); content.y = contentStartY + offset; };
    const hit = this.scene.add.rectangle(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height, 0xffffff, 0).setInteractive({ draggable: true, useHandCursor: true });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65)); body.add(hit);
    CATEGORIES.forEach((tab, index) => {
      const selected = tab.id === this.category;
      // 탭 줄은 돌아가기 버튼의 입력면과 겹치지 않도록 하단 안전 여백 위에 둔다.
      const label = this.scene.add.text(-285 + index * 190, 590, tab.label, textStyle({ role: "emphasis", size: 27, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5).setScale(selected ? 1.14 : 1).setInteractive({ useHandCursor: true });
      label.on("pointerup", () => { this.category = tab.id; this.render(body); }); body.add(label);
    });
  }

  /** GeometryMask와 원본 도형은 컨테이너 자식이 아니므로 둘 다 소유자가 직접 파괴한다. */
  private destroyMask(): void {
    this.view?.clearMask(true);
    this.geometryMask?.destroy(); this.geometryMask = undefined;
    this.maskShape?.destroy(); this.maskShape = undefined;
  }

  /** 획득 팝업처럼 액자 우하단에 보유량을 겹쳐 한 그림과 한 수로 읽히게 한다. */
  private addCard(content: Phaser.GameObjects.Container, item: InventoryItemDto, index: number): void {
    const { x, y } = inventoryGridPosition(index);
    const shape = chipPoints(320, 180, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    const card = this.scene.add.container(x, y); card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x151a21, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.35 }));
    const frame = chipPoints(102, 102, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
    card.add(drawLayer(this.scene, -92, -12, frame, { fill: 0x24282e, alpha: 1 })); card.add(drawShapeOutline(this.scene, -92, -12, frame, { color: COLOR.accent, alpha: 0.7 })); card.add(drawInnerVignette(this.scene, -92, -12, frame));
    // 정적 정의의 icon 판별값만 사용해 재화 WebP와 전용 glyph가 같은 액자 안에 놓인다.
    if (item.definition.icon.kind === "currency") card.add(this.scene.add.image(-92, -12, CURRENCY_ICON_BY_WALLET[item.definition.icon.key]).setDisplaySize(70, 70));
    else card.add(drawGlyph(this.scene, item.definition.icon.key, -92, -12, 48, COLOR.accent));
    card.add(this.scene.add.text(-42, -48, this.label(item), textStyle({ role: "display", size: 22 })).setOrigin(0, 0));
    card.add(this.scene.add.text(-42, -10, this.description(item), textStyle({ role: "body", size: 17, color: COLOR.inkDim, wrap: 170 })).setOrigin(0, 0));
    card.add(this.scene.add.text(-43, 58, String(item.quantity), textStyle({ role: "emphasis", size: 24 })).setOrigin(1, 1).setStroke("#05070a", 5));
    const hit = this.scene.add.rectangle(0, 0, 320, 180, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerup", () => this.select(item, { x: 540 + content.x + x, y: 960 + content.y + y })); card.add(hit); content.add(card);
  }

  private label(item: InventoryItemDto): string { return item.rune?.customName ?? item.rune?.baseName ?? item.definition.name; }
  private description(item: InventoryItemDto): string { return item.definition.description; }

  /** 룬은 기존 정보창, 소비품은 확인 후 서버 결과, 재화·재료는 읽기 전용 상세로 연결한다. */
  private select(item: InventoryItemDto, anchor: { x: number; y: number }): void {
    if (item.rune) { openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: item.rune.instanceId, anchor, api: this.api }); return; }
    if (item.category !== "consumable") { this.popups.open({ width: 440, height: 280, title: this.label(item), anchor, dim: true }, (body) => body.add(this.scene.add.text(0, 0, `${this.description(item)}\n\n보유 ${item.quantity}`, textStyle({ role: "body", size: 22, align: "center", wrap: 340 })).setOrigin(0.5))); return; }
    this.popups.confirm({ title: this.label(item), message: "아이템을 1개 사용하시겠습니까?", confirmLabel: "사용" }, () => { void this.api.useConsumable({ itemId: item.definitionId, quantity: 1 }).then((result) => { this.inventory.applyConsumableResult(result.wallet, result.items); this.items = result.items; this.onWalletChanged?.(); this.popups.open({ width: 440, height: 250, title: "사용 완료", dim: true }, (body) => body.add(this.scene.add.text(0, 0, `스테미나 +${result.appliedAmount}`, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5))); if (this.view) this.render(this.view); }); });
  }
}
