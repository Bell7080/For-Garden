import Phaser from "phaser";
import { slideTabPage } from "./screenTransition";
import { t, type TextKey } from "../i18n";
import type { GameApi } from "../api/contracts";
import type { ItemCategory } from "../data/items";
import { setDebugInventoryCategory, setDebugInventoryTextureKeys } from "../debug";
import { DEFAULT_INVENTORY_SORT, INVENTORY_LAYOUT, InventoryManager, inventoryGridPosition, inventoryScrollMetrics, type InventoryDisplayItem, type InventorySort } from "../managers/InventoryManager";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { addItemFrame, ITEM_FRAME } from "./itemFrame";
import { INVENTORY_TAB_LAYOUT, inventoryCategoryTabPosition } from "./inventoryTabs";
import { addCategoryTab } from "./CategoryTab";
import { SortControl } from "./SortControl";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { equippedRelicName, openRuneInfoPopup } from "./RunePopup";
import { addRuneCard, runeTexture } from "./runeIcons";
import { COLOR, textStyle } from "./theme";
import { formatCurrency } from "../core/formatCurrency";
import { managerEvents } from "../managers/ManagerEvents";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { ItemGuidePopup } from "./ItemGuidePopup";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import type { CurrencyGuideAction } from "../data/currencyGuide";

const CATEGORIES: readonly { id: ItemCategory; labelKey: TextKey }[] = [
  { id: "rune", labelKey: "inventory.tab.rune" }, { id: "currency", labelKey: "inventory.tab.currency" }, { id: "consumable", labelKey: "inventory.tab.consumable" }, { id: "material", labelKey: "inventory.tab.material" },
];
// 900px 작업판에서 좌우 48px만 안전 여백으로 남기고 본문이 나머지를 모두 사용한다.
const POPUP_WIDTH = 900; const POPUP_HEIGHT = 1510; const BODY_SAFE_X = 48; const LIST_TOP = -550; const TAB_CLEARANCE = 20;
/** 룬 탭의 조작 줄 — 제목표 띠와 목록 윗변 사이에 선다. */
const RUNE_SORT_ROW = { y: -622, height: 64, sortWidth: 250, dirWidth: 68, gap: 12 } as const;
const TAB_TOP = INVENTORY_TAB_LAYOUT.centerY - INVENTORY_TAB_LAYOUT.height * INVENTORY_TAB_LAYOUT.selectedScale / 2;
const VIEWPORT = {
  x: 0,
  y: (LIST_TOP + TAB_TOP - TAB_CLEARANCE) / 2,
  width: POPUP_WIDTH - BODY_SAFE_X * 2,
  height: TAB_TOP - TAB_CLEARANCE - LIST_TOP,
} as const;

/**
 * 액자가 카드 한 변에서 차지하는 비율.
 *
 * 룬 카드(`addRuneCard`)와 같은 값을 써야 탭을 옮겨도 칸의 무게가 그대로다. 액자 안 그림
 * 비율과 그늘은 공용 `ITEM_FRAME.icon`·`ITEM_FRAME.shadow`를 따른다.
 */
const INVENTORY_ITEM_FRAME = { ratio: 0.89 } as const;
/**
 * 탭 이름표의 글자 크기와 줄이는 한계.
 *
 * 탭 폭은 넷이 나눠 갖는 고정값인데 낱말 길이는 언어가 정한다. 넘치면 글자만 가로로 줄이고,
 * 그래도 안 들면 거기서 멈춘다 — 더 줄이면 읽을 수 없는 글자가 된다.
 */

/** 로비를 유지한 채 서버 확정 인벤토리를 표시하는 홀로그램 작업판이다. */
export class InventoryPopup {
  private body?: Phaser.GameObjects.Container;
  private view?: Phaser.GameObjects.Container;
  private category: ItemCategory = "rune";
  /** 정렬 선택은 팝업 생명주기 동안 유지하며 변경 렌더는 스크롤을 항상 원점으로 만든다. */
  private sort: InventorySort = { ...DEFAULT_INVENTORY_SORT };
  private maskShape?: Phaser.GameObjects.Rectangle;
  /** 마스크를 실제로 걸어 둔 컨테이너. 풀 때 이 자리에서 지워야 죽은 마스크가 남지 않는다. */
  private maskedContent?: Phaser.GameObjects.Container;
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
    this.body = this.popups.open({ width, height, title: t("inventory.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.unsubscribeInventory?.(); this.unsubscribeInventory = undefined; setDebugInventoryCategory(undefined); this.body = undefined; this.view = undefined; this.closePopup = undefined; this.onClose?.(); } }, (body, close) => {
      // 외부 돌아가기 버튼은 stack 최상단이 아니라 이 가방 판을 정확히 가리켜야 한다.
      this.closePopup = close;
      /*
       * **마스크는 그것이 자르는 판과 정확히 같은 목숨을 산다.**
       *
       * 예전에는 `onClose`에서 부쉈는데, 판은 닫는 연출이 도는 0.12초 동안 아직 살아 **그리는
       * 중이다.** 그 사이 목록은 이미 죽은 GeometryMask를 가리킨 채 렌더에 들어가
       * `Cannot read properties of null (reading 'renderWebGL')`로 터졌고, 그 예외는 Phaser가
       * 다음 프레임을 예약하기 전에 나와 **게임 루프가 통째로 멈췄다** — 화면에는 닫히다 만
       * 판이 그대로 얼어붙었다(장부는 이미 닫혀 있어 다시 열 수도 없었다).
       */
      body.once(Phaser.GameObjects.Events.DESTROY, () => this.destroyMask());
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
    this.geometryMask = this.maskShape.createGeometryMask(); content.setMask(this.geometryMask); this.maskedContent = content; body.add(content);
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
    if (this.category === "rune") this.addSortControls(body, visible.length);
  }

  /**
   * 목록을 갈아 끼우는 서류철 라벨 한 장.
   *
   * **상점의 하단 탭과 같은 프리팹**(`addCategoryTab`)을 쓴다 — 두 화면이 같은 손짓으로 같은
   * 일(보는 목록을 통째로 바꾸기)을 하므로 생김새도 한 곳에서 나온다.
   */
  private addCategoryTab(body: Phaser.GameObjects.Container, tab: (typeof CATEGORIES)[number], index: number): void {
    const { x, y } = inventoryCategoryTabPosition(index);
    const { width, height } = INVENTORY_TAB_LAYOUT;
    // **문구 표를 지난다.** 키를 그대로 넘기면 화면에 `inventory.tab.rune`이 선다 — 한국어에서도
    // 같았지만 다른 언어에서 더 길어져 탭 밖으로 넘치며 눈에 띄었다.
    addCategoryTab(this.scene, body, {
      x, y, width, height, label: t(tab.labelKey), selected: tab.id === this.category,
      onSelect: () => {
        if (tab.id === this.category) return;
        const from = CATEGORIES.findIndex(({ id }) => id === this.category);
        this.category = tab.id;
        this.render(body);
        if (this.maskedContent) slideTabPage(this.scene, [this.maskedContent], from, index);
      },
    });
  }

  /**
   * 룬 탭의 조작 줄 — 왼쪽에 보유 수, 오른쪽에 **도감과 같은 정렬 칩 + 방향 칩**(`SortControl`).
   *
   * 기준 다섯을 맨 글자로 늘어놓던 때는 무엇이 눌리는 것인지, 지금 어느 기준인지가 작은 화살표
   * 하나로만 읽혔다. 도감과 같은 손짓(열고 고르는 목록 · 따로 선 방향)이면 두 화면에서 배운 것이
   * 그대로 통한다. 바꾸면 스크롤은 원점으로 돌아간다.
   */
  private addSortControls(body: Phaser.GameObjects.Container, count: number): void {
    const { y, height, sortWidth, dirWidth, gap } = RUNE_SORT_ROW;
    const right = POPUP_WIDTH / 2 - BODY_SAFE_X;
    const dirX = right - dirWidth / 2;
    const options: readonly { id: InventorySort["key"]; labelKey: TextKey }[] = [
      { id: "acquired", labelKey: "inventory.sort.acquired" }, { id: "rarity", labelKey: "inventory.sort.rarity" }, { id: "part", labelKey: "inventory.sort.part" },
      { id: "enhancement", labelKey: "inventory.sort.craft" }, { id: "equipped", labelKey: "inventory.sort.equipped" },
    ];
    const countLabel = this.scene.add.text(-right, y, t("inventory.rune.count"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5);
    body.add([countLabel, this.scene.add.text(-right + countLabel.width + 12, y, count.toLocaleString(), textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0, 0.5)]);
    new SortControl(this.scene, {
      x: dirX - dirWidth / 2 - gap - sortWidth / 2, y, height, sortWidth, dirWidth, gap, fontSize: 24, parent: body,
      sortOptions: options.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
      sortMode: this.sort.key, descending: this.sort.direction === "desc",
      onSort: (key) => { this.sort = { ...this.sort, key }; this.render(body); },
      onDirection: (descending) => { this.sort = { ...this.sort, direction: descending ? "desc" : "asc" }; this.render(body); },
    });
  }

  /**
   * 마스크를 푼다. GeometryMask와 원본 도형은 컨테이너 자식이 아니라 소유자가 직접 파괴한다.
   *
   * **걸어 둔 바로 그 컨테이너에서 지운다.** 마스크는 `view`가 아니라 그 자식인 목록
   * (`maskedContent`)에 걸려 있어, `view`에서 지우던 때는 목록이 죽은 마스크를 계속 가리켰다.
   */
  private destroyMask(): void {
    this.maskedContent?.clearMask(false);
    this.maskedContent = undefined;
    this.geometryMask?.destroy(); this.geometryMask = undefined;
    this.maskShape?.destroy(); this.maskShape = undefined;
  }

  /**
   * 칸 하나.
   *
   * 어느 탭이든 **액자 한 장**이다. 이름과 설명을 오른쪽에 늘어놓으면 한 줄에 두 칸밖에
   * 서지 못하고, 그 글은 눌러서 여는 쪽지가 이미 말한다. 수량만 액자 오른쪽 아래에 겹쳐
   * 한 그림과 한 수로 읽히게 한다.
   */
  private addCard(content: Phaser.GameObjects.Container, item: InventoryDisplayItem, index: number, textureKeys: string[]): void {
    const { x, y } = inventoryGridPosition(index, INVENTORY_LAYOUT);
    const { cardWidth, cardHeight } = INVENTORY_LAYOUT;
    // 룬은 카드 한 장이 통째로 공용 프리팹이다. 장착용 가방과 같은 한 장을 써야 한쪽만
    // 옛 모습으로 남지 않는다.
    if (item.kind === "rune") {
      const card = addRuneCard(this.scene, x, y, cardWidth, cardHeight, item.rune, { dimmed: equippedRelicName(item.rune.instanceId) !== undefined });
      textureKeys.push(runeTexture(item.rune.rarity, item.rune.part));
      this.addCardInput(content, card, item, cardWidth, cardHeight);
      return;
    }
    const card = this.scene.add.container(x, y);
    const shape = chipPoints(cardWidth, cardHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
    card.add(drawLayer(this.scene, 0, 0, shape, { fill: 0x151a21, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.35 }));
    // 그림 한 장을 담는 칸이라 공용 액자 한 장을 쓴다.
    const frameSize = Math.min(cardWidth, cardHeight) * INVENTORY_ITEM_FRAME.ratio;
    card.add(addItemFrame(this.scene, 0, 0, frameSize));
    // 그림·그늘은 공용 양식(`ITEM_FRAME.icon`·`shadow`)을 그대로 쓴다. glyph 대체 경로가
    // 있는 정의라 `addFramedIcon` 대신 같은 값으로 직접 세운다.
    const iconSize = frameSize * ITEM_FRAME.icon;
    const onTexture = (key: string): void => { textureKeys.push(key); };
    card.add(addItemDefinitionIcon(this.scene, item.definition.icon, ITEM_FRAME.shadow.offsetX, ITEM_FRAME.shadow.offsetY, iconSize, { shadow: true, onTexture }));
    card.add(addItemDefinitionIcon(this.scene, item.definition.icon, 0, 0, iconSize, { onTexture }));
    // 수량은 액자 오른쪽 아래에 겹친다. 보상 액자와 같은 자리라 화면이 달라도 같은 곳을 본다.
    // 골드처럼 자릿수가 큰 재화는 K·M으로 줄여 칸을 넘지 않게 한다 — 온전한 수는 눌러서 여는
    // 안내가 말한다.
    card.add(this.scene.add.text(frameSize / 2 - 6, frameSize / 2 - 2, formatCurrency(item.quantity), textStyle({ role: "emphasis", size: 32 })).setOrigin(1, 1).setStroke("#05070a", 4).setShadow(0, 2, "#05070a", 3, true, true));
    this.addCardInput(content, card, item, cardWidth, cardHeight);
  }

  /** 카드 종류와 무관하게 같은 입력면과 같은 상세 진입을 쓴다. */
  private addCardInput(content: Phaser.GameObjects.Container, card: Phaser.GameObjects.Container, item: InventoryDisplayItem, width: number, height: number): void {
    const hit = this.scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    // 클릭 순간의 월드 변환을 읽어 팝업 이동·배율·스크롤 이후에도 상세창이 카드에 붙게 한다.
    hit.on("pointerup", () => this.select(item));
    card.add(hit);
    content.add(card);
  }

  /** 룬은 룬 쪽지, 재화는 재화 안내창, 재료·소비품은 같은 양식의 아이템 안내창으로 연결한다. */
  private select(item: InventoryDisplayItem): void {
    // 룬 쪽지는 누른 칸에 붙지 않고 화면 가운데에 선다 — 옵션 다섯 줄을 담을 만큼 커진 판이라
    // 가장자리 칸에 붙이면 판 밖 우하단 뒤로가기와 겹친다.
    if (item.kind === "rune") { openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: item.rune.instanceId, api: this.api }); return; }
    // 재화 카드는 상단 칩과 같은 안내 프리팹을 스택 위에 쌓아 가방 자체를 보존한다.
    if (item.category === "currency" && item.definition.icon.kind === "currency") { new CurrencyGuidePopup(this.scene, this.popups, this.onCurrencyAction).open(item.definition.icon.key); return; }
    new ItemGuidePopup(this.scene, this.popups).open({
      definition: item.definition, quantity: item.quantity,
      onUse: item.category === "consumable" ? () => this.useConsumable(item.id) : undefined,
    });
  }

  /**
   * 소비품 한 개를 쓴다. 지갑 갱신은 InventoryManager.useConsumable이 managerEvents로 발행하므로
   * (TopBar가 구독) 여기서 다시 알리지 않는다. 받은 몫은 이미 지급이 끝난 영수증이라 `RewardPopup`
   * 양식이 아니라 짧은 결과 쪽지로 알린다.
   */
  private useConsumable(itemId: string): void {
    void this.inventory.useConsumable(this.api, itemId).then((result) => {
      this.popups.open({ width: 440, height: 250, title: t("inventory.useDone"), dim: true }, (body) => body.add(this.scene.add.text(0, 0, t("inventory.staminaGained", { amount: result.appliedAmount }), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0.5)));
      if (this.view) this.render(this.view);
    });
  }
}
