import Phaser from "phaser";
import { t } from "../i18n";
import { drawLayer, slantedRect } from "./holo";
import { pressIn, pressOut } from "./pressFeedback";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { SUBSCRIPTION_NOTICE } from "./subscriptionNoticeLayout";

/** 정기권 결제 안내 한 쌍 — 결제 팝업에 서는 한 줄과, 그 줄의 ⓘ가 여는 자세한 안내창. */
export interface SubscriptionNoticeInput {
  /** 이미 서식이 입혀진 스토어 가격 문자열. */
  price: string;
  days: number;
}

/** 자세한 안내의 항목 — 제목과 본문 키가 항상 한 쌍이다. */
const SECTIONS = ["billing", "renew", "cancel", "refund"] as const;

/** 값 버튼 위 한 줄. 문장은 번역 표가 갖고 여기서는 자리 값만 채운다. */
export function subscriptionNoticeLine(input: SubscriptionNoticeInput): string {
  return t("shop.renewal.notice", { price: input.price, days: input.days });
}

/** 줄 오른쪽 끝에 서는 작은 ⓘ 칩. 눌러 자세한 안내창을 연다. */
export function addSubscriptionNoticeChip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, onOpen: () => void): Phaser.GameObjects.Container {
  const S = SUBSCRIPTION_NOTICE.chip;
  const chip = scene.add.container(x, y);
  chip.add(drawLayer(scene, 0, 0, slantedRect(S.size, S.size, 10), { fill: 0x101720, alpha: 0.92, edge: COLOR.accent, edgeAlpha: 0.8 }));
  chip.add(scene.add.text(0, 0, "i", textStyle({ role: "display", size: 26, color: COLOR.accentText })).setOrigin(0.5));
  const hit = scene.add.zone(0, 0, S.hit, S.hit).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(chip));
  hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(chip); onOpen(); });
  chip.add(hit);
  parent.add(chip);
  return chip;
}

/** 결제 주기·갱신·해지·환불을 항목별로 읽는 안내창. 높이는 글이 차지하는 만큼에서 거꾸로 구한다. */
export function openSubscriptionNoticePopup(scene: Phaser.Scene, popups: PopupLayer, input: SubscriptionNoticeInput): void {
  const L = SUBSCRIPTION_NOTICE.detail;
  const bodies = SECTIONS.map((key) => t(`shop.renewal.${key}.body`, { price: input.price, days: input.days }));
  const heights = bodies.map((text) => {
    const probe = scene.add.text(0, 0, text, textStyle({ role: "body", size: L.bodySize, wrap: L.width - L.pad * 2 })).setVisible(false);
    const height = probe.height; probe.destroy(); return height;
  });
  const total = SECTIONS.length * (L.headSize + L.headGap + L.sectionGap) + heights.reduce((sum, h) => sum + h, 0);
  const height = Math.ceil(total + L.top + L.bottom);
  popups.open({ width: L.width, height, title: t("shop.renewal.title"), dim: true, dimAlpha: 0.34, closeOnBackdrop: true }, (body) => {
    let y = -height / 2 + L.top;
    SECTIONS.forEach((key, index) => {
      body.add(scene.add.text(-L.width / 2 + L.pad, y, t(`shop.renewal.${key}.title`), textStyle({ role: "display", size: L.headSize, color: COLOR.accentText })).setOrigin(0, 0));
      y += L.headSize + L.headGap;
      body.add(scene.add.text(-L.width / 2 + L.pad, y, bodies[index], textStyle({ role: "body", size: L.bodySize, color: COLOR.ink, wrap: L.width - L.pad * 2 })).setOrigin(0, 0));
      y += heights[index] + L.sectionGap;
    });
  });
}
