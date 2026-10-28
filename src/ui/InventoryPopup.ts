import { showContentToast } from "./ContentToast";
import Phaser from "phaser";
import { audioManager } from "../managers/AudioManager";
import { slideTabPage } from "./screenTransition";
import { t, type TextKey } from "../i18n";
import { GameApiError, type GameApi } from "../api/contracts";
import type { ItemCategory } from "../data/items";
import { setDebugInventoryCategory, setDebugInventoryTextureKeys } from "../debug";
import { DEFAULT_INVENTORY_SORT, INVENTORY_LAYOUT, InventoryManager, inventoryGridPosition, inventoryScrollMetrics, type InventoryDisplayItem, type InventorySort } from "../managers/InventoryManager";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { addFrameAmount, addItemFrame, ITEM_FRAME } from "./itemFrame";
import { INVENTORY_TAB_CLEARANCE, INVENTORY_TAB_LAYOUT, inventoryCategoryTabPosition } from "./inventoryTabs";
import { addCategoryTab } from "./CategoryTab";
import { POPUP_TITLE_SIZE, PopupLayer } from "./PopupLayer";
import { equippedRuneSlot, openRuneInfoPopup } from "./RunePopup";
import { createRuneListState, RuneListControls, visibleRuneList, type RuneListState } from "./RuneListControls";
import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";
import { addRuneCard, runeTexture } from "./runeIcons";
import { COLOR } from "./theme";
import { formatCurrency } from "../core/formatCurrency";
import { managerEvents } from "../managers/ManagerEvents";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { ItemGuidePopup } from "./ItemGuidePopup";
import { addItemDefinitionIcon } from "./itemDefinitionIcon";
import { addExpiryTag, soonestItemExpiry } from "./itemExpiry";
import type { CurrencyGuideAction } from "../data/currencyGuide";
import { RELIC_GRID_INTRO, relicGridIntroDelay } from "./relicGridLayout";
import { motionPolicy } from "../core/settings";
import { universalFragmentRarity } from "../core/relicProgression";
import { addUniversalFragmentArt, addUniversalFragmentGlass, universalFragmentTexture } from "./universalFragmentArt";
import { onTap } from "./tapGuard";
import { attachDragScroll } from "./dragScroll";
import { addScrollHint } from "./ScrollHint";
import { addClippedHit } from "./clippedHit";
import type { ClipRect } from "./clipRect";

const CATEGORIES: readonly { id: ItemCategory; labelKey: TextKey }[] = [
  { id: "rune", labelKey: "inventory.tab.rune" }, { id: "currency", labelKey: "inventory.tab.currency" }, { id: "consumable", labelKey: "inventory.tab.consumable" }, { id: "material", labelKey: "inventory.tab.material" },
];
// 900px 작업판에서 좌우 48px만 안전 여백으로 남기고 본문이 나머지를 모두 사용한다.
const POPUP_WIDTH = 900; const POPUP_HEIGHT = 1510; const BODY_SAFE_X = 48; const LIST_TOP = -550; const TAB_CLEARANCE = INVENTORY_TAB_CLEARANCE;
/**
 * 룬 탭의 조작 두 줄(필터·검색·정렬 / 토글) — 첫 줄 가운데가 제목표 띠 바로 아래에 선다.
 * 두 줄이 서는 만큼 룬 탭만 목록 윗변이 내려간다(`RUNE_LIST_TOP`).
 */
const RUNE_CONTROLS_Y = -622;
const RUNE_LIST_TOP = RUNE_CONTROLS_Y - RUNE_LIST_CONTROLS.rowHeight / 2 + RUNE_LIST_CONTROLS.height + 18;
const TAB_TOP = INVENTORY_TAB_LAYOUT.centerY - INVENTORY_TAB_LAYOUT.height * INVENTORY_TAB_LAYOUT.selectedScale / 2;
/** 목록이 보이는 사각형(판 가운데 기준). 윗변만 탭에 따라 다르다. */
function listViewport(top: number): { x: number; y: number; width: number; height: number } {
  return { x: 0, y: (top + TAB_TOP - TAB_CLEARANCE) / 2, width: POPUP_WIDTH - BODY_SAFE_X * 2, height: TAB_TOP - TAB_CLEARANCE - top };
}
const VIEWPORT = listViewport(LIST_TOP);

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
  /** 룬 탭의 검색·필터·정렬. 토글은 설정(`settings.game.runeBag`)에 남는다. */
  private readonly runeList: RuneListState = createRuneListState();
  /** 목록만 담는 층. 조건이 바뀌면 이 층만 다시 그린다 — 조작 줄까지 다시 세우면 검색 칸의 초점이 끊긴다. */
  private listLayer?: Phaser.GameObjects.Container;
  private runeControls?: RuneListControls;
  private maskShape?: Phaser.GameObjects.Rectangle;
  /** 마스크를 실제로 걸어 둔 컨테이너. 풀 때 이 자리에서 지워야 죽은 마스크가 남지 않는다. */
  private maskedContent?: Phaser.GameObjects.Container;
  /** 이번 그리기가 칸을 차례로 깔아 들이는가(`render`의 `deal`). */
  private dealing = false;
  private geometryMask?: Phaser.Display.Masks.GeometryMask;
  /** 중첩 상세 팝업 유무와 무관하게 가방 자체를 닫는 전용 콜백이다. */
  private closePopup?: () => void;
  private readonly inventory = new InventoryManager(session);
  private unsubscribeInventory?: () => void;
  private inventoryDirty = false;
  private readonly refreshVisible = (): void => {
    if (!this.inventoryDirty || !this.body || !this.view || !this.popups.isTop(this.body)) return;
    this.inventoryDirty = false; this.render(this.view);
  };

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, private readonly api: GameApi, private readonly onClose?: () => void, private readonly onCurrencyAction?: (action: CurrencyGuideAction) => void) {}

  /** 중복 열기를 막고 조회가 끝난 뒤 현재 탭을 그린다. */
  open(): void {
    if (this.body) return;
    const width = POPUP_WIDTH; const height = POPUP_HEIGHT;
    this.body = this.popups.open({ width, height, title: t("inventory.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: true, hideCloseButton: true, onClose: () => { this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.refreshVisible); this.inventoryDirty = false; this.unsubscribeInventory?.(); this.unsubscribeInventory = undefined; setDebugInventoryCategory(undefined); this.body = undefined; this.view = undefined; this.closePopup = undefined; this.onClose?.(); } }, (body, close) => {
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
        if (this.view !== view || !view.active) return;
        this.render(view, true);
        // 초기 응답 이후에는 DTO 대신 manager의 인벤토리 확정 신호만 받아 현재 표시 모델을 다시 읽는다.
        if (!this.body || !this.view) return;
        this.unsubscribeInventory = managerEvents.subscribe("inventory", () => { this.inventoryDirty = true; });
        this.scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.refreshVisible);
      });
    });
  }

  close(): void { this.closePopup?.(); }

  /** 탭과 목록만 다시 만들어 서버/세션 상태를 UI 객체가 직접 수정하지 않게 한다. */
  /**
   * `deal`이면 칸이 **도감과 같은 몫으로 촤르륵 깔린다**(`RELIC_GRID_INTRO`) — 판을 열 때와 탭을 바꿀
   * 때만이다. 정렬을 바꾸거나 쓰고 난 뒤 다시 그릴 때까지 깔리면 같은 목록이 매번 새로 열린 것처럼 읽힌다.
   */
  private render(body: Phaser.GameObjects.Container, deal = false): void {
    // 탭 전환 전에 display-list 밖의 GeometryMask까지 명시적으로 해제한다.
    this.destroyMask();
    body.removeAll(true);
    this.runeControls = undefined;
    // Canvas DOM만 보는 E2E에는 비동기 조회 완료와 실제 선택 탭을 최소 디버그 상태로 알린다.
    setDebugInventoryCategory(this.category);
    const layer = this.scene.add.container(0, 0);
    this.listLayer = layer;
    body.add(layer);
    // 생성과 입력 피드백은 한 헬퍼를 통과시켜 네 탭의 면·클릭 범위가 갈라지지 않게 한다.
    CATEGORIES.forEach((tab, index) => this.addCategoryTab(body, tab, index));
    if (this.category === "rune") {
      const right = POPUP_WIDTH / 2 - BODY_SAFE_X;
      this.runeControls = new RuneListControls({
        scene: this.scene, parent: body, popups: this.popups, left: -right, right, y: RUNE_CONTROLS_Y,
        state: this.runeList, parts: true, onChange: () => this.renderList(body, false),
        isActive: () => this.popups.isTop(body),
      });
    }
    this.renderList(body, deal);
  }

  /** 목록 층만 다시 그린다. 정렬·필터·검색·토글이 바뀔 때와 탭을 그릴 때 지난다. */
  private renderList(body: Phaser.GameObjects.Container, deal: boolean): void {
    const layer = this.listLayer;
    if (!layer?.active) return;
    this.dealing = deal && motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
    this.destroyMask();
    layer.removeAll(true);
    // 매 렌더마다 비워 실제로 현재 탭에 놓인 이미지 키만 E2E에 남긴다.
    const textureKeys: string[] = [];
    setDebugInventoryTextureKeys(textureKeys);
    const runeTab = this.category === "rune";
    const viewport = runeTab ? listViewport(RUNE_LIST_TOP) : VIEWPORT;
    const all = this.inventory.displayList(this.category, runeTab ? this.runeList.sort : this.sort);
    // 룬은 공용 거르기(`visibleRuneList` — 토글·필터·검색)를 지난다. 정렬 순서는 위 목록이 이미 갖는다.
    const keep = runeTab ? new Set(visibleRuneList(this.runeList).map((rune) => rune.instanceId)) : undefined;
    const visible = keep ? all.filter((item) => item.kind === "rune" && keep.has(item.rune.instanceId)) : all;
    this.runeControls?.setCount(visible.length, all.length);
    // 첫 카드의 윗변을 마스크 윗변에 맞춰 아이콘/액자가 절반 잘리지 않게 한다.
    const contentStartY = viewport.y - viewport.height / 2 + INVENTORY_LAYOUT.cellHeight / 2;
    const content = this.scene.add.container(0, contentStartY);
    // 입력면과 마스크는 같은 팝업 로컬 사각형에서 만들어 좌표계 불일치를 차단한다.
    const matrix = body.getWorldTransformMatrix();
    const maskCenter = matrix.transformPoint(viewport.x, viewport.y);
    const maskRight = matrix.transformPoint(viewport.x + viewport.width / 2, viewport.y);
    const maskBottom = matrix.transformPoint(viewport.x, viewport.y + viewport.height / 2);
    // GeometryMask는 display-list 밖에 있으므로 팝업 컨테이너의 현재 월드 배율까지 반영한다.
    this.maskShape = this.scene.add.rectangle(maskCenter.x, maskCenter.y, Math.hypot(maskRight.x - maskCenter.x, maskRight.y - maskCenter.y) * 2, Math.hypot(maskBottom.x - maskCenter.x, maskBottom.y - maskCenter.y) * 2, 0xffffff).setVisible(false);
    this.geometryMask = this.maskShape.createGeometryMask(); content.setMask(this.geometryMask); this.maskedContent = content; layer.add(content);
    // 카드 입력면은 마스크가 보여 주는 창 안에서만 손을 받는다 — 마스크는 그림만 자르므로 창 밖으로 흘러간 카드가 하단 탭·빈 공간을 덮는다.
    const maskShape = this.maskShape;
    const clip = (): ClipRect => {
      if (!maskShape.active) return { left: 0, right: 0, top: 0, bottom: 0 };
      const { left, right, top, bottom } = maskShape.getBounds();
      return { left, right, top, bottom };
    };
    visible.forEach((item, index) => this.addCard(content, item, index, textureKeys, clip));
    setDebugInventoryTextureKeys(textureKeys);
    const metrics = inventoryScrollMetrics(visible.length, runeTab ? { ...INVENTORY_LAYOUT, viewportHeight: viewport.height } : INVENTORY_LAYOUT); let offset = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, metrics.minY, 0); content.y = contentStartY + offset; };
    // 칸 위에서 시작한 손도 내려가도록 씬이 듣는다(`attachDragScroll`) — 끌기 면을 칸 뒤에 두면 룬 위에서는 스크롤이 안 됐다.
    attachDragScroll(this.scene, { owner: content, root: body, bounds: () => maskShape.getBounds(), onDelta: move });
    addScrollHint(this.scene, layer, { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height, owner: content, read: () => ({ offset, min: metrics.minY }) });
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
        this.render(body, true);
        if (this.maskedContent) slideTabPage(this.scene, [this.maskedContent], from, index);
      },
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
  private addCard(content: Phaser.GameObjects.Container, item: InventoryDisplayItem, index: number, textureKeys: string[], clip: () => ClipRect): void {
    const { x, y } = inventoryGridPosition(index, INVENTORY_LAYOUT);
    const { cardWidth, cardHeight } = INVENTORY_LAYOUT;
    // 룬은 카드 한 장이 통째로 공용 프리팹이다. 장착용 가방과 같은 한 장을 써야 한쪽만
    // 옛 모습으로 남지 않는다.
    if (item.kind === "rune") {
      const slot = equippedRuneSlot(item.rune.instanceId);
      const card = addRuneCard(this.scene, x, y, cardWidth, cardHeight, item.rune, {
        dimmed: slot !== undefined,
        holder: slot && session.settings.game.runeBag.showHolder ? { relicId: slot.relicId } : undefined,
      });
      textureKeys.push(runeTexture(item.rune.rarity, item.rune.part));
      this.addCardInput(content, card, item, cardWidth, cardHeight, clip);
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
    const fragmentRarity = universalFragmentRarity(item.definition.id);
    // 만능 파편은 액자를 넘치게 키워 구운 그림이 선다(`addUniversalFragmentArt`).
    const fragmentArt = fragmentRarity ? addUniversalFragmentArt(this.scene, frameSize, universalFragmentTexture(fragmentRarity)) : undefined;
    if (fragmentArt && fragmentRarity) {
      onTexture(universalFragmentTexture(fragmentRarity));
      card.add(fragmentArt);
    } else {
      card.add(addItemDefinitionIcon(this.scene, item.definition.icon, ITEM_FRAME.shadow.offsetX, ITEM_FRAME.shadow.offsetY, iconSize, { shadow: true, onTexture }));
      card.add(addItemDefinitionIcon(this.scene, item.definition.icon, 0, 0, iconSize, { onTexture }));
    }
    if (fragmentRarity) card.add(addUniversalFragmentGlass(this.scene, frameSize, fragmentRarity));
    // 수량은 액자 오른쪽 아래에 겹친다. 보상 액자와 같은 자리라 화면이 달라도 같은 곳을 본다.
    // 골드처럼 자릿수가 큰 재화는 K·M으로 줄여 칸을 넘지 않게 한다 — 온전한 수는 눌러서 여는
    // 안내가 말한다.
    card.add(addFrameAmount(this.scene, frameSize, formatCurrency(item.quantity)));
    // 기한이 있는 칸은 가장 먼저 사라질 묶음의 남은 시간을 왼쪽 위의 붉은 표식으로 붙인다 — 수량과
    // 마주 보는 자리다. 표식은 초마다 제 한 마디를 다시 적는다(`7D` → … → `24H` → … → `60M`).
    const expiry = item.kind === "stack" && item.lot ? { expiresAt: item.lot.expiresAt } : soonestItemExpiry(item.definition.id);
    if (expiry) card.add(addExpiryTag(this.scene, -frameSize / 2 + 4, -frameSize / 2 + 4, expiry.expiresAt));
    this.addCardInput(content, card, item, cardWidth, cardHeight, clip);
  }

  /** 카드 종류와 무관하게 같은 입력면과 같은 상세 진입을 쓴다. */
  private addCardInput(content: Phaser.GameObjects.Container, card: Phaser.GameObjects.Container, item: InventoryDisplayItem, width: number, height: number, clip: () => ClipRect): void {
    const hit = addClippedHit(this.scene, card, 0, 0, width, height, clip);
    // 클릭 순간의 월드 변환을 읽어 팝업 이동·배율·스크롤 이후에도 상세창이 카드에 붙게 한다.
    onTap(hit, () => this.select(item));
    content.add(card);
    if (!this.dealing) return;
    // 도감의 카드처럼 한 뼘 아래에서 떠오르며 차례로 깔린다. 지연에는 상한이 있어 첫 줄 뒤는 함께 선다.
    const index = content.list.length - 1;
    const finalY = card.y;
    card.setAlpha(0);
    card.y = finalY + RELIC_GRID_INTRO.rise;
    this.scene.tweens.add({ targets: card, alpha: 1, y: finalY, duration: RELIC_GRID_INTRO.duration, delay: relicGridIntroDelay(index), ease: "Quad.easeOut" });
  }

  /** 룬은 룬 쪽지, 재화는 재화 안내창, 재료·소비품은 같은 양식의 아이템 안내창으로 연결한다. */
  private select(item: InventoryDisplayItem): void {
    // 룬 쪽지는 누른 칸에 붙지 않고 화면 가운데에 선다 — 옵션 다섯 줄을 담을 만큼 커진 판이라
    // 가장자리 칸에 붙이면 판 밖 우하단 뒤로가기와 겹친다.
    if (item.kind === "rune") { openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: item.rune.instanceId, api: this.api, traitResearch: true }); return; }
    // 재화 카드는 상단 칩과 같은 안내 프리팹을 스택 위에 쌓아 가방 자체를 보존한다.
    if (item.category === "currency" && item.definition.icon.kind === "currency") { new CurrencyGuidePopup(this.scene, this.popups, this.onCurrencyAction).open(item.definition.icon.key); return; }
    new ItemGuidePopup(this.scene, this.popups).open({
      definition: item.definition, quantity: item.quantity, expiry: item.kind === "stack" && item.lot ? { count: item.lot.quantity, expiresAt: item.lot.expiresAt } : soonestItemExpiry(item.definition.id),
      onUse: item.category === "consumable" ? () => this.useConsumable(item.id, item.kind === "stack" ? item.lot?.expiresAt : undefined) : undefined,
    });
  }

  /**
   * 소비품 한 개를 쓴다. 지갑 갱신은 InventoryManager.useConsumable이 managerEvents로 발행하므로
   * (TopBar가 구독) 여기서 다시 알리지 않는다. 받은 몫은 이미 지급이 끝난 영수증이라 `RewardPopup`
   * 양식이 아니라 잠금 안내와 같은 공용 토스트(`showContentToast`)로 짧게 알린다.
   */
  private useConsumable(itemId: string, lotExpiresAt?: string): void {
    void this.inventory.useConsumable(this.api, itemId, lotExpiresAt).then((result) => {
      audioManager?.playUi("stamina.refill");
      showContentToast(this.scene, t("inventory.staminaGained", { amount: result.appliedAmount }), "info");
      if (this.view) this.render(this.view);
    }).catch((error: unknown) => {
      // 가득 찬 채로 쓰면 아무것도 빠지지 않는다. 왜 쓰이지 않았는지만 짧게 말한다(토스트가 「아직」 소리를 낸다).
      if (error instanceof GameApiError && error.code === "STAMINA_FULL") showContentToast(this.scene, t("inventory.staminaFull"), "refused");
      else console.error("소비품 사용 실패", error);
    });
  }
}
