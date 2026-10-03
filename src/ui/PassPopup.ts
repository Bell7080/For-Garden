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
import { drawLayer, HoloBar, slantedRect } from "./holo";
import { addFrameAmount, addFramedIcon } from "./itemFrame";
import { PASS_POPUP, passPopupColumns, passPopupFrameXs, passPopupListHeaderY, passPopupPassTabs, passPopupRowY } from "./passPopupLayout";
import { passLevelOf, passReadyCount } from "./passPopupModel";
import { POPUP_TITLE_SIZE } from "./popupGeometry";
import type { PopupLayer } from "./PopupLayer";
import { grantTiles } from "./premiumModel";
import { openRewardPopup, productGrantsToRewardItems } from "./RewardPopup";
import { addSectionTitle } from "./SectionTitle";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/** 패스마다의 색. 게이지·유료 칸·탭이 같은 값을 읽는다 — 스토리는 금빛, 레벨은 초록, 레이드는 보랏빛. */
export const PROGRESS_PASS_TONE: Readonly<Record<ProgressPassDto["id"], number>> = {
  story: 0xe0a83e, level: 0x6fc47f, raid: 0xb48ce0,
};

/** 진행도 한 줄(「스토리 클리어 12 / 30」). */
export function progressPassProgressLabel(pass: Pick<ProgressPassDto, "metric" | "progress" | "goal">): string {
  return t(`shop.premium.pass.metric.${pass.metric}` as TextKey, { progress: Math.min(pass.progress, pass.goal), goal: pass.goal });
}

/** 마디 하나의 문턱(「13회 클리어」·「Lv.30」·「8회 도전」). */
export function progressPassStepLabel(metric: ProgressPassDto["metric"], threshold: number): string {
  return t(`shop.premium.pass.step.${metric}` as TextKey, { threshold });
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
 * 보상 목록은 마디마다 **왼쪽 무료 칸 · 가운데 레벨 · 오른쪽 유료 칸**이 주르륵 깔리고, 유료 칸 머리의 버튼으로
 * 패스를 연다(상점에는 패스를 세우지 않는다). 미션 목록은 레벨마다 무엇을 하면 닿는지를 말한다.
 *
 * 탭을 바꿔도 창을 닫았다 열지 않고 **안쪽만 다시 그린다** — 제목(패스 이름)도 안쪽이 갖는다.
 */
export async function openPassPopup(scene: Phaser.Scene, popups: PopupLayer, options: PassPopupOptions): Promise<void> {
  const [list, catalog] = await Promise.all([options.api.getProgressPasses(), options.api.getProducts("premium")]);
  if (!scene.scene.isActive()) return;
  let passes = list.passes;
  const products = new Map(catalog.products.map((product) => [product.id, product]));
  let passId = options.passId ?? passes[0]?.id;
  let mode: PassPopupMode = "reward";
  let pending = false;
  const { width, height } = PASS_POPUP;

  popups.open({ width, height, dim: true, closeOnBackdrop: true, onClose: () => options.onChanged?.() }, (body) => {
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
      root.add(scene.add.text(inner / 2, top + H.levelY + 6, progressPassProgressLabel(pass), textStyle({ role: "emphasis", size: H.progressSize, color: COLOR.inkDim }))
        .setOrigin(1, 0.5));
      const gauge = new HoloBar(scene, 0, top + H.gaugeY, inner, H.gaugeHeight, { color: tone, trackAlpha: 0.85, outline: true, ticks: Math.max(0, level.max - 1) });
      gauge.setValue(level.fill);
      root.add([...gauge.objects]);

      if (mode === "reward") paintRewardList(scene, root, pass, product, tone, { onUnlock: () => void unlock(pass, product) });
      else paintMissionList(scene, root, pass, tone);

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
      passes.forEach((entry, index) => {
        const name = products.get(entry.productId)?.name ?? entry.id;
        const count = passReadyCount(entry);
        addCategoryTab(scene, root, {
          x: tabs.xs[index]!, y: height / 2 - P.fromBottom, width: tabs.width, height: P.tabHeight,
          label: count > 0 ? t("lobby.pass.tabCount", { name, count }) : name, selected: entry.id === pass.id,
          onSelect: () => { if (passId !== entry.id) { passId = entry.id; render(); } },
        });
      });
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

/**
 * 보상 목록 — 머리 줄(무료 · 레벨 · 패스) 아래로 마디가 주르륵 선다.
 *
 * 왼쪽 칸은 누구나, 오른쪽 칸은 패스를 연 사람만 받는다. 받은 칸은 눌러 두고 체크가 서며, 받을 수 있는 칸만
 * 그 쪽 판 윗변에 강조선이 흐른다. 패스를 열지 않았으면 오른쪽 칸 위에 자물쇠가 앉는다.
 */
function paintRewardList(scene: Phaser.Scene, root: Phaser.GameObjects.Container, pass: ProgressPassDto, product: ProductDto | undefined, tone: number, handlers: { onUnlock: () => void }): void {
  const columns = passPopupColumns();
  const L = PASS_POPUP.list;
  const headerY = passPopupListHeaderY();
  root.add(scene.add.text(columns.free, headerY, t("lobby.pass.column.free"), textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0.5));
  root.add(scene.add.text(columns.level, headerY, t("lobby.pass.column.level"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
  if (pass.owned) {
    const label = scene.add.text(columns.paid + 18, headerY, t("lobby.pass.column.paid"), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5);
    root.add(label);
    root.add(drawGlyph(scene, "check", columns.paid - label.width / 2 - 8, headerY, 30, tone, 1, 4));
  } else {
    const price = product?.acquisition.kind === "platform_payment" ? product.acquisition.displayPrice : "";
    root.add(new Button(scene, columns.paid, headerY, {
      width: PASS_POPUP.unlock.width, height: PASS_POPUP.unlock.height, variant: "primary", fontSize: 24,
      label: price ? t("lobby.pass.unlockPrice", { price }) : t("lobby.pass.unlock"), onClick: handlers.onUnlock,
    }));
  }

  pass.milestones.forEach((milestone, index) => {
    const y = passPopupRowY(index);
    const reached = pass.progress >= milestone.threshold;
    const row = scene.add.container(0, y);
    // 무료 칸과 유료 칸은 판을 갈라 세운다 — 가운데 레벨 칸이 둘 사이의 경계다.
    const sideShape = slantedRect(columns.sideWidth - 6, L.rowPlate, 16);
    const freeReady = milestone.freeState === "claimable";
    const paidReady = milestone.state === "claimable";
    row.add(drawLayer(scene, columns.free, 0, sideShape, { fill: 0x101722, alpha: 0.9, ...(freeReady ? { edge: tone, edgeAlpha: 0.95 } : {}) }));
    row.add(drawLayer(scene, columns.paid, 0, sideShape, { fill: tone, alpha: 0.14, ...(paidReady ? { edge: tone, edgeAlpha: 0.95 } : {}) }));
    row.add(drawLayer(scene, columns.paid, 0, sideShape, { fill: 0x101722, alpha: 0.72 }));

    // 가운데 레벨 — 닿은 마디는 패스 색, 아직이면 흐리다. 아래 작은 줄이 그 레벨의 문턱이다.
    row.add(scene.add.text(columns.level, -12, String(index + 1), textStyle({ role: "display", size: 40, color: reached ? COLOR.ink : COLOR.inkDim }))
      .setOrigin(0.5).setStroke(reached ? `#${tone.toString(16).padStart(6, "0")}` : "#000000", reached ? 3 : 4));
    const step = scene.add.text(columns.level, 28, progressPassStepLabel(pass.metric, milestone.threshold), textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5);
    row.add(squeezeTextToWidth(step, L.levelWidth - 16, 0.6));

    paintRewardCell(scene, row, columns.free, milestone.free, milestone.freeState === "claimed", false);
    paintRewardCell(scene, row, columns.paid, milestone.rewards, milestone.state === "claimed", !pass.owned);
    root.add(row);
  });
}

/** 칸 하나의 액자들. 받은 칸은 그림을 눌러 두고 체크를, 열지 않은 유료 칸은 자물쇠를 얹는다. */
function paintRewardCell(scene: Phaser.Scene, row: Phaser.GameObjects.Container, x: number, grants: ProgressPassMilestoneDto["rewards"], claimed: boolean, locked: boolean): void {
  const L = PASS_POPUP.list;
  const tiles = grantTiles(grants);
  const xs = passPopupFrameXs(tiles.length);
  tiles.forEach((tile, index) => {
    const frame = addFramedIcon(scene, row, x + xs[index]!, 0, L.frame, tile.icon, { iconAlpha: claimed ? 0.35 : locked ? 0.7 : 1 });
    frame.add(addFrameAmount(scene, L.frame, formatCurrency(tile.amount)));
  });
  const edge = (xs.length > 0 ? xs[xs.length - 1]! : 0) + L.frame / 2;
  if (claimed) row.add(drawGlyph(scene, "check", x + edge - 6, -L.frame / 2 + 6, 34, COLOR.accent, 1, 5));
  else if (locked) row.add(drawGlyph(scene, "lock", x + edge - 6, -L.frame / 2 + 8, 30, 0xd8dde6, 0.95));
}

/** 미션 목록 — 레벨마다 무엇을 하면 닿는지와 지금 얼마나 왔는지. 닿은 레벨은 체크가 선다. */
function paintMissionList(scene: Phaser.Scene, root: Phaser.GameObjects.Container, pass: ProgressPassDto, tone: number): void {
  const L = PASS_POPUP.list;
  const inner = PASS_POPUP.inner;
  root.add(scene.add.text(-inner / 2 + 12, passPopupListHeaderY(), t(`lobby.pass.mission.lead.${pass.metric}` as TextKey), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim }))
    .setOrigin(0, 0.5));
  pass.milestones.forEach((milestone, index) => {
    const y = passPopupRowY(index);
    const done = pass.progress >= milestone.threshold;
    const row = scene.add.container(0, y);
    row.add(drawLayer(scene, 0, 0, slantedRect(inner, L.rowPlate, 18), { fill: 0x101722, alpha: 0.9, ...(done ? { edge: tone, edgeAlpha: 0.6 } : {}) }));
    row.add(scene.add.text(-inner / 2 + 36, -16, t("lobby.pass.levelShort", { level: index + 1 }), textStyle({ role: "display", size: 28, color: done ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
    const label = scene.add.text(-inner / 2 + 150, -16, t(`lobby.pass.mission.${pass.metric}` as TextKey, { threshold: milestone.threshold }), textStyle({ role: "emphasis", size: 26, color: done ? COLOR.ink : COLOR.inkDim }))
      .setOrigin(0, 0.5);
    row.add(squeezeTextToWidth(label, inner - 150 - 200, 0.7));
    const barWidth = inner - 150 - 200;
    const bar = new HoloBar(scene, -inner / 2 + 150 + barWidth / 2, 24, barWidth, 14, { color: tone, trackAlpha: 0.8 });
    bar.setValue(Math.min(1, pass.progress / milestone.threshold));
    row.add([...bar.objects]);
    if (done) {
      row.add(drawGlyph(scene, "check", inner / 2 - 120, 0, 34, tone, 1, 5));
      row.add(scene.add.text(inner / 2 - 36, 0, t("lobby.pass.mission.done"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5));
    } else {
      row.add(scene.add.text(inner / 2 - 36, 0, `${Math.min(pass.progress, milestone.threshold)} / ${milestone.threshold}`, textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(1, 0.5));
    }
    root.add(row);
  });
}

