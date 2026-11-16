import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { PatronStatusDto } from "../api/contracts";
import { PATRON_TIERS, type PatronTierDefinition, type PatronTierId } from "../core/patronStrata";
import { PROFILE_MODIFIERS } from "../data/profileModifiers";
import { formatCurrency } from "../core/formatCurrency";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import { addGuideSectionHeader } from "./GuideRouteList";
import { addFrameAmount, addFramedIcon, addItemFrame, guideForIcon } from "./itemFrame";
import { premiumGrantTiles } from "./premiumModel";
import { ProfileAvatar } from "./ProfileAvatar";
import { Button } from "./Button";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { PATRON_POPUP, patronCardSpot, patronDailyTop, patronLadderX, patronPopupHeight } from "./patronStrataLayout";
import { patronBenefitCards, patronMaxBenefitCards, type PatronBenefitCard } from "./patronStrataModel";
import { NotificationDot } from "./NotificationDot";
import { addNewBadge } from "./NewContentBadge";
import { PROFILE_FRAMES } from "../data/profileFrames";
import { findItem } from "../data/items";
import type { ProductGrant } from "../data/products";
import type { PortraitAssetId } from "../core/types";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
export const patronTierName = (id: PatronTierId): string => t(`patron.tier.${id}` as TextKey);
const DAY_MS = 86_400_000;

export interface PatronStrataPopupOptions {
  readonly status: PatronStatusDto;
  /** 테두리 미리보기를 씌울 지금 얼굴. */
  readonly avatar: { portraitAssetId?: PortraitAssetId; fallback: string };
  readonly onClaimDaily: () => void;
  readonly onClaimReward: (tierId: PatronTierId) => void;
  /** 사다리에서 고른 지층 — 없으면 지금 지층이다. */
  readonly selectedTierId?: PatronTierId;
}

/**
 * 후원 지층 창 — 지금 지층과 복원 기금, 일곱 지층 사다리, 고른 지층의 혜택(승급 기념품 + 혜택 카드), 오늘의 후원 보급을 한 판에 세운다.
 *
 * 사다리의 표식을 누르면 같은 제목으로 다시 열어(갈아 끼우기라 등장 연출이 없다) 그 지층의 혜택을 보여 준다. 받는 일은 이 창이 하지 않는다 —
 * 버튼은 부른 화면의 손(`onClaimDaily`·`onClaimReward`)을 부른다. 오른쪽 위 X는 두지 않는다 — 판 밖 뒤로가기·판 밖 누르기로 닫힌다.
 */
export function openPatronStrataPopup(scene: Phaser.Scene, popups: PopupLayer, options: PatronStrataPopupOptions): void {
  const { status } = options;
  const P = PATRON_POPUP;
  const maxCards = patronMaxBenefitCards();
  const height = patronPopupHeight(maxCards);
  const top = -height / 2;
  const inner = P.width - P.pad * 2;
  const left = -inner / 2;
  const tierIndex = Math.max(0, PATRON_TIERS.findIndex(({ id }) => id === status.tierId));
  const tier = PATRON_TIERS[tierIndex];
  const next = PATRON_TIERS[tierIndex + 1];
  const selectedIndex = Math.max(0, PATRON_TIERS.findIndex(({ id }) => id === (options.selectedTierId ?? status.tierId)));
  const selected = PATRON_TIERS[selectedIndex];
  const rewardOf = new Map(status.rewards.map((reward) => [reward.tierId, reward]));
  const select = (id: PatronTierId): void => {
    if (id === selected.id) return;
    popups.closeTop();
    openPatronStrataPopup(scene, popups, { ...options, selectedTierId: id });
  };
  popups.open({ width: P.width, height, title: t("patron.title"), dim: true, dimAlpha: 0.4 }, (body) => {
    // ── 지금 지층: 큰 표식 · 이름 · (기금 / 다음 문턱) ──
    const H = P.hero;
    const heroTop = top + H.top;
    const glow = scene.add.graphics({ x: 0, y: heroTop + H.emblemY });
    for (let i = 4; i >= 1; i -= 1) glow.fillStyle(tier.color, 0.06).fillPoints(diamondPoints(H.emblem * (1 + i * 0.32)), true);
    body.add(glow);
    body.add(drawEmblem(scene, 0, heroTop + H.emblemY, H.emblem, tier.color));
    body.add(scene.add.text(0, heroTop + H.nameY, patronTierName(tier.id), textStyle({ role: "display", size: H.nameSize, color: hex(tier.color) })).setOrigin(0.5).setShadow(2, 5, "#05070a", 6, false, true));
    addFundLine(scene, body, heroTop + H.fundY, status.fund, next?.threshold, H.fundSize);

    // ── 지층 사다리 ──
    const L = P.ladder;
    const ladderTop = top + L.top;
    body.add(drawLayer(scene, 0, ladderTop + L.height / 2, slantedRect(inner, L.height, 22), { fill: 0x0c1118, alpha: 0.92, edge: tier.color, edgeAlpha: 0.5 }));
    const trackY = ladderTop + L.trackY;
    const firstX = patronLadderX(0, PATRON_TIERS.length, inner);
    const lastX = patronLadderX(PATRON_TIERS.length - 1, PATRON_TIERS.length, inner);
    const track = scene.add.graphics();
    track.fillStyle(0x05070a, 0.85).fillRect(firstX, trackY - L.lineHeight / 2 - 2, lastX - firstX, L.lineHeight + 4);
    const reachedX = patronLadderX(tierIndex, PATRON_TIERS.length, inner);
    if (tierIndex > 0) track.fillStyle(COLOR.hpFill, 1).fillRect(firstX, trackY - L.lineHeight / 2, reachedX - firstX, L.lineHeight);
    body.add(track);
    PATRON_TIERS.forEach((band, index) => {
      const x = patronLadderX(index, PATRON_TIERS.length, inner);
      const reached = index <= tierIndex;
      const holder = scene.add.container(x, 0);
      body.add(holder);
      if (index === selectedIndex) {
        const plateHeight = L.plate.bottom - L.plate.top;
        holder.add(drawLayer(scene, 0, ladderTop + L.plate.top + plateHeight / 2, chipPoints(L.plate.width, plateHeight, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: band.color, alpha: 0.32, edge: band.color, edgeAlpha: 1 }));
      }
      const emblem = drawEmblem(scene, 0, ladderTop + L.emblemY, L.emblem, band.color);
      emblem.setAlpha(reached ? 1 : 0.4);
      holder.add(emblem);
      const node = scene.add.graphics({ x: 0, y: trackY });
      node.fillStyle(0x05070a, 0.9).fillPoints(diamondPoints(L.node + 4), true);
      node.fillStyle(reached ? COLOR.hpFill : 0x2a313a, 1).fillPoints(diamondPoints(L.node), true);
      if (index === tierIndex) node.fillStyle(0xffffff, 0.8).fillPoints(diamondPoints(L.node * 0.45), true);
      holder.add(node);
      if (rewardOf.get(band.id)?.status === "ready") new NotificationDot(scene, holder, { x: L.emblem + 6, y: ladderTop + L.emblemY - L.emblem - 2 });
      const hit = scene.add.zone(0, ladderTop + (L.plate.top + L.plate.bottom) / 2, L.plate.width, L.plate.bottom - L.plate.top).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(emblem));
      hit.on("pointerout", () => pressOut(emblem, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(emblem); select(band.id); });
      holder.add(hit);
    });
    const nextLine = next
      ? t("patron.next", { name: patronTierName(next.id), value: formatCurrency(Math.max(0, next.threshold - status.fund)) })
      : t("patron.max");
    body.add(shrinkTextToWidth(scene.add.text(left + 32, ladderTop + L.noteY, nextLine, textStyle({ role: "emphasis", size: L.noteSize, color: COLOR.hpText })).setOrigin(0, 0.5), inner / 2 - 40));
    body.add(shrinkTextToWidth(scene.add.text(-left - 32, ladderTop + L.noteY, t("patron.howto"), textStyle({ role: "body", size: L.noteSize - 2, color: COLOR.inkDim })).setOrigin(1, 0.5), inner / 2 - 40));

    // ── 고른 지층의 혜택 ──
    const B = P.benefit;
    addGuideSectionHeader(scene, body, top + B.top, inner, t("patron.benefit.title", { name: patronTierName(selected.id) }));
    paintRewardRow(scene, body, top + B.top + B.headerHeight + B.reward.height / 2, inner, selected, selectedIndex <= tierIndex, rewardOf.get(selected.id), status, options);
    patronBenefitCards(selectedIndex).forEach((card, index) => {
      const spot = patronCardSpot(index, inner);
      paintBenefitCard(scene, body, spot.x, top + spot.y, spot.width, card, selected, options.avatar);
    });

    // ── 오늘의 후원 보급(지금 지층) ──
    const D = P.daily;
    const dailyTop = top + patronDailyTop(maxCards);
    addGuideSectionHeader(scene, body, dailyTop, inner, t("patron.daily.today", { name: patronTierName(tier.id) }));
    const tiles = premiumGrantTiles({ grants: [...tier.daily] });
    const rowWidth = tiles.length * D.frame + Math.max(0, tiles.length - 1) * D.gap;
    tiles.forEach((tile, i) => addRewardFrame(scene, body, -rowWidth / 2 + D.frame / 2 + i * (D.frame + D.gap), dailyTop + D.frameY, D.frame, tile.icon, tile.amount));
    const buttonY = dailyTop + D.button.y;
    if (status.dailyAvailable) {
      const button = new Button(scene, 0, buttonY, { width: D.button.width, height: D.button.height, label: t("patron.daily.claim"), variant: "primary", onClick: options.onClaimDaily });
      body.add(button);
      new NotificationDot(scene, button, { x: D.button.width / 2 - 8, y: -D.button.height / 2 + 6 });
    } else {
      body.add(scene.add.text(0, buttonY, t("patron.daily.claimed"), textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    }
    body.add(scene.add.text(D.button.width / 2 + 24, buttonY, t("patron.daily.fund", { value: 1 }), textStyle({ role: "emphasis", size: D.noteSize, color: COLOR.hpText })).setOrigin(0, 0.5));
  });
}

/** 「( 550 / 3,000 )」 — 쌓인 기금만 강조색이다. 가장 깊은 지층이면 기금 하나만 선다. */
function addFundLine(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, fund: number, nextThreshold: number | undefined, size: number): void {
  const style = (color: string) => textStyle({ role: "display", size, color });
  const parts = nextThreshold === undefined
    ? [scene.add.text(0, y, formatCurrency(fund), style(COLOR.accentText))]
    : [scene.add.text(0, y, "(", style(COLOR.ink)), scene.add.text(0, y, formatCurrency(fund), style(COLOR.accentText)), scene.add.text(0, y, ` / ${formatCurrency(nextThreshold)})`, style(COLOR.ink))];
  const total = parts.reduce((sum, part) => sum + part.width, 0);
  let x = -total / 2;
  for (const part of parts) {
    part.setOrigin(0, 0.5).setX(x).setShadow(0, 3, "#05070a", 4, true, true);
    body.add(part);
    x += part.width;
  }
}

/** 고른 지층의 승급 기념품 한 줄 — 이름표 · 기념품 액자 · 오른쪽 끝의 받기/상태. */
function paintRewardRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, inner: number, band: PatronTierDefinition, reached: boolean, reward: PatronStatusDto["rewards"][number] | undefined, status: PatronStatusDto, options: PatronStrataPopupOptions): void {
  const R = PATRON_POPUP.benefit.reward;
  const left = -inner / 2;
  const row = scene.add.container(0, y);
  body.add(row);
  row.add(drawLayer(scene, 0, 0, chipPoints(inner, R.height, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: band.color, alpha: reached ? 0.22 : 0.1, edge: band.color, edgeAlpha: 0.8 }));
  row.add(scene.add.text(left + 28, -16, t("patron.reward.title"), textStyle({ role: "display", size: 28, color: hex(band.color) })).setOrigin(0, 0.5).setShadow(0, 2, "#05070a", 3, true, true));
  row.add(scene.add.text(left + 28, 20, t("patron.threshold", { value: formatCurrency(band.threshold) }), textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
  const tiles = premiumGrantTiles({ grants: [...band.reward] });
  if (tiles.length === 0) {
    row.add(scene.add.text(left + 250, 0, t("patron.reward.none"), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
  }
  tiles.forEach((tile, i) => addRewardFrame(scene, row, left + 250 + R.frame / 2 + i * (R.frame + 12), 0, R.frame, tile.icon, tile.amount));
  if (!reward) return;
  const actionX = -left - R.button.width / 2 - 16;
  if (reward.status === "ready") {
    const button = new Button(scene, actionX, 0, { width: R.button.width, height: R.button.height, label: t("patron.reward.claim"), variant: "primary", fontSize: 26, onClick: () => options.onClaimReward(band.id) });
    row.add(button);
    new NotificationDot(scene, button, { x: R.button.width / 2 - 6, y: -R.button.height / 2 + 4 });
    return;
  }
  const label = reward.status === "claimed"
    ? t("patron.reward.claimed")
    : reward.status === "settling"
      ? t("patron.reward.settling", { days: Math.max(1, Math.ceil((Date.parse(reward.claimableAt ?? status.serverTime) - Date.parse(status.serverTime)) / DAY_MS)) })
      : t("patron.reward.locked");
  row.add(scene.add.text(actionX, 0, label, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
}

/** 혜택 카드 — 왼쪽 액자(매일 보급의 재화·테두리 미리보기·수식어 표식)와 이름. 새로 생긴 것은 NEW, 늘어난 것은 위 화살표. */
function paintBenefitCard(scene: Phaser.Scene, body: Phaser.GameObjects.Container, x: number, y: number, width: number, card: PatronBenefitCard, band: PatronTierDefinition, avatar: PatronStrataPopupOptions["avatar"]): void {
  const C = PATRON_POPUP.benefit.card;
  const holder = scene.add.container(x, y);
  body.add(holder);
  holder.add(drawLayer(scene, 0, 0, chipPoints(width, C.height, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: 0x141b24, alpha: 0.94, edge: band.color, edgeAlpha: 0.45 }));
  const frameX = -width / 2 + 20 + C.frame / 2;
  let label: string;
  if (card.kind === "daily") {
    const [tile] = premiumGrantTiles({ grants: [card.grant] });
    if (tile) addRewardFrame(scene, holder, frameX, 0, C.frame, tile.icon, tile.amount);
    label = t("patron.benefit.daily", { name: grantName(card.grant) });
  } else if (card.kind === "frame") {
    holder.add(new ProfileAvatar(scene, frameX, 0, { size: Math.round(C.frame * 0.86), frameId: card.frameId, portraitAssetId: avatar.portraitAssetId, fallback: avatar.fallback }));
    label = t("patron.benefit.frame", { name: PROFILE_FRAMES.find(({ id }) => id === card.frameId)?.displayName ?? card.frameId });
  } else {
    const frame = addItemFrame(scene, frameX, 0, C.frame, { color: band.color });
    frame.add(drawEmblem(scene, 0, 0, C.frame * 0.24, band.color));
    holder.add(frame);
    label = t("patron.benefit.modifier", { name: PROFILE_MODIFIERS.find(({ id }) => id === card.modifierId)?.displayName ?? card.modifierId });
  }
  const textLeft = frameX + C.frame / 2 + 18;
  const text = scene.add.text(textLeft, 0, label, textStyle({ role: "emphasis", size: PATRON_POPUP.benefit.labelSize, color: COLOR.ink, wrap: width / 2 - textLeft - 14 })).setOrigin(0, 0.5);
  holder.add(text);
  if (card.change === "up") holder.add(drawUpArrow(scene, -width / 2 + 14, -C.height / 2 + 12));
  if (card.change === "new") holder.add(addNewBadge(scene, width / 2 - 40, -C.height / 2 + 4, { pulse: false, scale: 0.78 }));
}

function grantName(grant: ProductGrant): string {
  if (grant.kind === "currency") return t(`currency.${grant.currency}` as TextKey);
  if (grant.kind === "item") return findItem(grant.itemId)?.name ?? grant.name;
  return "name" in grant ? String(grant.name) : "";
}

/** 늘어난 혜택의 위 화살표 — 굵은 연두 몸 + 먹선. */
function drawUpArrow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const pts = (scale: number): Phaser.Geom.Point[] => [[0, -18], [17, 2], [7, 2], [7, 18], [-7, 18], [-7, 2], [-17, 2]].map(([px, py]) => new Phaser.Geom.Point(px * scale, py * scale));
  g.fillStyle(0x05070a, 0.9).fillPoints(pts(1.22), true);
  g.fillStyle(COLOR.hpFill, 1).fillPoints(pts(1), true);
  g.fillStyle(0xffffff, 0.35).fillPoints([new Phaser.Geom.Point(0, -14), new Phaser.Geom.Point(10, -2), new Phaser.Geom.Point(-10, -2)], true);
  return g;
}

const diamondPoints = (r: number): Phaser.Geom.Point[] => [new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r * 1.1, 0), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r * 1.1, 0)];

function addRewardFrame(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, icon: string, amount: number): void {
  const frame = addFramedIcon(scene, parent, x, y, size, icon, { plain: true });
  frame.add(addFrameAmount(scene, size, formatCurrency(amount)));
  const openGuide = guideForIcon(scene, icon);
  if (!openGuide) return;
  frame.setSize(size, size).setInteractive({ useHandCursor: true });
  frame.on("pointerdown", () => pressIn(frame));
  frame.on("pointerout", () => pressOut(frame, "normal", { pop: false }));
  frame.on("pointerup", () => { pressOut(frame); openGuide(); });
}

/** 지층 표식 — 납작한 마름모 두 겹. 칩과 창이 같은 그림을 쓴다. */
export function drawEmblem(scene: Phaser.Scene, x: number, y: number, radius: number, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const diamond = (r: number): Phaser.Geom.Point[] => [new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r * 1.1, 0), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r * 1.1, 0)];
  g.fillStyle(0x05070a, 0.7).fillPoints(diamond(radius + 5), true);
  g.fillStyle(color, 1).fillPoints(diamond(radius), true);
  g.fillStyle(0xffffff, 0.35).fillPoints(diamond(radius * 0.42), true);
  return g;
}
