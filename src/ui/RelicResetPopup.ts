/**
 * 레벨 초기화 창 — 공용 확인 창 대신 **그 아이가 직접 묻는** 한 장.
 *
 * 위 무대에 그 개체의 SD가 땀을 흘리며 부들부들 떨고, 말풍선이 「정말 나를 처음으로 되돌릴 거야?」를 묻는다.
 * 아래 유리 판은 보유 재화가 어떻게 바뀌는지를 재화마다 한 줄로 적고(`지금 → 뒤 · 증감`), 확정 버튼 안에
 * 값이 박힌다 — 무료면 값 대신 모서리 딱지가 붙는다. 자리는 `relicResetPopupLayout.ts`가 갖는다.
 *
 * **MAX 급여 확인 창도 같은 한 장이다**(`openRelicFeedMaxPopup`). 무대·레벨 줄·재화 판은 그대로 두고, 그 아이가
 * 떨지 않고 신이 나서 통통 뛰며 「이걸 전부 저한테 주시는 거예요?!」를 존댓말로 묻는다. 그 창은 취소 버튼 없이 확정 하나만
 * 서고, 닫는 길은 판 밖 우하단의 공용 뒤로가기와 판 밖 누르기다. 초기화 창도 같다 — 취소 버튼 없이 확정 하나다.
 */
import Phaser from "phaser";
import { t } from "../i18n";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { spawnPuppet, type PuppetAsset, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { Button, DESTRUCTIVE_BUTTON_STYLE } from "./Button";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { chipPoints, drawLayer } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { popupArtShape, shapeClipMask } from "./popupArt";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { startPuppetHop } from "./puppetHop";
import { RELIC_RESET_POPUP, relicResetPopupSpots, type RelicAskMood, type RelicResetPopupSpots } from "./relicResetPopupLayout";
import { addSdFootShadow } from "./SdFootShadow";
import { FEED_BULK_PANEL, FEED_BULK_TONES } from "./feedBulkStyle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export interface RelicResetPopupOptions {
  /** 무대에 세울 SD. 없으면 무대는 말풍선만 남는다. */
  asset?: PuppetAsset;
  level: number;
  /** 돌려받는 치즈케이크. */
  refund: number;
  /** 돌려받지 못하는 치즈케이크(21레벨까지는 0). */
  loss: number;
}

export interface RelicFeedMaxPopupOptions {
  asset?: PuppetAsset;
  level: number;
  /** 다 먹인 뒤 닿는 레벨. */
  targetLevel: number;
  /** 나가는 치즈케이크. */
  cost: number;
}

/** 두 창이 갈리는 자리 — 나머지(무대·레벨 줄·재화 판·버튼 줄)는 한 벌이다. */
interface AskSpec {
  asset?: PuppetAsset;
  title: string;
  plea: string;
  from: number;
  to: number;
  /** 도착 레벨의 색 — 되돌리면 붉고 키우면 강조색이다. */
  toColor: string;
  rows: { icon: string; before: number; after: number }[];
  note: string;
  /** 잃는 치즈케이크 — 있으면 재화 판 아래 붉은 경고 띠가 「90%만 환급」과 그 수를 크게 말한다. */
  loss?: number;
  /** 무대의 그 아이 — 떨며 땀을 흘리거나, 신이 나서 통통 뛴다. */
  mood: RelicAskMood;
  /** 판 테두리·재화 판의 강조 색. */
  edge: number;
  confirm: { label: string; destructive: boolean; ribbon?: string };
  /** 몸판의 면·강조선 색. 없으면 공용 판이다(MAX 급여는 쪽지와 같은 사탕빛 판을 입는다). */
  panel?: { fill: number; accent: number };
  /** 확정 버튼의 면 색(강조 버튼일 때만). */
  confirmFill?: number;
}

const BUBBLE_INK = "#20242b";
/** MAX 급여의 도착 레벨 — 금빛 테와 같은 결. */
const MAX_GOLD_TEXT = "#ffd34d";
const SWEAT_COLOR = 0x9fd8ff;
/** 경고 띠 — 짙은 장밋빛 면과 밝은 다홍 제목. */
const WARNING_FILL = 0x3d0d18;
const WARNING_TITLE = "#ff8a8a";

export function openRelicResetPopup(scene: Phaser.Scene, popups: PopupLayer, options: RelicResetPopupOptions, onConfirm: () => void): void {
  openRelicAskPopup(scene, popups, {
    asset: options.asset,
    title: t("info.reset.title"),
    plea: t("info.reset.plea"),
    from: options.level,
    to: 1,
    toColor: COLOR.dangerText,
    rows: [{ icon: CURRENCY_ICON_BY_WALLET.cheesecake, before: session.wallet.cheesecake, after: session.wallet.cheesecake + options.refund }],
    note: t("info.reset.keep"),
    ...(options.loss > 0 ? { loss: options.loss } : {}),
    mood: "afraid",
    edge: COLOR.danger,
    // 잃는 것이 없으면 확정 버튼에 「무료!」 딱지가 붙는다 — 21레벨까지는 먹인 것을 그대로 돌려받는다.
    confirm: { label: t("info.reset.confirm"), destructive: true, ...(options.loss > 0 ? {} : { ribbon: t("info.reset.free") }) },
  }, onConfirm);
}

/** MAX 급여 확인 창 — 그 아이가 신이 나서 묻고, 나가는 치즈케이크와 닿는 레벨을 보여 준다. */
export function openRelicFeedMaxPopup(scene: Phaser.Scene, popups: PopupLayer, options: RelicFeedMaxPopupOptions, onConfirm: () => void): void {
  openRelicAskPopup(scene, popups, {
    asset: options.asset,
    title: t("info.feed.max.title"),
    plea: t("info.feed.max.plea"),
    from: options.level,
    to: options.targetLevel,
    toColor: MAX_GOLD_TEXT,
    rows: [{ icon: CURRENCY_ICON_BY_WALLET.cheesecake, before: session.wallet.cheesecake, after: session.wallet.cheesecake - options.cost }],
    note: t("info.feed.max.note", { count: (options.targetLevel - options.level).toLocaleString() }),
    mood: "excited",
    // 쪽지의 MAX 칸과 같은 한 벌 — 사탕빛 판, 금빛 테, 불꽃빛 확정 버튼.
    edge: FEED_BULK_TONES.max.rim,
    confirm: { label: t("info.feed.max.confirm"), destructive: false },
    panel: { fill: FEED_BULK_PANEL.fill, accent: FEED_BULK_PANEL.accent },
    confirmFill: FEED_BULK_TONES.max.cream,
  }, onConfirm);
}

function openRelicAskPopup(scene: Phaser.Scene, popups: PopupLayer, spec: AskSpec, onConfirm: () => void): void {
  const L = RELIC_RESET_POPUP;
  const spots = relicResetPopupSpots(spec.rows.length, spec.loss !== undefined);
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;

  popups.open({ width: L.width, height: spots.height, title: spec.title, dim: true, dimAlpha: L.dimAlpha, ...(spec.panel ?? {}) }, (body, close) => {
    paintBackdrop(scene, body, spots, spec.mood, loops);
    const stage = scene.add.container(0, spots.stageTop);
    body.add(stage);
    const S = L.stage;

    // 말풍선 — 밝은 판에 짙은 글자. 꼬리는 왼쪽 아래에서 SD 쪽을 가리킨다.
    const bubble = scene.add.container(S.bubble.x, S.bubble.y);
    const B = S.bubble;
    const bevel = B.height * 0.22;
    bubble.add(drawLayer(scene, 0, 0, chipPoints(B.width, B.height, { bevel: { topLeft: bevel, bottomRight: bevel } }), { fill: COLOR.inkHex, alpha: 0.97, shadow: { x: 6, y: 9 } }));
    const tail = scene.add.graphics().fillStyle(COLOR.inkHex, 0.97).fillPoints([
      new Phaser.Math.Vector2(-B.width / 2 + bevel + 6, B.height / 2 - 2),
      new Phaser.Math.Vector2(-B.width / 2 + bevel + 6 + B.tail * 1.3, B.height / 2 - 2),
      new Phaser.Math.Vector2(-B.width / 2 - B.tail * 0.4, B.height / 2 + B.tail),
    ], true);
    bubble.add(tail);
    bubble.add(scene.add.text(0, 0, spec.plea, textStyle({ role: "emphasis", size: B.textSize, color: BUBBLE_INK, align: "center", lineSpacing: 6, wrap: B.textWrap })).setOrigin(0.5));
    stage.add(bubble);
    if (loops) {
      bubble.setScale(0.6).setAlpha(0);
      scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 160, ease: "Back.Out" });
    }

    // `LV 30 → LV 1` — 프로필 레벨 칩처럼 `LV`는 작고 흐리게, 수는 크게. 지금 레벨은 흰색, 도착하는 자리는 창마다 제 색이다.
    const level = scene.add.container(B.x, S.levelY);
    const from = levelMark(scene, spec.from, S.levelSize, COLOR.ink);
    const arrow = scene.add.text(0, 0, "→", textStyle({ role: "display", size: S.levelSize * 0.7, color: COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#05070a", 6);
    const to = levelMark(scene, spec.to, S.levelTargetSize, spec.toColor);
    const gap = 22;
    const span = from.width + arrow.width + to.width + gap * 2;
    let lx = -span / 2;
    from.setX(lx + from.width / 2); lx += from.width + gap;
    arrow.setX(lx); lx += arrow.width + gap;
    to.setX(lx + to.width / 2);
    level.add([from, arrow, to]);
    // 세 자리 레벨이면 한 줄이 판 오른쪽 끝에 닿는다 — 넘칠 때만 통째로 줄인다(왼쪽 SD 쪽으로도 넘지 않게).
    const room = (L.width / 2 - 36 - B.x) * 2;
    if (span > room) level.setScale(room / span);
    // 도착 레벨이 한 번 톡 부풀었다 자리 잡는다 — 이 창이 말하는 핵심이 거기 있다.
    if (loops) {
      to.setScale(0.6);
      scene.tweens.add({ targets: to, scale: 1, duration: 420, delay: 260, ease: "Back.Out" });
    }
    stage.add(level);

    // SD — 발밑 그림자 위에 선다. 되돌릴 때는 떨며 땀을 흘리고, 먹일 때는 통통 뛴다.
    if (spec.asset) {
      stage.add(addSdFootShadow(scene, S.sd.x, S.sd.ground, S.sd.shadow));
      void spawnPuppet(scene, spec.asset, { x: S.sd.x, groundY: S.sd.ground, height: S.sd.height, depth: 0 })
        .then((puppet) => {
          if (!stage.active) { puppet.destroy(); return; }
          puppet.disableInteractive();
          stage.add(puppet);
          stage.bringToTop(bubble);
          if (spec.mood === "afraid") { if (loops) tremble(scene, puppet, S.sd.x); }
          else {
            const hop = startPuppetHop(scene, puppet, 0);
            puppet.once(Phaser.GameObjects.Events.DESTROY, () => hop.remove());
          }
        })
        .catch((error) => logError("puppet.display", "레벨 확인 창 SD 표시 실패", error));
      if (spec.mood === "afraid") addSweat(scene, stage, S.sd.x + S.sweat.dx, S.sd.ground - S.sweat.rise, S.sweat.size, loops);
    }

    paintWallet(scene, body, spots.walletTop, spots.walletHeight, spec.rows, spec.edge, RELIC_RESET_POPUP.backdrop[spec.mood].panel);

    if (spec.loss !== undefined && spots.warningY !== undefined) paintLossWarning(scene, body, spots.warningY, spec.loss, loops);

    body.add(scene.add.text(0, spots.noteY, spec.note, textStyle({ role: "body", size: L.noteSize, color: COLOR.inkDim, align: "center", lineSpacing: 4 })).setOrigin(0.5));

    // 취소 버튼은 두지 않는다 — 닫는 길은 판 밖 우하단 뒤로가기와 판 밖 누르기다.
    body.add(new Button(scene, 0, spots.buttonY, {
      width: L.button.width, height: L.button.height, fontSize: L.button.fontSize,
      label: spec.confirm.label,
      ...(spec.confirm.destructive ? DESTRUCTIVE_BUTTON_STYLE : { variant: "primary" as const, ...(spec.confirmFill !== undefined ? { fill: spec.confirmFill, decorDots: true } : {}) }),
      ...(spec.confirm.ribbon ? { ribbon: spec.confirm.ribbon } : {}),
      onClick: () => { audioManager?.playUi(spec.confirm.destructive ? "ui.danger" : "ui.confirm"); close(); onConfirm(); },
    }));
  });
}

/**
 * `LV` 꼬리표 + 큰 수 한 덩어리 — 프로필 카드의 레벨 칩과 같은 문법이다. 둘의 밑선을 맞춰 꼬리표가 수 아래쪽에 붙는다.
 * 돌려주는 컨테이너의 `width`는 덩어리 전체 폭이고, 자식은 가운데(0)를 기준으로 선다 — 부풀리는 연출이 제자리에서 커진다.
 */
function levelMark(scene: Phaser.Scene, value: number, size: number, color: string): Phaser.GameObjects.Container {
  const tagSize = Math.round(size * RELIC_RESET_POPUP.stage.levelTagRatio);
  const tag = scene.add.text(0, 0, "LV", textStyle({ role: "display", size: tagSize, color: COLOR.inkDim })).setOrigin(0, 1).setStroke("#05070a", 5);
  const number = scene.add.text(0, 0, String(value), textStyle({ role: "display", size, color })).setOrigin(0, 1).setStroke("#05070a", Math.round(size / 9));
  const tagGap = Math.round(size * 0.08);
  const width = tag.width + tagGap + number.width;
  // 글자 상자의 밑선이 아니라 획의 밑선이 맞도록 — 상자 아래 여백(내림)은 글자 크기에 비례한다.
  const bottom = number.height / 2;
  number.setPosition(-width / 2 + tag.width + tagGap, bottom);
  tag.setPosition(-width / 2, bottom - (number.height - tag.height) * 0.2);
  const mark = scene.add.container(0, 0, [tag, number]);
  mark.setSize(width, size);
  return mark;
}

/** 부들부들 — 짧게 좌우로 떨고 한 숨 쉰 뒤 다시 떤다. 처음 한 번은 움찔 뛰어오른다. */
function tremble(scene: Phaser.Scene, puppet: PuppetCreature, x: number): void {
  startPuppetHop(scene, puppet, 0, { once: true });
  const shake = scene.tweens.add({ targets: puppet, x: x + 5, duration: 45, yoyo: true, repeat: 7, loop: -1, loopDelay: 1300, delay: 520, onLoop: () => puppet.setX(x) });
  puppet.once(Phaser.GameObjects.Events.DESTROY, () => shake.remove());
}

/** 땀방울 — 물방울 모양 하나가 흘러내리다 사라지고, 잠시 뒤 다시 맺힌다. */
function addSweat(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: number, loops: boolean): void {
  const drop = scene.add.graphics();
  drop.fillStyle(0x0a1a2a, 0.55).fillPoints(dropPoints(size, 2, 3), true);
  drop.fillStyle(SWEAT_COLOR, 1).fillPoints(dropPoints(size, 0, 0), true);
  drop.fillStyle(0xffffff, 0.8).fillPoints(dropPoints(size * 0.3, -size * 0.12, size * 0.1), true);
  drop.setPosition(x, y);
  parent.add(drop);
  if (!loops) return;
  drop.setAlpha(0);
  const fall = scene.tweens.add({
    targets: drop, y: { from: y, to: y + size * 2.2 }, alpha: { from: 1, to: 0 }, duration: 900, ease: "Quad.In", delay: 400, loop: -1, loopDelay: 700,
  });
  drop.once(Phaser.GameObjects.Events.DESTROY, () => fall.remove());
}

/** 위가 뾰족하고 아래가 둥근 물방울 — 둥근 아래는 여러 각으로 끊는다. */
function dropPoints(size: number, dx: number, dy: number): Phaser.Math.Vector2[] {
  const r = size * 0.5;
  const points = [new Phaser.Math.Vector2(dx, dy - size)];
  for (let i = 0; i <= 8; i += 1) {
    const angle = Math.PI * (-0.15 + (1.3 * i) / 8);
    points.push(new Phaser.Math.Vector2(dx + Math.cos(angle) * r, dy + Math.sin(angle) * r));
  }
  return points;
}

/** 보유 재화 변화 — 재화마다 `그림 · 지금 → 뒤 · 증감` 한 줄. */
function paintWallet(scene: Phaser.Scene, body: Phaser.GameObjects.Container, top: number, height: number, rows: readonly { icon: string; before: number; after: number }[], edge: number, fill: number): void {
  const W = RELIC_RESET_POPUP.wallet;
  const width = RELIC_RESET_POPUP.width - W.inset * 2;
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  body.add(drawLayer(scene, 0, top + height / 2, chipPoints(width, height, { bevel: { topLeft: unit, bottomRight: unit } }), { fill, alpha: 0.9, edge, edgeAlpha: 0.8, shadow: { x: 8, y: 12 } }));
  body.add(scene.add.text(-width / 2 + 36, top + W.padY + W.headerHeight / 2, t("info.reset.wallet"), textStyle({ role: "emphasis", size: W.headerSize, color: COLOR.inkDim })).setOrigin(0, 0.5));
  const C = W.columns;
  rows.forEach((row, index) => {
    const y = top + W.padY + W.headerHeight + W.rowHeight * (index + 0.5);
    body.add(scene.add.image(C.icon + 3, y + 4, row.icon).setDisplaySize(W.icon, W.icon).setTint(0x05070a).setAlpha(0.55));
    body.add(scene.add.image(C.icon, y, row.icon).setDisplaySize(W.icon, W.icon));
    const rising = row.after >= row.before;
    const tone = rising ? COLOR.accentText : COLOR.dangerText;
    body.add(scene.add.text(C.before, y, row.before.toLocaleString(), textStyle({ role: "display", size: W.valueSize, color: COLOR.ink })).setOrigin(1, 0.5));
    body.add(scene.add.text(C.arrow, y, "→", textStyle({ role: "display", size: W.valueSize, color: COLOR.inkDim })).setOrigin(0.5));
    body.add(scene.add.text(C.after, y, row.after.toLocaleString(), textStyle({ role: "display", size: W.valueSize, color: tone })).setOrigin(0, 0.5));
    // 증감은 제 색으로 물든 알약 — 얼마가 나가고 들어오는지가 줄에서 가장 먼저 읽힌다.
    const delta = row.after - row.before;
    const deltaText = scene.add.text(0, 0, `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}`, textStyle({ role: "display", size: W.deltaSize, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 5);
    const P = W.deltaPill;
    const pillWidth = deltaText.width + P.padX * 2;
    const pillX = C.delta - pillWidth / 2;
    const pillColor = rising ? COLOR.accent : COLOR.danger;
    body.add(drawLayer(scene, pillX, y, chipPoints(pillWidth, P.height, { bevel: { topLeft: P.height * 0.3, bottomRight: P.height * 0.3 } }), { fill: pillColor, alpha: 0.85, shadow: { x: 4, y: 6 } }));
    body.add(deltaText.setPosition(pillX, y));
  });
}

/**
 * 「90%만 환급」 경고 띠 — 붉은 `!` 마름모 + 굵은 제목 + 한 줄 풀이, 오른쪽에 잃는 치즈케이크 알약(`그림 −N`).
 * 띠는 짙은 장밋빛 유리에 붉은 강조선을 두르고, `!`만 천천히 숨 쉰다(움직임 줄이기에서는 멈춘다).
 */
function paintLossWarning(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, loss: number, loops: boolean): void {
  const W = RELIC_RESET_POPUP.warning;
  const width = RELIC_RESET_POPUP.width - RELIC_RESET_POPUP.wallet.inset * 2;
  const unit = Math.min(width, W.height) * POPUP_BODY_BEVEL_RATIO;
  body.add(drawLayer(scene, 0, y, chipPoints(width, W.height, { bevel: { topLeft: unit, bottomRight: unit } }), { fill: WARNING_FILL, alpha: 0.92, edge: COLOR.danger, edgeAlpha: 1, shadow: { x: 8, y: 12 } }));

  // `!` 마름모 — 붉은 면에 흰 느낌표, 검은 획.
  const B = W.badge;
  const badge = scene.add.container(B.x, y);
  const r = B.size / 2;
  badge.add(scene.add.graphics()
    .fillStyle(0x05070a, 0.6).fillPoints(diamond(r, 3, 5), true)
    .fillStyle(COLOR.danger, 1).fillPoints(diamond(r, 0, 0), true)
    .lineStyle(3, 0xffffff, 0.85).strokePoints(diamond(r - 4, 0, 0), true));
  badge.add(scene.add.text(0, 2, "!", textStyle({ role: "display", size: B.glyphSize, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 6));
  body.add(badge);
  if (loops) {
    const pulse = scene.tweens.add({ targets: badge, scale: 1.12, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    badge.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
  }

  // 오른쪽 알약 — 잃는 치즈케이크 수.
  const P = W.pill;
  const amount = scene.add.text(0, 0, `−${loss.toLocaleString()}`, textStyle({ role: "display", size: P.textSize, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 5);
  const pillWidth = P.padX * 2 + P.icon + P.gap + amount.width;
  const pillX = P.right - pillWidth / 2;
  body.add(drawLayer(scene, pillX, y, chipPoints(pillWidth, P.height, { bevel: { topLeft: P.height * 0.3, bottomRight: P.height * 0.3 } }), { fill: COLOR.danger, alpha: 0.9, shadow: { x: 4, y: 6 } }));
  const iconX = P.right - pillWidth + P.padX + P.icon / 2;
  body.add(scene.add.image(iconX, y, CURRENCY_ICON_BY_WALLET.cheesecake).setDisplaySize(P.icon, P.icon));
  body.add(amount.setPosition(iconX + P.icon / 2 + P.gap, y));

  // 제목·풀이 — 알약 왼쪽 자리 안에서만. 넘치면 가로로 누른다.
  const textRoom = P.right - pillWidth - 20 - W.textX;
  const title = scene.add.text(W.textX, y - 18, t("info.reset.warn.title"), textStyle({ role: "display", size: W.titleSize, color: WARNING_TITLE })).setOrigin(0, 0.5).setStroke("#05070a", 5);
  const line = scene.add.text(W.textX, y + 24, t("info.reset.warn.body"), textStyle({ role: "body", size: W.bodySize, color: COLOR.ink })).setOrigin(0, 0.5);
  squeezeTextToWidth(title, textRoom);
  squeezeTextToWidth(line, textRoom);
  body.add([title, line]);
}

function diamond(r: number, dx: number, dy: number): Phaser.Math.Vector2[] {
  return [new Phaser.Math.Vector2(dx, dy - r), new Phaser.Math.Vector2(dx + r, dy), new Phaser.Math.Vector2(dx, dy + r), new Phaser.Math.Vector2(dx - r, dy)];
}

/**
 * 판 뒷배경 — 위는 그 창의 기분 색으로 물들고 아래로 갈수록 판의 남색에 가라앉는다. 무대에는 SD 뒤에서 퍼지는
 * 빛살, 마름모 점 무늬, 떠오르는 반짝임이 같은 색으로 얹힌다. 모두 몸판과 같은 실루엣(`popupArtShape`)으로 잘라
 * 깎인 두 모서리 밖으로 새지 않는다.
 */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, spots: RelicResetPopupSpots, mood: RelicAskMood, loops: boolean): void {
  const L = RELIC_RESET_POPUP;
  const D = L.backdrop;
  const tone = D[mood];
  const width = L.width;
  const height = spots.height;
  const top = -height / 2;
  const stageBottom = spots.walletTop;
  const mask = shapeClipMask(scene, body, popupArtShape(width, height));
  // 빛살·후광은 무대 안에서만 — 재화 판·버튼 뒤까지 번지면 읽어야 할 수가 그 무늬 위에 선다.
  const stageHeight = stageBottom - top;
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  const stageMask = shapeClipMask(scene, body, chipPoints(width, stageHeight, { bevel: { topLeft: unit } }), { x: 0, y: top + stageHeight / 2 });

  // 물들임 — 무대 높이까지 그 색, 아래로 그 색의 짙은 결에 가라앉았다가 밑동에서 다시 은은히 물든다.
  const wash = scene.add.graphics();
  const lowTop = stageBottom + 40;
  wash.fillGradientStyle(tone.wash, tone.wash, tone.deep, tone.deep, D.washAlpha, D.washAlpha, D.washAlpha * 0.9, D.washAlpha * 0.9);
  wash.fillRect(-width / 2, top, width, lowTop - top);
  wash.fillGradientStyle(tone.deep, tone.deep, tone.wash, tone.wash, D.washAlpha * 0.9, D.washAlpha * 0.9, D.washAlpha * 0.75, D.washAlpha * 0.75);
  wash.fillRect(-width / 2, lowTop, width, height / 2 - lowTop);
  wash.setMask(mask);
  body.add(wash);

  // 빛살 — SD 머리 쪽에서 부채처럼 퍼지고, 천천히 돈다.
  const S = L.stage;
  const cx = S.sd.x;
  const cy = spots.stageTop + S.sd.ground - S.sd.height * 0.55;
  const rays = scene.add.graphics({ x: cx, y: cy });
  rays.setBlendMode(Phaser.BlendModes.ADD);
  const reach = width * 1.1;
  const step = (Math.PI * 2) / D.rays;
  for (let i = 0; i < D.rays; i += 1) {
    const a = i * step;
    rays.fillStyle(tone.ray, D.rayAlpha * (i % 2 === 0 ? 1 : 0.55));
    rays.fillTriangle(0, 0, Math.cos(a - step * 0.22) * reach, Math.sin(a - step * 0.22) * reach, Math.cos(a + step * 0.22) * reach, Math.sin(a + step * 0.22) * reach);
  }
  rays.setMask(stageMask);
  body.add(rays);
  if (loops) {
    const spin = scene.tweens.add({ targets: rays, angle: mood === "excited" ? 360 : -360, duration: D.spinMs[mood], repeat: -1 });
    rays.once(Phaser.GameObjects.Events.DESTROY, () => spin.remove());
  }

  // 빛살 한가운데의 은은한 후광 — SD 뒤가 가장 밝다.
  const halo = scene.add.graphics({ x: cx, y: cy });
  halo.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i += 1) {
    const r = 70 + i * 34;
    halo.fillStyle(tone.ray, 0.04);
    halo.fillPoints([new Phaser.Math.Vector2(0, -r), new Phaser.Math.Vector2(r * 1.15, 0), new Phaser.Math.Vector2(0, r), new Phaser.Math.Vector2(-r * 1.15, 0)], true);
  }
  halo.setMask(stageMask);
  body.add(halo);

  // 마름모 점 무늬 — 무대 위쪽이 진하고 아래로 사라진다. 줄마다 반 칸씩 어긋난다.
  const dots = scene.add.graphics();
  const gap = D.dotStep;
  for (let row = 0, y = top + gap / 2; y < stageBottom; row += 1, y += gap) {
    const fade = 1 - (y - top) / (stageBottom - top);
    dots.fillStyle(tone.dot, D.dotAlpha * fade);
    for (let x = -width / 2 + (row % 2 === 0 ? gap / 2 : gap); x < width / 2; x += gap) {
      dots.fillPoints([new Phaser.Math.Vector2(x, y - 3.5), new Phaser.Math.Vector2(x + 3.5, y), new Phaser.Math.Vector2(x, y + 3.5), new Phaser.Math.Vector2(x - 3.5, y)], true);
    }
  }
  dots.setMask(mask);
  body.add(dots);

  // 무대 바닥선 — 재화 판 위로 얇은 빛 한 줄이 무대와 아래를 가른다.
  const floor = scene.add.graphics();
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0, 0.25, 0, 0.25);
  floor.fillRect(-width / 2, stageBottom - 6, width / 2, 2);
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0.25, 0, 0.25, 0);
  floor.fillRect(0, stageBottom - 6, width / 2, 2);
  floor.setMask(mask);
  body.add(floor);

  // 아래 — 밑동에서 피어오르는 점 무늬(위로 갈수록 옅어져 안내 줄 둘레는 비운다).
  const lowDots = scene.add.graphics();
  const bottom = height / 2;
  const rise = bottom - (spots.noteY + 20);
  for (let row = 0, y = bottom - gap / 2; y > spots.noteY + 20; row += 1, y -= gap) {
    const fade = 1 - (bottom - y) / rise;
    lowDots.fillStyle(tone.dot, D.dotAlpha * 0.8 * fade);
    for (let x = -width / 2 + (row % 2 === 0 ? gap / 2 : gap); x < width / 2; x += gap) {
      lowDots.fillPoints([new Phaser.Math.Vector2(x, y - 3.5), new Phaser.Math.Vector2(x + 3.5, y), new Phaser.Math.Vector2(x, y + 3.5), new Phaser.Math.Vector2(x - 3.5, y)], true);
    }
  }
  lowDots.setMask(mask);
  body.add(lowDots);

  // 확정 버튼 뒤의 납작한 마름모 후광 — 누를 자리로 눈이 모인다.
  const glow = scene.add.graphics({ x: 0, y: spots.buttonY });
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 5; i += 1) {
    const r = 150 + i * 46;
    glow.fillStyle(tone.ray, 0.035);
    glow.fillPoints([new Phaser.Math.Vector2(0, -r * 0.42), new Phaser.Math.Vector2(r * 1.5, 0), new Phaser.Math.Vector2(0, r * 0.42), new Phaser.Math.Vector2(-r * 1.5, 0)], true);
  }
  glow.setMask(mask);
  body.add(glow);

  // 밑변 반짝이 줄 — 무대 바닥선과 같은 결의 빛 한 줄과 양 끝의 작은 마름모.
  const hem = scene.add.graphics();
  hem.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0, 0.25, 0, 0.25);
  hem.fillRect(-width / 2, bottom - 18, width / 2, 2);
  hem.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0.25, 0, 0.25, 0);
  hem.fillRect(0, bottom - 18, width / 2, 2);
  hem.fillStyle(tone.spark, 0.55);
  for (const [hx, size] of [[-width / 2 + 48, 8], [-width / 2 + 76, 5], [width / 2 - 120, 6], [width / 2 - 94, 9]] as const) {
    hem.fillPoints([new Phaser.Math.Vector2(hx, bottom - 17 - size), new Phaser.Math.Vector2(hx + size * 0.8, bottom - 17), new Phaser.Math.Vector2(hx, bottom - 17 + size * 0.9), new Phaser.Math.Vector2(hx - size * 0.7, bottom - 17)], true);
  }
  hem.setMask(mask);
  body.add(hem);

  // 반짝임 — 난수 없이 번호에서 자리·박자를 정한다. 무대 안에서 떠오르며 숨 쉰다.
  for (let i = 0; i < D.sparks; i += 1) {
    const x = -width / 2 + 60 + ((i * 263) % (width - 120));
    const y = spots.stageTop + 40 + ((i * 131) % (L.stage.height - 80));
    const size = 5 + (i % 3) * 2.5;
    const spark = scene.add.graphics({ x, y });
    spark.setBlendMode(Phaser.BlendModes.ADD);
    spark.fillStyle(tone.spark, 0.7);
    spark.fillPoints([new Phaser.Math.Vector2(0, -size * 1.6), new Phaser.Math.Vector2(size * 0.4, -size * 0.4), new Phaser.Math.Vector2(size * 1.6, 0), new Phaser.Math.Vector2(size * 0.4, size * 0.4), new Phaser.Math.Vector2(0, size * 1.6), new Phaser.Math.Vector2(-size * 0.4, size * 0.4), new Phaser.Math.Vector2(-size * 1.6, 0), new Phaser.Math.Vector2(-size * 0.4, -size * 0.4)], true);
    spark.setMask(mask);
    body.add(spark);
    if (!loops) { spark.setAlpha(0.5); continue; }
    spark.setAlpha(0).setScale(0.4);
    const rise = mood === "excited" ? 30 : 16;
    const twinkle = scene.tweens.add({
      targets: spark, alpha: { from: 0, to: 0.7 }, scale: { from: 0.4, to: 1 }, y: { from: y, to: y - rise },
      duration: 1600 + (i % 4) * 300, yoyo: true, repeat: -1, delay: (i * 370) % 1800, ease: "Sine.InOut",
    });
    spark.once(Phaser.GameObjects.Events.DESTROY, () => twinkle.remove());
  }
}
