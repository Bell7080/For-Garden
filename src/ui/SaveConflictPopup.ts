import Phaser from "phaser";
import { t } from "../i18n";
import type { ProgressSummary } from "../api/AccountApi";
import type { PopupLayer } from "./PopupLayer";
import { Button } from "./Button";
import { chipPoints, drawHairline, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { formatCurrency } from "../core/formatCurrency";
import { lastActiveAge } from "../core/social";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export type SaveConflictChoice = "local" | "remote" | "cancel";

/** 자리표 — 두 카드가 마주 서고 그 밑에 저마다 고르는 버튼이 선다. */
const CONFLICT = {
  width: 940, height: 860, noticeY: -300,
  card: { x: 222, y: -30, width: 420, height: 440, headY: -178, levelY: -96, frameY: 22, frame: 104, frameGap: 128, timeY: 136, dateY: 172 },
  buttonY: 300, button: { width: 380, height: 92 },
} as const;

const SIDE_TONE = {
  local: { fill: 0x2a2416, edge: COLOR.accent, text: COLOR.accentText },
  remote: { fill: 0x14283a, edge: COLOR.exchange, text: COLOR.exchangeText },
} as const;

function parseTime(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function agoText(ms: number, now: number): string {
  const age = lastActiveAge(ms, now);
  if (age.unit === "online") return t("friends.age.minute", { value: Math.max(1, Math.floor(Math.max(0, now - ms) / 60_000)) });
  return t(`friends.age.${age.unit}`, { value: age.value });
}

function dateText(ms: number): string {
  if (!ms) return "-";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 로컬/서버가 다를 때 자동 덮어쓰기 대신 양쪽 핵심 진행을 **두 장의 카드로 마주 세워** 고르게 한다.
 *
 * 세 줄 글자를 나란히 적던 때는 어느 쪽이 더 앞선 진행인지 숫자를 한 줄씩 대조해야 했다. 카드마다 레벨이
 * 크게 서고 젬·골드는 영수증과 같은 액자, 최근 플레이는 「몇 시간 전」으로 적으며, 더 늦게 플레이한 쪽에
 * 「최신」 딱지가 붙는다. 고르는 버튼은 그 카드 바로 밑에 선다. 고르지 않고 물러나는 길은 판 밖 뒤로가기다.
 */
export function openSaveConflictPopup(scene: Phaser.Scene, popups: PopupLayer, local: ProgressSummary, remote: ProgressSummary, resolve: (choice: SaveConflictChoice) => void): void {
  const C = CONFLICT;
  let settled = false;
  const settle = (choice: SaveConflictChoice): void => {
    if (settled) return;
    settled = true;
    resolve(choice);
  };
  const now = Date.now();
  const localMs = parseTime(local.lastPlayedAt);
  const remoteMs = parseTime(remote.lastPlayedAt);
  popups.open({ width: C.width, height: C.height, title: t("saveConflict.title"), dim: true, closeOnBackdrop: false, onClose: () => settle("cancel") }, (body, close) => {
    const notice = scene.add.text(0, C.noticeY, t("saveConflict.notice"), textStyle({ role: "body", size: 24, color: COLOR.inkDim, align: "center" })).setOrigin(0.5);
    squeezeTextToWidth(notice, C.width - 90);
    body.add(notice);
    const card = (sign: -1 | 1, side: "local" | "remote", value: ProgressSummary, ms: number, newer: boolean): void => {
      const K = C.card;
      const tone = SIDE_TONE[side];
      const holder = scene.add.container(sign * K.x, K.y);
      holder.add(drawLayer(scene, 0, 0, chipPoints(K.width, K.height, { bevel: { topLeft: 30, bottomRight: 30 } }), {
        fill: 0x0d1219, alpha: 0.92, edge: tone.edge, edgeWidth: 3, glow: newer ? { color: tone.edge, strength: 0.3 } : undefined,
      }));
      holder.add(drawLayer(scene, 0, K.headY, chipPoints(K.width - 40, 62, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: tone.fill, alpha: 0.95, shadow: false }));
      holder.add(scene.add.text(0, K.headY, t(side === "local" ? "saveConflict.local" : "saveConflict.remote"), textStyle({ role: "display", size: 30, color: tone.text })).setOrigin(0.5));
      if (newer) {
        // 더 늦게 플레이한 쪽 — 카드 오른쪽 위 모서리에 걸터앉는 딱지.
        const tagX = K.width / 2 - 70;
        const tagY = -K.height / 2 - 4;
        holder.add(drawLayer(scene, tagX, tagY, chipPoints(124, 40, { bevel: { topLeft: 10, bottomRight: 10 } }), { fill: tone.edge, alpha: 1, shadow: { x: 2, y: 4 } }));
        holder.add(scene.add.text(tagX, tagY, t("saveConflict.latest"), textStyle({ role: "emphasis", size: 22, color: "#0a0e14" })).setOrigin(0.5));
      }
      holder.add(scene.add.text(0, K.levelY, `LV.${value.playerLevel}`, textStyle({ role: "display", size: 64, color: COLOR.ink })).setOrigin(0.5).setStroke("#05070a", 7));
      addFramedIcon(scene, holder, -K.frameGap / 2, K.frameY, K.frame, "currency-gems", { amount: formatCurrency(value.currency.gems) });
      addFramedIcon(scene, holder, K.frameGap / 2, K.frameY, K.frame, "currency-gold", { amount: formatCurrency(value.currency.gold) });
      holder.add(drawHairline(scene, 0, K.timeY - 38, K.width - 80, { color: tone.edge, alpha: 0.3 }));
      holder.add(scene.add.text(0, K.timeY, `${t("saveConflict.lastPlayed")} · ${ms ? agoText(ms, now) : "-"}`, textStyle({ role: "emphasis", size: 26, color: newer ? tone.text : COLOR.ink })).setOrigin(0.5));
      holder.add(scene.add.text(0, K.dateY, dateText(ms), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5));
      body.add(holder);
      const label = t(side === "local" ? "saveConflict.useLocal" : "saveConflict.useRemote");
      body.add(new Button(scene, sign * K.x, C.buttonY, {
        width: C.button.width, height: C.button.height, label, fontSize: 30, variant: "primary",
        accentColor: tone.edge, accentTextColor: tone.text,
        onClick: () => { settle(side); close(); },
      }));
    };
    card(-1, "local", local, localMs, localMs > remoteMs);
    card(1, "remote", remote, remoteMs, remoteMs > localMs);
  });
}
