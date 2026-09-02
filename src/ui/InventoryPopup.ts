import Phaser from "phaser";
import type { GameApi } from "../api/contracts";
import { ITEM_ICON_FALLBACK, type ItemCategory, type ItemIcon } from "../data/items";
import { setDebugInventoryCategory, setDebugInventoryTextureKeys } from "../debug";
import { DEFAULT_INVENTORY_SORT, INVENTORY_LAYOUT, InventoryManager, inventoryGridPosition, inventoryScrollMetrics, type InventoryDisplayItem, type InventorySort } from "../managers/InventoryManager";
import { session } from "../state/session";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { INVENTORY_TAB_LAYOUT, inventoryCategoryTabPosition } from "./inventoryTabs";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { equippedRelicName, openRuneInfoPopup } from "./RunePopup";
import { RUNE_PART_LABELS, RUNE_RARITY_LABELS } from "../core/runes";
import { addRuneCard, runeTexture } from "./runeIcons";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { managerEvents } from "../managers/ManagerEvents";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import type { CurrencyGuideAction } from "../data/currencyGuide";

const CATEGORIES: readonly { id: ItemCategory; label: string }[] = [
  { id: "rune", label: "룬" }, { id: "currency", label: "재화" }, { id: "consumable", label: "소비품" }, { id: "material", label: "재료" },
];
// 900px 작업판에서 좌우 48px만 안전 여백으로 남기고 본문이 나머지를 모두 사용한다.
const POPUP_WIDTH = 900; const POPUP_HEIGHT = 1510; const BODY_SAFE_X = 48; const LIST_TOP = -550; const TAB_CLEARANCE = 20;
const TAB_TOP = INVENTORY_TAB_LAYOUT.centerY - INVENTORY_TAB_LAYOUT.height * INVENTORY_TAB_LAYOUT.selectedScale / 2;
const VIEWPORT = {
  x: 0,
  y: (LIST_TOP + TAB_TOP - TAB_CLEARANCE) / 2,
  width: POPUP_WIDTH - BODY_SAFE_X * 2,
  height: TAB_TOP - TAB_CLEARANCE - LIST_TOP,
} as const;

/** 넓어진 카드 안에서 액자와 텍스트 열이 서로 침범하지 않도록 한 배치표로 묶는다. */
export function inventoryCardLayout(cardWidth = INVENTORY_LAYOUT.cardWidth): { frameX: number; textX: number; textWidth: number; quantityX: number } {
  const inset = 20; const frameSize = 102; const frameGap = 18;
  const frameX = -cardWidth / 2 + inset + frameSize / 2;
  const textX = frameX + frameSize / 2 + frameGap;
  return { frameX, textX, textWidth: cardWidth / 2 - inset - textX, quantityX: frameX + frameSize / 2 - 8 };
}

/** 로비를 유지한 채 서버 확정 인벤토리를 표시하는 홀로그램 작업판이다. */
export class InventoryPopup {
  private body?: Phaser.GameObjects.Container;
  private view?: Phaser.GameObjects.Container;
  private category: ItemCategory = "rune";
  /** 정렬 선택은 팝업 생명주기 동안 유지하며 변경 렌더는 스크롤을 항상 원점으로 만든다. */
  private sort: InventorySort = { ...DEFAULT_INVENTORY_SORT };
  private maskShape?: Phaser.GameObjects.Rectangle;
  private geometryMask?: Phaser.Display.Masks.GeometryMask;
  /** 중첩 상세 팝업 유무와 무관하게 가방 자체를 닫는 전용 콜백이다. */
  private closePopup?: () => void;
  private readonly inventory = new InventoryManager(session);
  private unsubscribeInventory?: () => void;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClose?: () => void, private readonly onCurrencyAction?: (action: CurrencyGuideAction) => void) {}

  /** 중복 열기를 막고 조회가 끝난 뒤 현재 탭을 그린다. */
  open(): void {
    if (this.body) return;
    const width = POPUP_WIDTH; const height = POPUP_HEIGHT;
    this.body = this.popups.open({ width, height, title: "가방", titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.unsubscribeInventory?.(); this.unsubscribeInventory = undefined; this.destroyMask(); setDebugInventoryCategory(undefined); this.body = undefined; this.view = undefined; this.closePopup = undefined; this.onClose?.(); } }, (body, close) => {
      // 외부 돌아가기 버튼은 stack 최상단이 아니라 이 가방 판을 정확히 가리켜야 한다.
      this.closePopup = close;
      // 공용 팝업 판과 제목은 보존하고 교체 가능한 내용 전용 컨테이너만 다시 그린다.
      const view = this.scene.add.container(0, 0); this.view = view; body.add(view);
      // 닫기는 LobbyScene의 화면 우하단 공용 버튼 하나가 맡아 팝업에 붙은 중복 버튼을 만들지 않는다.
      // Manager가 조회·검증·Session 반영을 끝낸 뒤에만 단일 list 경로를 렌더링한다.
      void this.inventory.refresh(this.api).then(() => {
        this.render(view);
        // 초기 응답 이후에는 DTO 대신 manager의 인벤토리 확정 신호만 받아 현재 표시 모델을 다시 읽는다.
        this.unsubscribeInventory = managerEvents.subscribe("inventory", () => { if (this.view) this.render(this.view); });
      });
    });
  }

  close(): void { this.closePopup?.(); }

  /** 탭과 목록만 다시 만들어 서버/세션 상태를 UI 객체가 직접 수정하지 않게 한다. */
  private render(body: Phaser.GameObjects.Container): void {
    // 탭 전환 전에 display-list 밖의 GeometryMask까지 명시적으로 해제한다.
    this.destroyMask();
    body.removeAll(true);
    // Canvas DOM만 보는 E2E에는 비동기 조회 완료와 실제 선택 탭을 최소 디버그 상태로 알린다.
    setDebugInventoryCategory(this.category);
    // 매 렌더마다 비워 실제로 현재 탭에 놓인 이미지 키만 E2E에 남긴다.
    const textureKeys: string[] = [];
    setDebugInventoryTextureKeys(textureKeys);
    const visible = this.inventory.list(this.category, this.sort);
    // 첫 카드가 큰 작업판 제목의 세로 영역을 침범하지 않도록 기존 목록을 50px 내린다.
    // 첫 카드의 윗변을 마스크 윗변에 맞춰 아이콘/액자가 절반 잘리지 않게 한다.
    const contentStartY = VIEWPORT.y - VIEWPORT.height / 2 + INVENTORY_LAYOUT.cellHeight / 2;
    const content = this.scene.add.container(0, contentStartY);
    // 입력면과 마스크는 같은 팝업 로컬 사각형에서 만들어 좌표계 불일치를 차단한다.
    const matrix = body.getWorldTransformMatrix();
    const maskCenter = matrix.transformPoint(VIEWPORT.x, VIEWPORT.y);
    const maskRight = matrix.transformPoint(VIEWPORT.x + VIEWPORT.width / 2, VIEWPORT.y);
    const maskBottom = matrix.transformPoint(VIEWPORT.x, VIEWPORT.y + VIEWPORT.height / 2);
    // GeometryMask는 display-list 밖에 있으므로 팝업 컨테이너의 현재 월드 배율까지 반영한다.
    this.maskShape = this.scene.add.rectangle(maskCenter.x, maskCenter.y, Math.hypot(maskRight.x - maskCenter.x, maskRight.y - maskCenter.y) * 2, Math.hypot(maskBottom.x - maskCenter.x, maskBottom.y - maskCenter.y) * 2, 0xffffff).setVisible(false);
    this.geometryMask = this.maskShape.createGeometryMask(); content.setMask(this.geometryMask); body.add(content);
    visible.forEach((item, index) => this.addCard(content, item, index, textureKeys));
    setDebugInventoryTextureKeys(textureKeys);
    const metrics = inventoryScrollMetrics(visible.length); let offset = 0; let dragY = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); content.y = contentStartY + offset; };
    const hit = this.scene.add.rectangle(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height, 0xffffff, 0).setInteractive({ draggable: true, useHandCursor: true });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65)); body.add(hit); body.sendToBack(hit);
    // 생성과 입력 피드백은 한 헬퍼를 통과시켜 네 탭의 면·클릭 범위가 갈라지지 않게 한다.
    CATEGORIES.forEach((tab, index) => this.addCategoryTab(body, tab, index));
    if (this.category === "rune") this.addSortControls(body);
  }

  /** 서류철 라벨처럼 돌출된 단색 면과 면 전체 입력을 가진 카테고리 탭을 추가한다. */
  private addCategoryTab(body: Phaser.GameObjects.Container, tab: (typeof CATEGORIES)[number], index: number): void {
    const selected = tab.id === this.category;
    const { x, y } = inventoryCategoryTabPosition(index);
    const { width, height, selectedScale, pressedScale } = INVENTORY_TAB_LAYOUT;
    const tabContainer = this.scene.add.container(x, y);
    // 서로 다른 깎임으로 파일 라벨의 방향성을 만들고, 사방선 대신 그림자와 윗변만 남긴다.
    const face = chipPoints(width, height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 14, bottomLeft: 4 } });
    tabContainer.add(drawLayer(this.scene, 0, 0, face, {
      fill: selected ? 0x3b3326 : 0x2b3037,
      alpha: selected ? 0.98 : 0.92,
      edge: selected ? COLOR.accent : COLOR.panelEdge,
      edgeAlpha: selected ? 0.9 : 0.7,
    }));
    tabContainer.add(this.scene.add.text(0, 1, tab.label, textStyle({ role: "emphasis", size: 27, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
    if (index < CATEGORIES.length - 1) {
      // 면 사이의 짧은 세로 머리선만으로 인접 탭의 경계를 보조한다.
      tabContainer.add(drawHairline(this.scene, width / 2 + INVENTORY_TAB_LAYOUT.gap / 2, 0, height * 0.52, { color: COLOR.panelEdge, alpha: 0.55 }).setRotation(Math.PI / 2));
    }
    const restingScale = selected ? selectedScale : 1;
    tabContainer.setScale(restingScale);
    // 글자가 아닌 전체 투명 면이 입력을 받아 가장자리에서도 같은 클릭과 눌림 피드백을 준다.
    const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => tabContainer.setScale(selected ? 1.14 : pressedScale));
    hit.on("pointerout", () => tabContainer.setScale(restingScale));
    hit.on("pointerup", () => { tabContainer.setScale(restingScale); this.category = tab.id; this.render(body); });
    tabContainer.add(hit); body.add(tabContainer);
  }

  /** 기존 탭처럼 크기와 강조색만으로 선택을 알리고 누르면 정렬 및 스크롤 원점을 갱신한다. */
  private addSortControls(body: Phaser.GameObjects.Container): void {
    const keys: readonly { key: InventorySort["key"]; label: string }[] = [{ key: "acquired", label: "획득순" }, { key: "rarity", label: "등급" }, { key: "part", label: "부위" }, { key: "enhancement", label: "세공" }, { key: "equipped", label: "장착" }];
    keys.forEach(({ key, label }, index) => {
      const selected = this.sort.key === key; const node = this.scene.add.container(-300 + index * 150, -620).setScale(selected ? 1.12 : 1);
      node.add(this.scene.add.text(0, 0, `${label}${selected ? (this.sort.direction === "asc" ? " ↑" : " ↓") : ""}`, textStyle({ role: "emphasis", size: 20, color: selected ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5));
      const hit = this.scene.add.rectangle(0, 0, 130, 54, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => node.setScale(1.16));
      hit.on("pointerup", () => { this.sort = { key, direction: selected && this.sort.direction === "asc" ? "desc" : "asc" }; this.render(body); });
      node.add(hit); body.add(node);
    });
  }

  /** GeometryMask와 원본 도형은 컨테이너 자식이 아니므로 둘 다 소유자가 직접 파괴한다. */
  private destroyMask(): void {
    this.view?.clearMask(true);
    this.geometryMask?.destroy(); this.geometryMask = undefined;
    this.maskShape?.destroy(); this.maskShape = undefined;
  }

  /** 획득 팝업처럼 액자 우하단에 보유량을 겹쳐 한 그림과 한 수로 읽히게 한다. */
  private addCard(content: Phaser.GameObjects.Container, item: InventoryDisplayItem, index: number, textureKeys: string[]): void {
    const { x, y } = inventoryGridPosition(index, INVENTORY_LAYOUT);
    const { cardWidth, cardHeight } = INVENTORY_LAYOUT;
    const { frameX, textX, textWidth, quantityX } = inventoryCardLayout(cardWidth);
    const shape = chipPoints(cardWidth, cardHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    // 룬은 카드 한 장이 통째로 공용 프리팹이다. 장착용 가방과 같은 한 장을 써야 한쪽만
    // 옛 모습으로 남지 않는다.
    const card = item.kind === "rune"
      ? addRuneCard(this.scene, x, y, cardWidth, cardHeight, item.rune, { dimmed: equippedRelicName(item.rune.instanceId) !== undefined })
      : this.scene.add.container(x, y);
    if (item.kind === "rune") {
      textureKeys.push(runeTexture(item.rune.rarity, item.rune.part));
    } else {
      card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x151a21, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.35 }));
      const frame = chipPoints(102, 102, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
      card.add(drawLayer(this.scene, frameX, -12, frame, { fill: 0x24282e, alpha: 1 })); card.add(drawShapeOutline(this.scene, frameX, -12, frame, { color: COLOR.accent, alpha: 0.7 })); card.add(drawInnerVignette(this.scene, frameX, -12, frame));
      // 액자 안 콘텐츠만 아래 판별 함수에 맡겨 불투명 면·사방 outline·내부 vignette는 항상 유지한다.
      card.add(this.renderDefinitionIcon(item.definition.icon, frameX, -12, textureKeys));
    }
    if (item.kind !== "rune") {
      card.add(this.scene.add.text(textX, -48, this.label(item), textStyle({ role: "display", size: 22, color: COLOR.ink, wrap: textWidth })).setOrigin(0, 0));
      card.add(this.scene.add.text(textX, -10, this.description(item), textStyle({ role: "body", size: 17, color: COLOR.inkDim, wrap: textWidth })).setOrigin(0, 0));
      card.add(this.scene.add.text(quantityX, 58, String(item.quantity), textStyle({ role: "emphasis", size: 24 })).setOrigin(1, 1).setStroke("#05070a", 5));
    }
    const hit = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 클릭 순간의 월드 변환을 읽어 팝업 이동·배율·스크롤 이후에도 상세창이 카드에 붙게 한다.
    hit.on("pointerup", () => { const anchor = card.getWorldTransformMatrix().transformPoint(0, 0); this.select(item, { x: anchor.x, y: anchor.y }); }); card.add(hit); content.add(card);
  }

  /** currency → item asset → glyph fallback 순서를 한곳에 고정하고 누락 texture를 국소 복구한다. */
  private renderDefinitionIcon(icon: ItemIcon, x: number, y: number, textureKeys: string[]): Phaser.GameObjects.GameObject {
    if (icon.kind === "currency") {
      const key = CURRENCY_ICON_BY_WALLET[icon.key]; textureKeys.push(key);
      return this.scene.add.image(x, y, key).setDisplaySize(70, 70);
    }
    if (icon.kind === "asset" && this.scene.textures.exists(icon.key)) {
      textureKeys.push(icon.key);
      return this.scene.add.image(x, y, icon.key).setDisplaySize(70, 70);
    }
    // 정의 glyph와 누락 asset의 공용 glyph를 마지막 경로로만 사용한다.
    return drawGlyph(this.scene, icon.kind === "glyph" ? icon.key : ITEM_ICON_FALLBACK, x, y, 48, COLOR.accent);
  }

  private label(item: InventoryDisplayItem): string { return item.kind === "rune" ? item.rune.customName ?? item.rune.baseName : item.definition.name; }
  private description(item: InventoryDisplayItem): string {
    if (item.kind !== "rune") return item.definition.description;
    // 카드에는 선택에 필요한 등급·부위·장착 상태만 두고 정적 개발 설명은 반복하지 않는다.
    const equipped = equippedRelicName(item.rune.instanceId);
    return `${RUNE_RARITY_LABELS[item.rune.rarity]} · ${RUNE_PART_LABELS[item.rune.part]}${equipped ? `\n장착 · ${equipped}` : ""}`;
  }

  /** 룬은 기존 정보창, 소비품은 확인 후 서버 결과, 재화·재료는 읽기 전용 상세로 연결한다. */
  private select(item: InventoryDisplayItem, anchor: { x: number; y: number }): void {
    if (item.kind === "rune") { openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: item.rune.instanceId, anchor, api: this.api }); return; }
    // 재화 카드는 상단 칩과 같은 안내 프리팹을 스택 위에 쌓아 가방 자체를 보존한다.
    if (item.category === "currency" && item.definition.icon.kind === "currency") { new CurrencyGuidePopup(this.scene, this.popups, this.onCurrencyAction).open(item.definition.icon.key); return; }
    if (item.category !== "consumable") { this.popups.open({ width: 440, height: 280, title: this.label(item), anchor, dim: true }, (body) => body.add(this.scene.add.text(0, 0, `${this.description(item)}\n\n보유 ${item.quantity}`, textStyle({ role: "body", size: 22, align: "center", wrap: 340 })).setOrigin(0.5))); return; }
    // 지갑 갱신은 InventoryManager.useConsumable이 이미 managerEvents로 발행하므로(TopBar가 구독)
    // 여기서 다시 알리지 않는다.
    this.popups.confirm({ title: this.label(item), message: "아이템을 1개 사용하시겠습니까?", confirmLabel: "사용" }, () => { void this.inventory.useConsumable(this.api, item.id).then((result) => { this.popups.open({ width: 440, height: 250, title: "사용 완료", dim: true }, (body) => body.add(this.scene.add.text(0, 0, `스테미나 +${result.appliedAmount}`, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5))); if (this.view) this.render(this.view); }); });
  }
}
