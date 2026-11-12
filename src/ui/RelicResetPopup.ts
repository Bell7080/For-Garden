/**
 * 레벨 초기화 창 — 공용 확인 창 대신 **그 아이가 직접 묻는** 한 장.
 *
 * 위 무대에 그 개체의 SD가 땀을 흘리며 부들부들 떨고, 말풍선이 「정말 나를 처음으로 되돌릴 거야?」를 묻는다.
 * 아래 유리 판은 보유 재화가 어떻게 바뀌는지를 재화마다 한 줄로 적고(`지금 → 뒤 · 증감`), 확정 버튼 안에
 * 값이 박힌다 — 무료면 값 대신 모서리 딱지가 붙는다. 자리는 `relicResetPopupLayout.ts`가 갖는다.
 *
 * **MAX 급여 확인 창도 같은 한 장이다**(`openRelicFeedMaxPopup`). 무대·레벨 줄·재화 판은 그대로 두고, 그 아이가
 * 떨지 않고 신이 나서 통통 뛰며 「이걸 전부 저한테 주시는 거예요?!」를 존댓말로 묻는다. 그 창은 취소 버튼 없이 확정 하나만
 * 서고, 닫는 길은 판 밖 우하단의 공용 뒤로가기와 판 밖 누르기다.
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
import { RELIC_RESET_POPUP, relicResetButtonXs, relicResetPopupSpots, type RelicAskMood, type RelicResetPopupSpots } from "./relicResetPopupLayout";
import { addSdFootShadow } from "./SdFootShadow";
import { FEED_BULK_PANEL, FEED_BULK_TONES } from "./feedBulkStyle";
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
  /** 무대의 그 아이 — 떨며 땀을 흘리거나, 신이 나서 통통 뛴다. */
  mood: RelicAskMood;
  /** 판 테두리·재화 판의 강조 색. */
  edge: number;
  confirm: { label: string; destructive: boolean; ribbon?: string };
  /** 취소 버튼을 세우는가 — 없으면 판 밖 뒤로가기와 판 밖 누르기가 닫는다. */
  cancel: boolean;
  /** 몸판의 면·강조선 색. 없으면 공용 판이다(MAX 급여는 쪽지와 같은 사탕빛 판을 입는다). */
  panel?: { fill: number; accent: number };
  /** 확정 버튼의 면 색(강조 버튼일 때만). */
  confirmFill?: number;
}

const BUBBLE_INK = "#20242b";
/** MAX 급여의 도착 레벨 — 금빛 테와 같은 결. */
const MAX_GOLD_TEXT = "#ffd34d";
const SWEAT_COLOR = 0x9fd8ff;

export function openRelicResetPopup(scene: Phaser.Scene, popups: PopupLayer, options: RelicResetPopupOptions, onConfirm: () => void): void {
  const note = options.loss > 0 ? t("info.reset.loss", { count: options.loss.toLocaleString() }) + "\n" + t("info.reset.keep") : t("info.reset.keep");
  openRelicAskPopup(scene, popups, {
    asset: options.asset,
    title: t("info.reset.title"),
    plea: t("info.reset.plea"),
    from: options.level,
    to: 1,
    toColor: COLOR.dangerText,
    rows: [{ icon: CURRENCY_ICON_BY_WALLET.cheesecake, before: session.wallet.cheesecake, after: session.wallet.cheesecake + options.refund }],
    note,
    mood: "afraid",
    edge: COLOR.danger,
    // 잃는 것이 없으면 확정 버튼에 「무료!」 딱지가 붙는다 — 21레벨까지는 먹인 것을 그대로 돌려받는다.
    confirm: { label: t("info.reset.confirm"), destructive: true, ...(options.loss > 0 ? {} : { ribbon: t("info.reset.free") }) },
    cancel: true,
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
    cancel: false,
    panel: { fill: FEED_BULK_PANEL.fill, accent: FEED_BULK_PANEL.accent },
    confirmFill: FEED_BULK_TONES.max.cream,
  }, onConfirm);
}

function openRelicAskPopup(scene: Phaser.Scene, popups: PopupLayer, spec: AskSpec, onConfirm: () => void): void {
  const L = RELIC_RESET_POPUP;
  const spots = relicResetPopupSpots(spec.rows.length);
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;

  popups.open({ width: L.width, height: spots.height, title: spec.title, dim: true, dimAlpha: L.dimAlpha, hideCloseButton: spec.cancel, ...(spec.panel ?? {}) }, (body, close) => {
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

    // `LV.30 → LV.1` — 지금 레벨은 흰색, 도착하는 자리는 창마다 제 색이다.
    const level = scene.add.container(B.x, S.levelY);
    const from = scene.add.text(0, 0, `LV.${spec.from}`, textStyle({ role: "display", size: S.levelSize, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 8);
    const arrow = scene.add.text(0, 0, "→", textStyle({ role: "display", size: S.levelSize * 0.8, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 6);
    const to = scene.add.text(0, 0, `LV.${spec.to}`, textStyle({ role: "display", size: S.levelTargetSize, color: spec.toColor })).setOrigin(0, 0.5).setStroke("#05070a", 9);
    const gap = 18;
    const span = from.width + arrow.width + to.width + gap * 2;
    let lx = -span / 2;
    from.setX(lx); lx += from.width + gap;
    arrow.setX(lx); lx += arrow.width + gap;
    to.setX(lx);
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

    body.add(scene.add.text(0, spots.noteY, spec.note, textStyle({ role: "body", size: L.noteSize, color: COLOR.inkDim, align: "center", lineSpacing: 4 })).setOrigin(0.5));

    const [cancelX, confirmX] = spec.cancel ? relicResetButtonXs() : [0, 0];
    const common = { width: L.button.width, height: L.button.height, fontSize: L.button.fontSize };
    if (spec.cancel) body.add(new Button(scene, cancelX, spots.buttonY, { ...common, label: t("popup.cancel"), onClick: close }));
    body.add(new Button(scene, confirmX, spots.buttonY, {
      ...common,
      label: spec.confirm.label,
      ...(spec.confirm.destructive ? DESTRUCTIVE_BUTTON_STYLE : { variant: "primary" as const, ...(spec.confirmFill !== undefined ? { fill: spec.confirmFill, decorDots: true } : {}) }),
      ...(spec.confirm.ribbon ? { ribbon: spec.confirm.ribbon } : {}),
      onClick: () => { audioManager?.playUi(spec.confirm.destructive ? "ui.danger" : "ui.confirm"); close(); onConfirm(); },
    }));
  });
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
    const delta = row.after - row.before;
    body.add(scene.add.text(C.delta, y, `${delta >= 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}`, textStyle({ role: "emphasis", size: W.deltaSize, color: tone })).setOrigin(1, 0.5));
  });
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
  const reach = width * 1.2;
  const step = (Math.PI * 2) / D.rays;
  for (let i = 0; i < D.rays; i += 1) {
    const a = i * step;
    rays.fillStyle(tone.ray, D.rayAlpha * (i % 2 === 0 ? 1 : 0.55));
    rays.fillTriangle(0, 0, Math.cos(a - step * 0.22) * reach, Math.sin(a - step * 0.22) * reach, Math.cos(a + step * 0.22) * reach, Math.sin(a + step * 0.22) * reach);
  }
  rays.setMask(stageMask);
  body.add(rays);
  if (loops) {
    const spin = scene.tweens.add({ targets: rays, angle: mood === "excited" ? 360 : -360, duration: mood === "excited" ? 24000 : 40000, repeat: -1 });
    rays.once(Phaser.GameObjects.Events.DESTROY, () => spin.remove());
  }

  // 빛살 한가운데의 은은한 후광 — SD 뒤가 가장 밝다.
  const halo = scene.add.graphics({ x: cx, y: cy });
  halo.setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i += 1) {
    const r = 70 + i * 34;
    halo.fillStyle(tone.ray, 0.07);
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
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0, 0.35, 0, 0.35);
  floor.fillRect(-width / 2, stageBottom - 6, width / 2, 2);
  floor.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0.35, 0, 0.35, 0);
  floor.fillRect(0, stageBottom - 6, width / 2, 2);
  floor.setMask(mask);
  body.add(floor);

  // 아래 — 밑동에서 피어오르는 점 무늬(위로 갈수록 옅어져 안내 줄 둘레는 비운다).
  const lowDots = scene.add.graphics();
  const bottom = height / 2;
  const rise = bottom - (spots.noteY + 20);
  for (let row = 0, y = bottom - gap / 2; y > spots.noteY + 20; row += 1, y -= gap) {
    const fade = 1 - (bottom - y) / rise;
    lowDots.fillStyle(tone.dot, D.dotAlpha * 1.1 * fade);
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
    glow.fillStyle(tone.ray, 0.06);
    glow.fillPoints([new Phaser.Math.Vector2(0, -r * 0.42), new Phaser.Math.Vector2(r * 1.5, 0), new Phaser.Math.Vector2(0, r * 0.42), new Phaser.Math.Vector2(-r * 1.5, 0)], true);
  }
  glow.setMask(mask);
  body.add(glow);

  // 밑변 반짝이 줄 — 무대 바닥선과 같은 결의 빛 한 줄과 양 끝의 작은 마름모.
  const hem = scene.add.graphics();
  hem.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0, 0.4, 0, 0.4);
  hem.fillRect(-width / 2, bottom - 18, width / 2, 2);
  hem.fillGradientStyle(tone.ray, tone.ray, tone.ray, tone.ray, 0.4, 0, 0.4, 0);
  hem.fillRect(0, bottom - 18, width / 2, 2);
  hem.fillStyle(tone.spark, 0.9);
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
    spark.fillStyle(tone.spark, 0.85);
    spark.fillPoints([new Phaser.Math.Vector2(0, -size * 1.6), new Phaser.Math.Vector2(size * 0.4, -size * 0.4), new Phaser.Math.Vector2(size * 1.6, 0), new Phaser.Math.Vector2(size * 0.4, size * 0.4), new Phaser.Math.Vector2(0, size * 1.6), new Phaser.Math.Vector2(-size * 0.4, size * 0.4), new Phaser.Math.Vector2(-size * 1.6, 0), new Phaser.Math.Vector2(-size * 0.4, -size * 0.4)], true);
    spark.setMask(mask);
    body.add(spark);
    if (!loops) { spark.setAlpha(0.5); continue; }
    spark.setAlpha(0).setScale(0.4);
    const rise = mood === "excited" ? 46 : 22;
    const twinkle = scene.tweens.add({
      targets: spark, alpha: { from: 0, to: 0.9 }, scale: { from: 0.4, to: 1 }, y: { from: y, to: y - rise },
      duration: 1100 + (i % 4) * 220, yoyo: true, repeat: -1, delay: (i * 370) % 1800, ease: "Sine.InOut",
    });
    spark.once(Phaser.GameObjects.Events.DESTROY, () => twinkle.remove());
  }
}
