import Phaser from "phaser";
import type { GameApi, ProductDto, ProgressPassDto, ProgressPassMilestoneDto } from "../api/contracts";
import type { PlatformPaymentAdapter } from "../api/PlatformPayment";
import { runPlatformPurchase } from "../api/platformPurchase";
import { formatCurrency } from "../core/formatCurrency";
import { t, type TextKey } from "../i18n";
import { platformPayment } from "../platform/payment";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, drawShapeOutline, HoloBar, slantedRect, toPoints } from "./holo";
import { addFrameAmount, addFramedIcon, guideForIcon } from "./itemFrame";
import { PASS_POPUP, passPopupColumns, passPopupFrameXs, passPopupListHeaderY, passPopupMinScroll, passPopupPassMinScroll, passPopupPassStrip, passPopupPassTabs, passPopupRailFill, passPopupRowY, passPopupScrollFor, passPopupViewport } from "./passPopupLayout";
import { passLevelOf, passReadyCount, storyPassStageId } from "./passPopupModel";
import { shapeClipMask } from "./popupArt";
import { pressIn, pressOut } from "./pressFeedback";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import type { PopupLayer } from "./PopupLayer";
import { grantTiles } from "./premiumModel";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";
import { addSectionTitle } from "./SectionTitle";
import { paintShowcaseCard, showcaseCardShape } from "./showcaseCardChrome";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/** 패스마다의 색. 게이지·유료 칸·탭이 같은 값을 읽는다 — 스토리는 금빛, 레벨은 초록, 레이드는 보랏빛. */
export const PROGRESS_PASS_TONE: Readonly<Record<ProgressPassDto["id"], number>> = {
  story: 0xe0a83e, level: 0x6fc47f, raid: 0xb48ce0, archaeology: 0xd08a5a,
};

/** 진행도 한 줄(「스토리 클리어 12 / 30」). */
export function progressPassProgressLabel(pass: Pick<ProgressPassDto, "metric" | "progress" | "goal">): string {
  return t(`shop.premium.pass.metric.${pass.metric}` as TextKey, { progress: Math.min(pass.progress, pass.goal), goal: pass.goal });
}

/** 미션 한 줄의 문장 — 스토리는 「스토리 1-3 클리어」, 나머지는 문턱 수를 그대로 쓴다. */
export function progressPassMissionLabel(metric: ProgressPassDto["metric"], threshold: number): string {
  if (metric === "storyClears") return t("lobby.pass.mission.storyClears", { stage: storyPassStageId(threshold) });
  return t(`lobby.pass.mission.${metric}` as TextKey, { threshold });
}

export type PassPopupMode = "reward" | "mission";

export interface PassPopupOptions {
  api: GameApi;
  /** 먼저 보여 줄 패스. 비우면 맨 앞이다. */
  passId?: ProgressPassDto["id"];
  /** 결제 SDK 어댑터. 비우면 빌드가 가진 어댑터를 결제 순간에 읽는다. */
  payment?: PlatformPaymentAdapter;
  /** 받기·열기가 끝났거나 창이 닫힌 뒤 — 로비가 홍보 칸과 상단 줄을 새로 읽는다. */
  onChanged?: () => void;
}

/**
 * 로비의 패스 창 — 스토리·레벨·레이드 패스를 **한 창에 모아** 보여 준다.
 *
 * 위에서부터 패스 이름 → 패스 레벨과 레벨 단위로 끊긴 게이지 → 목록 → 미션·보상 탭과 받기 → 패스 탭이다.
 * 보상 목록은 마디마다 **왼쪽 무료 칸 · 가운데 레벨 · 오른쪽 유료 칸**이 주르륵 깔리고 창 안에서 아래로 흐른다.
 * 가운데 레벨 열을 세로 게이지가 꿰뚫고 내려가 닿은 레벨까지 한 칸씩 차오르며, 받을 수 있는 칸은 임무처럼 노랗게
 * 숨 쉬고 누르면 받는다. 유료 칸 머리의 버튼으로 패스를 연다(상점에는 패스를 세우지 않는다).
 *
 * 탭을 바꿔도 창을 닫았다 열지 않고 **안쪽만 다시 그린다** — 제목(패스 이름)도 안쪽이 갖는다. 스크롤 자리는 패스·탭마다
 * 기억해 받기 뒤 다시 그려도 손이 보던 줄에 남는다.
 */
export async function openPassPopup(scene: Phaser.Scene, popups: PopupLayer, options: PassPopupOptions): Promise<void> {
  const [list, catalog] = await Promise.all([options.api.getProgressPasses(), options.api.getProducts("premium")]);
  if (!scene.scene.isActive()) return;
  let passes = list.passes;
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  let passId = options.passId ?? passes[0]?.id;
  let mode: PassPopupMode = "reward";
  let pending = false;
  const scrolls = new Map<string, number>();
  /** 패스 탭 줄의 가로 자리 — 다시 그려도 보던 자리에 남는다. 처음에는 고른 패스가 보이게 맞춘다. */
  let stripScroll: number | undefined;
  const { width, height } = PASS_POPUP;

  popups.open({ width, height, dim: true, closeOnBackdrop: true, backButton: true, onClose: () => options.onChanged?.() }, (body) => {
    let root = scene.add.container(0, 0);
    body.add(root);

    const render = (message = ""): void => {
      root.destroy();
      root = scene.add.container(0, 0);
      body.add(root);
      const pass = passes.find(({ id }) => id === passId) ?? passes[0];
      if (!pass) return;
      const product = products.get(pass.productId);
      const tone = PROGRESS_PASS_TONE[pass.id];
      const top = -height / 2;
      const inner = PASS_POPUP.inner;

      // 패스 이름 — 공용 팝업 제목표와 같은 자리·같은 크기다(패스를 바꾸면 함께 바뀌므로 안쪽이 갖는다).
      addSectionTitle(scene, -width / 2 + Math.min(width, height) * 0.1, top, product?.name ?? pass.id, { size: POPUP_TITLE_SIZE.note, parent: root });

      // 패스 레벨과 게이지 — 마디 하나가 한 칸이다.
      const level = passLevelOf(pass);
      const H = PASS_POPUP.header;
      root.add(scene.add.text(-inner / 2, top + H.levelY, t("lobby.pass.level", { level: level.level, max: level.max }), textStyle({ role: "display", size: H.levelSize, color: COLOR.ink }))
        .setOrigin(0, 0.5).setStroke("#000000", 6));
      // 열지 않은 패스면 오른쪽 위에 패키지 카드가 뜨므로, 진행도와 게이지는 카드 왼쪽까지만 쓴다.
      const offer = !pass.owned && product ? PASS_POPUP.offer : undefined;
      const headerRight = offer ? width / 2 - offer.inset - offer.width - offer.gap : inner / 2;
      const headerWidth = headerRight + inner / 2;
      root.add(scene.add.text(headerRight, top + H.levelY + 6, progressPassProgressLabel(pass), textStyle({ role: "emphasis", size: H.progressSize, color: COLOR.inkDim }))
        .setOrigin(1, 0.5));
      const gauge = new HoloBar(scene, -inner / 2 + headerWidth / 2, top + H.gaugeY, headerWidth, H.gaugeHeight, { color: tone, trackAlpha: 0.85, outline: true, ticks: Math.max(0, level.max - 1) });
      gauge.setValue(level.fill);
      root.add([...gauge.objects]);

      // 흐르는 목록 — 처음 열면 받을 칸(없으면 지금 레벨)이 창 가운데쯤 오게 둔다.
      const key = `${pass.id}:${mode}`;
      const firstReady = pass.milestones.findIndex(({ freeState, state }) => freeState === "claimable" || state === "claimable");
      const focus = firstReady >= 0 ? firstReady : Math.min(level.level, level.max - 1);
      const list = mountScrollList(scene, root, pass.milestones.length, scrolls.get(key) ?? passPopupScrollFor(focus, pass.milestones.length), (value) => scrolls.set(key, value));
      if (mode === "reward") {
        paintRewardHeader(scene, root, pass, tone);
        paintRewardList(scene, list, pass, tone, () => void claim(pass));
      } else {
        paintMissionList(scene, root, list, pass, tone);
      }
      list.refresh();

      // 목록 아래 — 왼쪽에 미션·보상 탭, 오른쪽에 받기.
      const M = PASS_POPUP.modeRow;
      const modeY = height / 2 - M.fromBottom;
      (["mission", "reward"] as const).forEach((id, index) => {
        addCategoryTab(scene, root, {
          x: -inner / 2 + M.tabWidth / 2 + index * (M.tabWidth + M.tabGap), y: modeY, width: M.tabWidth, height: M.tabHeight,
          label: t(`lobby.pass.tab.${id}`), selected: mode === id,
          onSelect: () => { if (mode !== id) { mode = id; render(); } },
        });
      });
      const ready = passReadyCount(pass);
      if (ready > 0) {
        root.add(new Button(scene, inner / 2 - M.button.width / 2, modeY, {
          width: M.button.width, height: M.button.height, variant: "primary", label: t("lobby.pass.claimAll", { count: ready }),
          onClick: () => void claim(pass),
        }));
      } else {
        root.add(scene.add.text(inner / 2, modeY, t("lobby.pass.nothing"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
      }
      if (message) {
        root.add(scene.add.text(0, modeY - M.tabHeight / 2 - 30, message, textStyle({ role: "body", size: 22, color: COLOR.dangerText, align: "center", wrap: inner })).setOrigin(0.5));
      }

      // 맨 아래 — 패스 탭. 받을 것이 있는 패스는 이름 뒤에 그 수가 붙는다.
      const P = PASS_POPUP.passRow;
      const tabs = passPopupPassTabs(passes.length);
      const strip = mountPassStrip(scene, root, passes.length, passes.findIndex(({ id }) => id === pass.id), stripScroll, (value) => { stripScroll = value; });
      passes.forEach((entry, index) => {
        const name = products.get(entry.productId)?.name ?? entry.id;
        const count = passReadyCount(entry);
        strip.add(addCategoryTab(scene, undefined, {
          x: tabs.xs[index]!, y: 0, width: tabs.width, height: P.tabHeight,
          label: count > 0 ? t("lobby.pass.tabCount", { name, count }) : name, selected: entry.id === pass.id,
          // 옆으로 끌다 놓은 손은 탭을 고르지 않는다.
          onSelect: () => { if (!strip.dragging() && passId !== entry.id) { passId = entry.id; render(); } },
        }));
      });
      strip.refresh();

      // 열지 않은 패스 — 창 오른쪽 위에 떠 있는 패키지 카드. 맨 나중에 얹어 창의 무엇보다 위에 선다.
      if (offer && product) paintPassOffer(scene, root, pass, product, tone, width / 2 - offer.inset - offer.width / 2, top + offer.centerY, () => void unlock(pass, product));
    };

    async function claim(pass: ProgressPassDto): Promise<void> {
      if (pending) return;
      pending = true;
      try {
        const result = await options.api.claimProgressPass({ passId: pass.id, requestId: `pass-${pass.id}-${Date.now()}` });
        passes = result.passes;
        render();
        openRewardPopup(scene, popups, { title: t("shop.premium.pass.rewardTitle"), items: productGrantsToRewardItems(result.granted) });
      } catch (error) {
        render(error instanceof Error ? error.message : t("shop.purchase.failed"));
      } finally {
        pending = false;
      }
    }

    async function unlock(pass: ProgressPassDto, product: ProductDto | undefined): Promise<void> {
      if (pending || !product) return;
      pending = true;
      try {
        const outcome = await runPlatformPurchase(options.api, options.payment ?? platformPayment(), product);
        if (outcome.status === "purchased") {
          passes = (await options.api.getProgressPasses()).passes;
          passId = pass.id;
          render();
          return;
        }
        render(outcome.status === "cancelled" ? t("shop.premium.cancelled")
          : outcome.status === "unsupported" ? t("shop.premium.unsupported")
          : outcome.message || t("shop.purchase.failed"));
      } finally {
        pending = false;
      }
    }

    render();
  });
}

/** 흐르는 목록 한 장 — 줄을 더하는 곳, 끌기 중인지, 줄 가시성을 다시 맞추는 손을 함께 돌려준다. */
interface PassScrollList {
  content: Phaser.GameObjects.Container;
  addRow: (row: Phaser.GameObjects.Container) => void;
  /** 방금 손이 끌기였는가 — 줄 안의 누름은 이 값이 참이면 무시한다(끌다 놓은 손이 보상을 받지 않게). */
  dragging: () => boolean;
  /** 이 목록이 사는 동안만 도는 맥동을 맡긴다. */
  track: (tween: Phaser.Tweens.Tween) => void;
  refresh: () => void;
}

/**
 * 머리 줄 아래에서 탭 줄 한 뼘 위까지 — 그 창 안에서 줄이 위아래로 흐른다.
 *
 * 끌기는 바탕의 투명 판이 아니라 **씬의 포인터**로 잰다. 줄 안의 액자가 제 누름을 받아 가므로, 바탕 판에만 끌기를 걸면
 * 액자 위에서 시작한 손이 목록을 움직이지 못한다. 창 밖으로 나간 줄은 감춘다 — 마스크는 그림만 자르고 입력은 막지 않는다.
 */
function mountScrollList(scene: Phaser.Scene, root: Phaser.GameObjects.Container, count: number, start: number, remember: (value: number) => void): PassScrollList {
  const view = passPopupViewport();
  const half = PASS_POPUP.width / 2;
  const frame = scene.add.container(0, view.top);
  root.add(frame);
  const content = scene.add.container(0, 0);
  frame.add(content);
  content.setMask(shapeClipMask(scene, frame, [-half, 0, half, 0, half, view.height, -half, view.height]));
  const rows: Phaser.GameObjects.Container[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const min = passPopupMinScroll(count);
  let scroll = Phaser.Math.Clamp(start, min, 0);
  let press: { y: number; scroll: number } | undefined;
  let moved = false;

  const apply = (value: number): void => {
    if (!content.active) return;
    scroll = Phaser.Math.Clamp(value, min, 0);
    content.y = scroll;
    remember(scroll);
    const reach = PASS_POPUP.list.rowHeight / 2;
    for (const row of rows) row.setVisible(row.y + scroll + reach > 0 && row.y + scroll - reach < view.height);
  };
  const local = (pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 => frame.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
  const scaleY = (): number => frame.getWorldTransformMatrix().scaleY || 1;
  const onDown = (pointer: Phaser.Input.Pointer): void => {
    const point = local(pointer);
    moved = false;
    press = Math.abs(point.x) <= half && point.y >= 0 && point.y <= view.height ? { y: pointer.y, scroll } : undefined;
  };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!press || !pointer.isDown) return;
    const dy = (pointer.y - press.y) / scaleY();
    if (!moved && Math.abs(dy) < PASS_POPUP.dragSlop) return;
    moved = true;
    apply(press.scroll + dy);
  };
  // 놓는 손은 줄 안의 누름이 먼저 읽고 난 다음에 푼다 — 같은 사건에서 곧바로 지우면 끌기 끝이 누름으로 읽힌다.
  const onUp = (): void => { press = undefined; scene.time.delayedCall(0, () => { moved = false; }); };
  const onWheel = (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number): void => {
    const point = local(pointer);
    if (Math.abs(point.x) <= half && point.y >= 0 && point.y <= view.height) apply(scroll - dy * 0.65);
  };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  scene.input.on(Phaser.Input.Events.POINTER_WHEEL, onWheel);
  frame.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
    scene.input.off(Phaser.Input.Events.POINTER_WHEEL, onWheel);
    tweens.forEach((tween) => tween.remove());
  });
  return {
    content,
    addRow: (row) => { rows.push(row); content.add(row); },
    dragging: () => moved,
    track: (tween) => { tweens.push(tween); },
    refresh: () => apply(scroll),
  };
}

/**
 * 맨 아래 패스 탭 줄 — 고정 폭 탭이 **옆으로 흐른다**. 패스가 늘어도 칸이 좁아지지 않는다.
 *
 * 보이는 창은 창의 오른쪽 아래 빗변을 따라 잘린다(`passPopupPassStrip`). 끌기는 이 줄의 높이 안에서 시작한 손만 잡아
 * 위의 세로 목록과 서로 가로채지 않는다(목록은 제 창 안에서 시작한 손만 잡는다). 창 밖으로 나간 탭은 감춰 입력도 막는다.
 */
function mountPassStrip(scene: Phaser.Scene, root: Phaser.GameObjects.Container, count: number, selected: number, start: number | undefined, remember: (value: number) => void): {
  add: (tab: Phaser.GameObjects.Container) => void; dragging: () => boolean; refresh: () => void;
} {
  const geometry = passPopupPassStrip();
  const centerY = PASS_POPUP.height / 2 - PASS_POPUP.passRow.fromBottom;
  const frame = scene.add.container(geometry.left, centerY);
  root.add(frame);
  const content = scene.add.container(0, 0);
  frame.add(content);
  content.setMask(shapeClipMask(scene, frame, geometry.polygon.map((value, index) => index % 2 === 0 ? value - geometry.left : value - centerY)));
  const tabs: Phaser.GameObjects.Container[] = [];
  const min = passPopupPassMinScroll(count);
  const { xs, width } = passPopupPassTabs(count);
  const visibleRight = geometry.right(centerY) - geometry.left;
  // 처음에는 고른 패스가 다 보이는 자리에서 시작한다.
  const initial = start ?? Math.min(0, visibleRight - ((xs[selected] ?? 0) + width / 2));
  let scroll = Phaser.Math.Clamp(initial, min, 0);
  let press: { x: number; scroll: number } | undefined;
  let moved = false;
  const apply = (value: number): void => {
    if (!content.active) return;
    scroll = Phaser.Math.Clamp(value, min, 0);
    content.x = scroll;
    remember(scroll);
    for (const tab of tabs) tab.setVisible(tab.x + scroll + width / 2 > 0 && tab.x + scroll - width / 2 < visibleRight);
  };
  const local = (pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 => frame.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
  const inside = (point: Phaser.Math.Vector2): boolean => point.x >= 0 && point.x <= visibleRight && point.y >= geometry.top - centerY && point.y <= geometry.bottom - centerY;
  const scaleX = (): number => frame.getWorldTransformMatrix().scaleX || 1;
  const onDown = (pointer: Phaser.Input.Pointer): void => { moved = false; press = min < 0 && inside(local(pointer)) ? { x: pointer.x, scroll } : undefined; };
  const onMove = (pointer: Phaser.Input.Pointer): void => {
    if (!press || !pointer.isDown) return;
    const dx = (pointer.x - press.x) / scaleX();
    if (!moved && Math.abs(dx) < PASS_POPUP.dragSlop) return;
    moved = true;
    apply(press.scroll + dx);
  };
  const onUp = (): void => { press = undefined; scene.time.delayedCall(0, () => { moved = false; }); };
  scene.input.on(Phaser.Input.Events.POINTER_DOWN, onDown);
  scene.input.on(Phaser.Input.Events.POINTER_MOVE, onMove);
  scene.input.on(Phaser.Input.Events.POINTER_UP, onUp);
  frame.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_DOWN, onDown);
    scene.input.off(Phaser.Input.Events.POINTER_MOVE, onMove);
    scene.input.off(Phaser.Input.Events.POINTER_UP, onUp);
  });
  return { add: (tab) => { tabs.push(tab); content.add(tab); }, dragging: () => moved, refresh: () => apply(scroll) };
}

/** 보상 목록의 머리 줄(무료 · 레벨 · 패스). 열지 않은 패스면 유료 머리가 「잠김」이다 — 여는 곳은 오른쪽 위의 패키지 카드다. */
function paintRewardHeader(scene: Phaser.Scene, root: Phaser.GameObjects.Container, pass: ProgressPassDto, tone: number): void {
  const columns = passPopupColumns();
  const headerY = passPopupListHeaderY();
  root.add(scene.add.text(columns.free, headerY, t("lobby.pass.column.free"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0.5));
  root.add(scene.add.text(columns.level, headerY, t("lobby.pass.column.level"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
  const owned = pass.owned;
  const label = scene.add.text(columns.paid + 20, headerY, t(owned ? "lobby.pass.column.paid" : "lobby.pass.column.locked"), textStyle({ role: "emphasis", size: 30, color: owned ? COLOR.accentText : COLOR.inkDim })).setOrigin(0.5);
  root.add(label);
  root.add(owned
    ? drawGlyph(scene, "check", columns.paid + 20 - label.width / 2 - 24, headerY, 32, tone, 1, 4)
    : drawGlyph(scene, "lock", columns.paid + 20 - label.width / 2 - 24, headerY, 30, 0xd8dde6, 0.9));
}

/**
 * 패스를 여는 **패키지 카드** — 무역·프리미엄 전시대와 같은 겉모습(`paintShowcaseCard`)에 그 패스의 색을 입힌다.
 * 꼬리표가 창 윗변 위로 걸터앉아 창 위에 한 장 더 얹힌 물건으로 읽힌다. 안에는 패스 이름, 열면 받는 유료 보상(같은 재화는
 * 모아 많은 순으로 셋), 값이 선다. 카드 전체가 눌린다.
 */
function paintPassOffer(scene: Phaser.Scene, root: Phaser.GameObjects.Container, pass: ProgressPassDto, product: ProductDto, tone: number, x: number, y: number, onUnlock: () => void): void {
  const O = PASS_POPUP.offer;
  const card = scene.add.container(x, y);
  root.add(card);
  const left = -O.width / 2 + O.pad;
  // 숨 쉬는 빛 — 창 안의 무엇보다 먼저 눈이 가야 하는 자리지만, 받을 칸의 노란 맥동과 섞이지 않게 패스 색으로 옅게 번진다.
  const halo = drawLayer(scene, 0, 0, showcaseCardShape(O.width, O.height, 26), { fill: tone, alpha: 0.22, shadow: false }).setBlendMode(Phaser.BlendModes.ADD);
  card.add(halo);
  if (motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
    const breath = scene.tweens.add({ targets: halo, alpha: { from: 0.35, to: 1 }, duration: O.breathMs, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    card.once(Phaser.GameObjects.Events.DESTROY, () => breath.remove());
  }
  paintShowcaseCard(scene, card, { width: O.width, height: O.height, accent: tone, railX: left, tag: t("lobby.pass.unlock") });

  const name = scene.add.text(left, O.nameY, product.name, textStyle({ role: "display", size: O.nameSize, color: COLOR.ink })).setOrigin(0, 0.5).setShadow(3, 4, "#04060a", 0, true, true);
  card.add(squeezeTextToWidth(name, O.width - O.pad * 2, 0.7));

  // 열면 받는 유료 보상 — 마디마다 흩어진 같은 재화를 모아 많은 순으로 셋만 세운다.
  const totals = new Map<string, number>();
  for (const milestone of pass.milestones) for (const tile of grantTiles(milestone.rewards)) totals.set(tile.icon, (totals.get(tile.icon) ?? 0) + tile.amount);
  const tiles = [...totals].map(([icon, amount]) => ({ icon, amount })).slice(0, O.frameCap);
  const span = tiles.length * O.frame + Math.max(0, tiles.length - 1) * O.frameGap;
  tiles.forEach((tile, index) => {
    const frame = addFramedIcon(scene, card, -span / 2 + O.frame / 2 + index * (O.frame + O.frameGap), O.frameY, O.frame, tile.icon, { plain: true });
    frame.add(addFrameAmount(scene, O.frame, formatCurrency(tile.amount)));
  });

  // 값 — 프리미엄의 결제 상품과 같은 값 칸(깎인 판 + 굵은 강조색 값).
  const price = product.acquisition.kind === "platform_payment" ? product.acquisition.displayPrice : "";
  if (price) {
    const P = O.price;
    const bar = scene.add.container(0, P.y);
    bar.add(drawLayer(scene, 0, 0, chipPoints(P.width, P.height, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } }), { fill: 0x0d141c, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.7 }));
    const value = scene.add.text(0, 0, price, textStyle({ role: "display", size: P.size, color: COLOR.accentText })).setOrigin(0.5).setStroke("#000000", 6).setShadow(2, 4, "#04060a", 0, true, true);
    bar.add(squeezeTextToWidth(value, P.width - 32, 0.6));
    card.add(bar);
  }

  const hit = scene.add.polygon(0, 0, showcaseCardShape(O.width, O.height), 0xffffff, 0).setOrigin(0, 0).setInteractive({
    hitArea: new Phaser.Geom.Polygon(showcaseCardShape(O.width, O.height)), hitAreaCallback: Phaser.Geom.Polygon.Contains, useHandCursor: true,
  });
  hit.on("pointerdown", () => pressIn(card));
  hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(card); onUnlock(); });
  card.add(hit);
}

/**
 * 가운데 세로 게이지 — 줄들을 꿰뚫고 내려가며 닿은 레벨까지 패스 색으로 찬다. 레벨 마름모가 그 위에 꿰여 선다.
 */
function paintLevelRail(scene: Phaser.Scene, list: PassScrollList, pass: ProgressPassDto, tone: number, x: number): void {
  const L = PASS_POPUP.list;
  const level = passLevelOf(pass);
  const partial = level.fill * level.max - level.level;
  const start = passPopupRowY(0);
  const end = passPopupRowY(pass.milestones.length - 1);
  const fill = Math.min(end, passPopupRailFill(level.level, level.max, partial));
  const rail = scene.add.graphics();
  rail.fillStyle(0x05070a, 0.85).fillRect(x - L.rail / 2 - 3, start, L.rail + 6, end - start);
  if (fill > start) rail.fillStyle(tone, 0.95).fillRect(x - L.rail / 2, start, L.rail, fill - start);
  else if (level.level === 0 && partial > 0) rail.fillStyle(tone, 0.95).fillRect(x - L.rail / 2, start - L.rail, L.rail, L.rail);
  // 마디 사이를 가르는 흰 금 — 칸 단위로 끊겨 내려가는 것이 보이게 한다.
  rail.fillStyle(0xffffff, 0.5);
  for (let index = 0; index < pass.milestones.length - 1; index += 1) rail.fillRect(x - L.rail / 2, passPopupRowY(index) + L.rowHeight / 2 - 1, L.rail, 2);
  list.content.add(rail);
}

/** 레벨 마름모 — 닿은 레벨은 패스 색으로 채우고, 아래에 그 레벨의 문턱(관문 이름·Lv·횟수)을 적는다. */
function paintLevelBadge(scene: Phaser.Scene, row: Phaser.GameObjects.Container, x: number, index: number, pass: ProgressPassDto, tone: number): void {
  // ◈ — 바깥 마름모 테두리 안에 안쪽 마름모가 차고, 그 위에 레벨 수가 선다. 닿은 레벨만 패스 색으로 찬다.
  const B = PASS_POPUP.list.badge;
  const reached = pass.progress >= pass.milestones[index]!.threshold;
  const diamond = (w: number, h: number): number[] => [0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0];
  const outer = diamond(B.outer, B.outer);
  const inner = diamond(B.inner, B.inner);
  row.add(drawLayer(scene, x, 0, outer, { fill: 0x0b1018, alpha: 0.96 }));
  row.add(drawShapeOutline(scene, x, 0, outer, { color: reached ? tone : 0x5a6474, alpha: reached ? 1 : 0.9, width: 4 }));
  row.add(drawLayer(scene, x, 0, inner, { fill: reached ? tone : 0x1a2230, alpha: reached ? 0.95 : 0.96 }));
  row.add(drawShapeOutline(scene, x, 0, inner, { color: reached ? 0xffffff : tone, alpha: reached ? 0.75 : 0.55, width: 2 }));
  row.add(scene.add.text(x, 1, String(index + 1), textStyle({ role: "display", size: B.size, color: reached ? "#0b0f14" : COLOR.inkDim })).setOrigin(0.5));
}

/**
 * 보상 목록 — 마디가 주르륵 선다.
 *
 * 왼쪽 칸은 누구나, 오른쪽 칸은 패스를 연 사람만 받는다. 받은 칸은 눌러 두고 체크가 서며, 받을 수 있는 칸은
 * 노랗게 숨 쉬고 누르면 받는다. 패스를 열지 않았으면 오른쪽 칸 위에 자물쇠가 앉는다.
 */
function paintRewardList(scene: Phaser.Scene, list: PassScrollList, pass: ProgressPassDto, tone: number, onClaim: () => void): void {
  const columns = passPopupColumns();
  const L = PASS_POPUP.list;
  paintLevelRail(scene, list, pass, tone, columns.level);
  pass.milestones.forEach((milestone, index) => {
    const row = scene.add.container(0, passPopupRowY(index));
    // 무료 칸과 유료 칸은 판을 갈라 세운다 — 가운데 레벨 열이 둘 사이의 경계다.
    const sideShape = slantedRect(columns.sideWidth - 8, L.rowPlate, 18);
    const freeReady = milestone.freeState === "claimable";
    const paidReady = milestone.state === "claimable";
    row.add(drawLayer(scene, columns.free, 0, sideShape, { fill: 0x101722, alpha: 0.9, ...(freeReady ? { edge: COLOR.missionClaim, edgeAlpha: 0.95 } : {}) }));
    row.add(drawLayer(scene, columns.paid, 0, sideShape, { fill: tone, alpha: 0.16, ...(paidReady ? { edge: COLOR.missionClaim, edgeAlpha: 0.95 } : {}) }));
    row.add(drawLayer(scene, columns.paid, 0, sideShape, { fill: 0x101722, alpha: 0.7 }));
    paintLevelBadge(scene, row, columns.level, index, pass, tone);
    paintRewardCell(scene, list, row, columns.free, milestone.free, milestone.freeState === "claimed", false, freeReady, onClaim);
    paintRewardCell(scene, list, row, columns.paid, milestone.rewards, milestone.state === "claimed", !pass.owned, paidReady, onClaim);
    list.addRow(row);
  });
}

/**
 * 칸 하나의 액자들. 받은 칸은 그림을 눌러 두고 체크를, 열지 않은 유료 칸은 자물쇠를 얹는다.
 * 받을 수 있는 칸은 **임무의 받을 수 있는 액자와 같이** 노란 빛이 숨 쉬고 액자가 살짝 부풀었다 줄며, 누르면 받는다.
 * 그 밖의 액자는 누르면 그 재화의 안내창이 열린다.
 */
function paintRewardCell(scene: Phaser.Scene, list: PassScrollList, row: Phaser.GameObjects.Container, x: number, grants: ProgressPassMilestoneDto["rewards"], claimed: boolean, locked: boolean, ready: boolean, onClaim: () => void): void {
  const L = PASS_POPUP.list;
  const Pulse = PASS_POPUP.pulse;
  const tiles = grantTiles(grants);
  const xs = passPopupFrameXs(tiles.length);
  const moving = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  tiles.forEach((tile, index) => {
    const holder = scene.add.container(x + xs[index]!, 0);
    row.add(holder);
    if (ready) {
      const glow = L.frame + Pulse.halo;
      const halo = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      halo.fillStyle(COLOR.missionClaim, Pulse.haloAlpha).fillPoints(toPoints(chipPoints(glow, glow, { bevel: { topLeft: glow * 0.28, topRight: 0, bottomRight: glow * 0.28, bottomLeft: 0 } })), true);
      holder.add(halo);
      list.track(scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 1 }, duration: Pulse.ms + 80, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    }
    const frame = addFramedIcon(scene, holder, 0, 0, L.frame, tile.icon, {
      plain: true, iconAlpha: claimed ? 0.35 : locked ? 0.7 : 1,
      ...(ready ? { color: COLOR.missionClaim, outlineAlpha: 1 } : {}),
    });
    frame.add(addFrameAmount(scene, L.frame, formatCurrency(tile.amount)));
    // 열지 않은 유료 칸은 액자마다 자물쇠가 선다 — 칸 끝에 하나만 두면 첫 액자는 받을 수 있는 것처럼 읽힌다.
    if (locked && !claimed) holder.add(drawGlyph(scene, "lock", L.frame / 2 - 16, -L.frame / 2 + 16, 30, 0xd8dde6, 0.95));
    if (ready && moving) list.track(scene.tweens.add({ targets: frame, scale: { from: 1, to: Pulse.scale }, duration: Pulse.ms, yoyo: true, repeat: -1, ease: "Sine.InOut" }));
    const open = ready ? onClaim : guideForIcon(scene, tile.icon);
    if (!open) return;
    const hit = scene.add.rectangle(0, 0, L.frame, L.frame, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => { if (!ready) pressIn(frame); });
    hit.on("pointerout", () => { if (!ready) pressOut(frame, "normal", { pop: false }); });
    hit.on("pointerup", () => {
      if (!ready) pressOut(frame);
      if (!list.dragging()) open();
    });
    holder.add(hit);
  });
  const edge = (xs.length > 0 ? xs[xs.length - 1]! : 0) + L.frame / 2;
  if (claimed) row.add(drawGlyph(scene, "check", x + edge - 6, -L.frame / 2 + 6, 38, COLOR.accent, 1, 5));
}

/** 미션 목록 — 레벨마다 무엇을 하면 닿는지와 지금 얼마나 왔는지. 가운데 대신 왼쪽에 같은 세로 게이지가 내려간다. */
function paintMissionList(scene: Phaser.Scene, root: Phaser.GameObjects.Container, list: PassScrollList, pass: ProgressPassDto, tone: number): void {
  const L = PASS_POPUP.list;
  const inner = PASS_POPUP.inner;
  root.add(scene.add.text(-inner / 2 + 12, passPopupListHeaderY(), t(`lobby.pass.mission.lead.${pass.metric}` as TextKey), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim }))
    .setOrigin(0, 0.5));
  const badgeX = -inner / 2 + L.levelWidth / 2;
  paintLevelRail(scene, list, pass, tone, badgeX);
  const textLeft = -inner / 2 + L.levelWidth + 18;
  const textRight = inner / 2 - 40;
  pass.milestones.forEach((milestone, index) => {
    const done = pass.progress >= milestone.threshold;
    const row = scene.add.container(0, passPopupRowY(index));
    const plateWidth = inner - L.levelWidth;
    row.add(drawLayer(scene, -inner / 2 + L.levelWidth + plateWidth / 2, 0, slantedRect(plateWidth, L.rowPlate, 18), { fill: 0x101722, alpha: 0.9, ...(done ? { edge: tone, edgeAlpha: 0.6 } : {}) }));
    paintLevelBadge(scene, row, badgeX, index, pass, tone);
    const label = scene.add.text(textLeft, -24, progressPassMissionLabel(pass.metric, milestone.threshold), textStyle({ role: "emphasis", size: 30, color: done ? COLOR.ink : COLOR.inkDim }))
      .setOrigin(0, 0.5);
    const barWidth = textRight - textLeft - 160;
    row.add(squeezeTextToWidth(label, barWidth, 0.7));
    const bar = new HoloBar(scene, textLeft + barWidth / 2, 30, barWidth, 18, { color: tone, trackAlpha: 0.85, outline: true });
    bar.setValue(Math.min(1, pass.progress / milestone.threshold));
    row.add([...bar.objects]);
    if (done) {
      row.add(drawGlyph(scene, "check", textRight - 92, 0, 38, tone, 1, 5));
      row.add(scene.add.text(textRight, 0, t("lobby.pass.mission.done"), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(1, 0.5));
    } else {
      row.add(scene.add.text(textRight, 0, `${Math.min(pass.progress, milestone.threshold)} / ${milestone.threshold}`, textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(1, 0.5));
    }
    list.addRow(row);
  });
}
