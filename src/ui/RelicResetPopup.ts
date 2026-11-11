/**
 * 레벨 초기화 창 — 공용 확인 창 대신 **그 아이가 직접 묻는** 한 장.
 *
 * 위 무대에 그 개체의 SD가 땀을 흘리며 부들부들 떨고, 말풍선이 「정말 나를 처음으로 되돌릴 거야?」를 묻는다.
 * 아래 유리 판은 보유 재화가 어떻게 바뀌는지를 재화마다 한 줄로 적고(`지금 → 뒤 · 증감`), 확정 버튼 안에
 * 값이 박힌다 — 무료면 값 대신 모서리 딱지가 붙는다. 자리는 `relicResetPopupLayout.ts`가 갖는다.
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
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { startPuppetHop } from "./puppetHop";
import { RELIC_RESET_POPUP, relicResetButtonXs, relicResetPopupSpots } from "./relicResetPopupLayout";
import { addSdFootShadow } from "./SdFootShadow";
import { COLOR, textStyle } from "./theme";

export interface RelicResetPopupOptions {
  /** 무대에 세울 SD. 없으면 무대는 말풍선만 남는다. */
  asset?: PuppetAsset;
  level: number;
  /** 돌려받는 치즈케이크. */
  refund: number;
  /** 드는 젬(무료면 0). */
  gems: number;
}

const BUBBLE_INK = "#20242b";
const SWEAT_COLOR = 0x9fd8ff;

export function openRelicResetPopup(scene: Phaser.Scene, popups: PopupLayer, options: RelicResetPopupOptions, onConfirm: () => void): void {
  const L = RELIC_RESET_POPUP;
  const rows: { icon: string; before: number; after: number }[] = [
    { icon: CURRENCY_ICON_BY_WALLET.cheesecake, before: session.wallet.cheesecake, after: session.wallet.cheesecake + options.refund },
  ];
  if (options.gems > 0) rows.push({ icon: CURRENCY_ICON_BY_WALLET.gems, before: session.wallet.gems, after: session.wallet.gems - options.gems });
  const spots = relicResetPopupSpots(rows.length);
  // 젬이 모자라도 창은 연다 — 무엇이 얼마 드는지 보고, 확정만 꺼진다. 차감은 서버가 다시 판정한다.
  const short = session.wallet.gems < options.gems;
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;

  popups.open({ width: L.width, height: spots.height, title: t("info.reset.title"), dim: true, dimAlpha: L.dimAlpha, hideCloseButton: true }, (body, close) => {
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
    bubble.add(scene.add.text(0, 0, t("info.reset.plea"), textStyle({ role: "emphasis", size: B.textSize, color: BUBBLE_INK, align: "center", lineSpacing: 6, wrap: B.textWrap })).setOrigin(0.5));
    stage.add(bubble);
    if (loops) {
      bubble.setScale(0.6).setAlpha(0);
      scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 160, ease: "Back.Out" });
    }

    // `LV.30 → LV.1` — 지금 레벨은 흰색, 돌아갈 자리는 붉다.
    const level = scene.add.container(B.x, S.levelY);
    const from = scene.add.text(0, 0, `LV.${options.level}`, textStyle({ role: "display", size: S.levelSize, color: COLOR.ink })).setOrigin(0, 0.5);
    const arrow = scene.add.text(0, 0, "→", textStyle({ role: "display", size: S.levelSize * 0.8, color: COLOR.inkDim })).setOrigin(0, 0.5);
    const to = scene.add.text(0, 0, "LV.1", textStyle({ role: "display", size: S.levelSize, color: COLOR.dangerText })).setOrigin(0, 0.5);
    const gap = 18;
    let lx = -(from.width + arrow.width + to.width + gap * 2) / 2;
    from.setX(lx); lx += from.width + gap;
    arrow.setX(lx); lx += arrow.width + gap;
    to.setX(lx);
    level.add([from, arrow, to]);
    stage.add(level);

    // SD — 발밑 그림자 위에 서서 떨고, 이마에서 땀방울이 흘러내린다.
    if (options.asset) {
      stage.add(addSdFootShadow(scene, S.sd.x, S.sd.ground, S.sd.shadow));
      void spawnPuppet(scene, options.asset, { x: S.sd.x, groundY: S.sd.ground, height: S.sd.height, depth: 0 })
        .then((puppet) => {
          if (!stage.active) { puppet.destroy(); return; }
          puppet.disableInteractive();
          stage.add(puppet);
          stage.bringToTop(bubble);
          if (loops) tremble(scene, puppet, S.sd.x);
        })
        .catch((error) => logError("puppet.display", "레벨 초기화 SD 표시 실패", error));
      addSweat(scene, stage, S.sd.x + S.sweat.dx, S.sd.ground - S.sweat.rise, S.sweat.size, loops);
    }

    paintWallet(scene, body, spots.walletTop, spots.walletHeight, rows);

    // 젬이 모자라면 남는 것 대신 왜 누를 수 없는지를 붉게 말한다.
    const note = short
      ? textStyle({ role: "emphasis", size: L.noteSize, color: COLOR.dangerText, align: "center" })
      : textStyle({ role: "body", size: L.noteSize, color: COLOR.inkDim, align: "center" });
    body.add(scene.add.text(0, spots.noteY, short ? t("info.reset.noGems") : t("info.reset.keep"), note).setOrigin(0.5));

    const [cancelX, confirmX] = relicResetButtonXs();
    const common = { width: L.button.width, height: L.button.height, fontSize: L.button.fontSize };
    body.add(new Button(scene, cancelX, spots.buttonY, { ...common, label: t("popup.cancel"), onClick: close }));
    const confirm = new Button(scene, confirmX, spots.buttonY, {
      ...common,
      label: t("info.reset.confirm"),
      ...DESTRUCTIVE_BUTTON_STYLE,
      ...(options.gems > 0
        ? { cost: { icon: CURRENCY_ICON_BY_WALLET.gems, amount: options.gems, affordable: session.wallet.gems >= options.gems } }
        : { ribbon: t("info.reset.free") }),
      onClick: () => { audioManager?.playUi("ui.danger"); close(); onConfirm(); },
    });
    if (short) confirm.setEnabled(false);
    body.add(confirm);
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
function paintWallet(scene: Phaser.Scene, body: Phaser.GameObjects.Container, top: number, height: number, rows: readonly { icon: string; before: number; after: number }[]): void {
  const W = RELIC_RESET_POPUP.wallet;
  const width = RELIC_RESET_POPUP.width - W.inset * 2;
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  body.add(drawLayer(scene, 0, top + height / 2, chipPoints(width, height, { bevel: { topLeft: unit, bottomRight: unit } }), { fill: 0x121821, alpha: 0.92, edge: COLOR.danger, edgeAlpha: 0.8 }));
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
