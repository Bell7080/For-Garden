import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { PatronStatusDto } from "../api/contracts";
import { PATRON_TIERS, type PatronTierDefinition, type PatronTierId } from "../core/patronStrata";
import { PROFILE_MODIFIERS } from "../data/profileModifiers";
import { formatCurrency } from "../core/formatCurrency";
import { chipPoints, drawLayer, HoloBar, slantedRect } from "./holo";
import { addGuideSectionHeader } from "./GuideRouteList";
import { addFrameAmount, addFramedIcon, guideForIcon } from "./itemFrame";
import { premiumGrantTiles } from "./premiumModel";
import { ProfileAvatar } from "./ProfileAvatar";
import { Button } from "./Button";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { PATRON_POPUP, patronBandY, patronPopupHeight } from "./patronStrataLayout";
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
}

/**
 * 후원 지층 창 — 지금 지층과 복원 기금, 매일 후원 보급, 지층마다 한 번 받는 승급 기념품을 한 판에 세운다.
 *
 * 받는 일은 이 창이 하지 않는다 — 버튼은 부른 화면의 손(`onClaimDaily`·`onClaimReward`)을 부르고, 화면이 서버 경계를
 * 지난 뒤 같은 제목으로 다시 연다(갈아 끼우기라 등장 연출이 없다). 오른쪽 위 X는 두지 않는다 — 판 밖 뒤로가기·판 밖 누르기로 닫힌다.
 */
export function openPatronStrataPopup(scene: Phaser.Scene, popups: PopupLayer, options: PatronStrataPopupOptions): void {
  const { status } = options;
  const P = PATRON_POPUP;
  const height = patronPopupHeight(PATRON_TIERS.length);
  const top = -height / 2;
  const inner = P.width - P.pad * 2;
  const left = -inner / 2;
  const tierIndex = Math.max(0, PATRON_TIERS.findIndex(({ id }) => id === status.tierId));
  const tier = PATRON_TIERS[tierIndex];
  const next = PATRON_TIERS[tierIndex + 1];
  popups.open({ width: P.width, height, title: t("patron.title"), dim: true, dimAlpha: 0.4 }, (body) => {
    // ── 지금 지층 ──
    const H = P.hero;
    const heroY = top + H.top + H.height / 2;
    body.add(drawLayer(scene, 0, heroY, slantedRect(inner, H.height, 22), { fill: 0x101720, alpha: 0.9, edge: tier.color, edgeAlpha: 0.7 }));
    const nameY = top + H.top + 52;
    body.add(drawEmblem(scene, left + 46, nameY, 20, tier.color));
    body.add(scene.add.text(left + 82, nameY, patronTierName(tier.id), textStyle({ role: "display", size: H.nameSize, color: hex(tier.color) })).setOrigin(0, 0.5).setShadow(2, 5, "#05070a", 6, false, true));
    body.add(scene.add.text(-left - 32, nameY, `${t("patron.fund")}  ${formatCurrency(status.fund)}`, textStyle({ role: "emphasis", size: H.fundSize, color: COLOR.ink })).setOrigin(1, 0.5));
    const gaugeWidth = inner - 64;
    const gauge = new HoloBar(scene, 0, top + H.top + H.gaugeY, gaugeWidth, H.gaugeHeight, { color: next?.color ?? tier.color, trackAlpha: 0.8 });
    gauge.addTo(body);
    gauge.setValue(next ? Math.min(1, (status.fund - tier.threshold) / Math.max(1, next.threshold - tier.threshold)) : 1);
    const nextLine = next
      ? t("patron.next", { name: patronTierName(next.id), value: formatCurrency(Math.max(0, next.threshold - status.fund)) })
      : t("patron.max");
    body.add(scene.add.text(-gaugeWidth / 2, top + H.top + H.gaugeY + 30, nextLine, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));

    // ── 매일 후원 보급 ──
    const D = P.daily;
    const dailyTop = top + D.top;
    addGuideSectionHeader(scene, body, dailyTop, inner, t("patron.daily.title"));
    const tiles = premiumGrantTiles({ grants: [...tier.daily] });
    const frameY = dailyTop + D.frameY;
    tiles.forEach((tile, i) => addRewardFrame(scene, body, left + D.frame / 2 + i * (D.frame + D.gap), frameY, D.frame, tile.icon, tile.amount));
    const buttonX = -left - D.button.width / 2;
    if (status.dailyAvailable) {
      body.add(new Button(scene, buttonX, frameY - 6, { width: D.button.width, height: D.button.height, label: t("patron.daily.claim"), variant: "primary", onClick: options.onClaimDaily }));
    } else {
      body.add(scene.add.text(buttonX, frameY - 6, t("patron.daily.claimed"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    }
    body.add(scene.add.text(buttonX, frameY + D.button.height / 2 + 14, t("patron.daily.fund", { value: 1 }), textStyle({ role: "body", size: D.fundSize, color: COLOR.inkDim })).setOrigin(0.5));

    // ── 승급 기념품 단면도 ──
    const R = P.rewards;
    addGuideSectionHeader(scene, body, top + R.top, inner, t("patron.reward.title"));
    const rewardOf = new Map(status.rewards.map((reward) => [reward.tierId, reward]));
    PATRON_TIERS.forEach((band, index) => {
      const y = top + patronBandY(index);
      const reached = index <= tierIndex;
      const row = scene.add.container(0, y);
      body.add(row);
      row.add(drawLayer(scene, 0, 0, chipPoints(inner, R.bandHeight, { bevel: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } }), { fill: band.color, alpha: reached ? 0.26 : 0.1, shadow: false, edge: index === tierIndex ? band.color : undefined, edgeAlpha: 0.9 }));
      row.add(scene.add.rectangle(left + 6, 0, 10, R.bandHeight - 16, band.color, reached ? 1 : 0.45));
      const nameText = scene.add.text(left + 28, -14, patronTierName(band.id), textStyle({ role: "display", size: R.nameSize, color: reached ? hex(band.color) : COLOR.inkDim })).setOrigin(0, 0.5);
      row.add(shrinkTextToWidth(nameText, 220));
      const threshold = index === tierIndex ? t("patron.current") : t("patron.threshold", { value: formatCurrency(band.threshold) });
      row.add(scene.add.text(left + 28, 20, threshold, textStyle({ role: "emphasis", size: R.thresholdSize, color: index === tierIndex ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5));
      paintBandRewards(scene, row, band, left + 290, R.frame, options.avatar);
      const reward = rewardOf.get(band.id);
      if (!reward) return;
      const actionX = -left - R.button.width / 2 - 8;
      if (reward.status === "ready") {
        row.add(new Button(scene, actionX, 0, { width: R.button.width, height: R.button.height, label: t("patron.reward.claim"), variant: "primary", fontSize: 26, onClick: () => options.onClaimReward(band.id) }));
      } else if (reward.status === "claimed" || reward.status === "settling") {
        const label = reward.status === "claimed"
          ? t("patron.reward.claimed")
          : t("patron.reward.settling", { days: Math.max(1, Math.ceil((Date.parse(reward.claimableAt ?? status.serverTime) - Date.parse(status.serverTime)) / DAY_MS)) });
        row.add(scene.add.text(actionX, 0, label, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
      }
    });
  });
}

/** 띠 안의 기념품 — 재화·재료 액자, 그리고 열리는 테두리(지금 얼굴에 씌운 모습)·수식어. */
function paintBandRewards(scene: Phaser.Scene, row: Phaser.GameObjects.Container, band: PatronTierDefinition, x: number, size: number, avatar: PatronStrataPopupOptions["avatar"]): void {
  let cursor = x + size / 2;
  for (const tile of premiumGrantTiles({ grants: [...band.reward] })) {
    addRewardFrame(scene, row, cursor, 0, size, tile.icon, tile.amount);
    cursor += size + 12;
  }
  if (band.frameId) {
    row.add(new ProfileAvatar(scene, cursor, 0, { size: Math.round(size * 0.82), frameId: band.frameId, portraitAssetId: avatar.portraitAssetId, fallback: avatar.fallback }));
    cursor += size + 12;
  }
  const modifier = band.modifierId ? PROFILE_MODIFIERS.find(({ id }) => id === band.modifierId) : undefined;
  if (modifier) {
    row.add(scene.add.text(cursor - size / 2, 0, modifier.displayName, textStyle({ role: "emphasis", size: 24, color: hex(band.color) })).setOrigin(0, 0.5).setShadow(0, 2, "#05070a", 3, true, true));
  }
}

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
