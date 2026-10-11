import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { AttendanceTrackDto, ClaimAttendanceResponse } from "../api/contracts";
import { ATTENDANCE_DAYS } from "../core/attendance";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { attendanceManager } from "../managers/AttendanceManager";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { lobbyEventRemaining, type LobbyEventRemaining } from "./lobbyEventModel";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { openRewardPopup } from "./RewardPopup";
import { rewardDtoTexture } from "./rewardDtoIcon";
import { addAttendanceStamp, playAttendanceStamp } from "./attendanceStamp";
import { ATTENDANCE_TONE, attendancePanelLayout, type AttendanceSlotRect } from "./attendanceStyle";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

const TITLE: Readonly<Record<AttendanceTrackDto["id"], TextKey>> = {
  newcomer: "event.attendance.newcomer.title",
  regular: "event.attendance.regular.title",
};

const REMAINING_KEY: Readonly<Record<LobbyEventRemaining["unit"], TextKey>> = {
  days: "event.remaining.days",
  hours: "event.remaining.hours",
  minutes: "event.remaining.minutes",
};

/** 칸 한 장의 결. 값은 이 표에만 있다. */
const SLOT = {
  bevel: 0.14,
  labelSize: 24,
  labelY: 30,
  iconMax: 96,
  iconGap: 10,
  /** 받은 칸을 누르는 어둠과 찍힌 인장의 크기(칸 폭 대비). */
  claimedDim: 0.5,
  stampRatio: 0.62,
  /** 오늘 받을 칸이 숨 쉬는 빛과 배율. */
  pulse: { alpha: 0.5, scale: 1.06, duration: 640 },
  /** 인장이 박힌 뒤 영수증이 뜨기까지. 「쾅」을 한 번 보고 나서 받은 것이 선다. */
  receiptDelayMs: 260,
} as const;

export interface AttendancePopupOptions {
  /** 받은 뒤 바뀐 줄을 알린다 — 이벤트 카드의 빨간 점·진행 마름모가 그 자리에서 바뀐다. */
  onClaimed?: (result: ClaimAttendanceResponse) => void;
  onClosed?: () => void;
}

/**
 * 출석 판 — 일곱 칸이 4 + 3(넓은 일곱째)으로 선다.
 *
 * 받은 칸은 눌린 채 인장이 찍혀 있고, **오늘 받을 칸만 숨 쉰다.** 그 칸을 누르면 서버가 확정한 뒤 인장이
 * 쾅 찍히고 공용 영수증(`RewardPopup`)이 받은 것을 세운다. 신규는 노란빛, 정규는 푸른빛이다.
 */
export function openAttendancePopup(scene: Phaser.Scene, popups: PopupLayer, track: AttendanceTrackDto, options: AttendancePopupOptions = {}): void {
  const tone = ATTENDANCE_TONE[track.id];
  const layout = attendancePanelLayout();
  const now = Date.now();
  popups.open({
    width: layout.width, height: layout.height, title: t(TITLE[track.id]), titleSize: POPUP_TITLE_SIZE.workboard,
    dim: true, closeOnBackdrop: true, backButton: true,
    onClose: () => options.onClosed?.(),
  }, (body) => {
    // 판 바닥이 제 색으로 아래에서 은은하게 물든다.
    const wash = scene.add.graphics();
    wash.fillGradientStyle(tone.deep, tone.deep, tone.deep, tone.deep, 0, 0, 0.32, 0.32);
    wash.fillRect(-layout.width / 2 + 40, -layout.height / 2 + 60, layout.width - 80, layout.height - 100);
    body.add(wash);

    const remaining = track.endsAt ? lobbyEventRemaining(track.endsAt, now) : undefined;
    const header = scene.add.text(0, layout.headerY, `${track.claimed}/${ATTENDANCE_DAYS}${remaining ? `  ·  ${t(REMAINING_KEY[remaining.unit], { value: remaining.value })}` : ""}`, textStyle({ role: "emphasis", size: 30, color: tone.text }))
      .setOrigin(0.5)
      .setStroke(tone.stroke, 6)
      .setShadow(2, 4, "#04060a", 0, true, true);
    body.add(header);

    let busy = false;
    layout.slots.forEach((rect) => {
      const index = rect.day - 1;
      const claimed = index < track.claimed;
      const today = track.claimableToday && index === track.claimed;
      const slot = addSlot(scene, body, rect, track, { claimed, today });
      if (!today) return;
      slot.onTap = () => {
        if (busy) return;
        busy = true;
        void attendanceManager.claim(track.id).then((result) => {
          options.onClaimed?.(result);
          if (!slot.container.active) return;
          slot.stopPulse();
          slot.dim();
          playAttendanceStamp(scene, slot.container, 0, 6, rect.width * SLOT.stampRatio * (rect.day === 7 ? 0.62 : 1), tone.color, {
            onDone: () => scene.time.delayedCall(SLOT.receiptDelayMs, () => {
              const items = result.granted.map((reward) => ({ icon: rewardDtoTexture(reward), amount: reward.amount })).filter(({ icon, amount }) => icon && amount > 0);
              openRewardPopup(scene, popups, { title: t("attendance.reward.title"), items });
            }),
          });
        }).catch(() => { busy = false; });
      };
    });
  });
}

interface SlotHandle {
  container: Phaser.GameObjects.Container;
  onTap?: () => void;
  stopPulse: () => void;
  dim: () => void;
}

/** 한 칸 — 일차 이름표, 받는 것 액자, 받은 칸의 어둠과 인장. */
function addSlot(scene: Phaser.Scene, body: Phaser.GameObjects.Container, rect: AttendanceSlotRect, track: AttendanceTrackDto, state: { claimed: boolean; today: boolean }): SlotHandle {
  const tone = ATTENDANCE_TONE[track.id];
  const container = scene.add.container(rect.x, rect.y);
  body.add(container);
  const unit = Math.min(rect.width, rect.height);
  const shape = chipPoints(rect.width, rect.height, { bevel: { topLeft: unit * SLOT.bevel, topRight: 0, bottomRight: unit * SLOT.bevel, bottomLeft: 0 } });
  const finale = rect.day === ATTENDANCE_DAYS;
  const handle: SlotHandle = { container, stopPulse: () => undefined, dim: () => undefined };

  // 오늘 받을 칸만 바깥으로 빛이 번지며 숨 쉰다.
  if (state.today) {
    const glow = drawLayer(scene, 0, 0, chipPoints(rect.width + 22, rect.height + 22, { bevel: { topLeft: unit * SLOT.bevel + 8, topRight: 0, bottomRight: unit * SLOT.bevel + 8, bottomLeft: 0 } }), { fill: tone.color, alpha: SLOT.pulse.alpha, shadow: false });
    container.add(glow);
    const motion = motionPolicy(session.settings);
    const tweens = motion.nonEssentialRepeatFactor > 0 ? [
      // 배율은 누름 손맛(`pressIn`)이 쓰므로 맥동은 빛과 빛의 크기만 움직인다.
      scene.tweens.add({ targets: glow, alpha: 0.12, scaleX: SLOT.pulse.scale, scaleY: SLOT.pulse.scale, duration: SLOT.pulse.duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }),
    ] : [];
    handle.stopPulse = () => { tweens.forEach((tween) => tween.remove()); glow.destroy(); };
  }
  container.add(drawLayer(scene, 0, 0, shape, {
    fill: tone.fill, alpha: 0.94,
    glow: { color: tone.color, strength: finale ? 0.42 : state.today ? 0.34 : 0.18, height: 0.55 },
    edge: tone.color, edgeAlpha: state.today || finale ? 1 : 0.6, edgeWidth: state.today ? 4 : 3,
  }));

  const label = scene.add.text(0, -rect.height / 2 + SLOT.labelY, t("attendance.day", { day: rect.day }), textStyle({ role: "display", size: SLOT.labelSize, color: state.today || finale ? tone.text : COLOR.ink }))
    .setOrigin(0.5)
    .setShadow(2, 3, "#04060a", 0, true, true);
  squeezeTextToWidth(label, rect.width - 24);
  container.add(label);

  const rewards = track.days[rect.day - 1] ?? [];
  const usable = rect.width - 24;
  const size = Math.min(SLOT.iconMax, (usable - (rewards.length - 1) * SLOT.iconGap) / Math.max(1, rewards.length));
  const span = rewards.length * size + (rewards.length - 1) * SLOT.iconGap;
  rewards.forEach((reward, index) => {
    addFramedIcon(scene, container, -span / 2 + size / 2 + index * (size + SLOT.iconGap), 16, size, rewardDtoTexture(reward), {
      amount: formatCurrency(reward.amount), color: tone.color, plain: state.today,
    });
  });

  const addDim = () => container.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: SLOT.claimedDim, shadow: false }));
  handle.dim = addDim;
  if (state.claimed) {
    addDim();
    container.add(addAttendanceStamp(scene, 0, 6, rect.width * SLOT.stampRatio * (finale ? 0.62 : 1), tone.color));
  }

  if (state.today) {
    const hit = scene.add.rectangle(0, 0, rect.width, rect.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(container));
    hit.on("pointerout", () => pressOut(container, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(container); handle.onTap?.(); });
    handle.stopPulse = ((stop) => () => { stop(); hit.disableInteractive(); })(handle.stopPulse);
    container.add(hit);
  }
  return handle;
}
