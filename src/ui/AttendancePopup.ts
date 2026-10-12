import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { AttendanceTrackDto, ClaimAttendanceResponse, MailRewardDto } from "../api/contracts";
import { ATTENDANCE_DAYS } from "../core/attendance";
import { formatCurrency } from "../core/formatCurrency";
import { motionPolicy } from "../core/settings";
import { attendanceManager } from "../managers/AttendanceManager";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { UI_ICON } from "./icons";
import { addFramedIcon } from "./itemFrame";
import { lobbyEventRemaining, type LobbyEventRemaining } from "./lobbyEventModel";
import { POPUP_TITLE_SIZE, type PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { openRewardPopup } from "./RewardPopup";
import { rewardDtoName, rewardDtoTexture } from "./rewardDtoIcon";
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
  bevel: 0.12,
  /** 왼쪽 위 일차 이름표. */
  day: { size: 26, inset: 18, padX: 14, height: 40 },
  /** 오른쪽 위 「오늘」 꼬리표. */
  today: { size: 22, inset: 14, padX: 14, height: 34 },
  /** 받는 것 액자(넓은 일곱째는 한 뼘 크다)와 그 아래 이름. */
  icon: 132,
  finaleIcon: 156,
  iconY: 8,
  nameSize: 24,
  nameGap: 22,
  /** 덤 칸 — 왼쪽 광고 표식, 가운데 액자, 오른쪽 이름. */
  ad: { badge: 46, icon: 72, nameSize: 22 },
  /** 받은 칸을 누르는 어둠과 찍힌 인장의 크기(칸 높이 대비). 아직 열리지 않은 덤 칸은 조금 덜 가라앉는다. */
  claimedDim: 0.5,
  lockedDim: 0.42,
  stampRatio: 0.5,
  /** 오늘 받을 칸이 숨 쉬는 빛과 배율. */
  pulse: { alpha: 0.5, scale: 1.05, duration: 640 },
  /** 인장이 박힌 뒤 영수증이 뜨기까지. 「쾅」을 한 번 보고 나서 받은 것이 선다. */
  receiptDelayMs: 260,
} as const;

export interface AttendancePopupOptions {
  /** 받은 뒤 바뀐 줄을 알린다 — 이벤트 카드의 빨간 점·진행 마름모가 그 자리에서 바뀐다. */
  onClaimed?: (result: ClaimAttendanceResponse) => void;
  onClosed?: () => void;
}

type CellState = "claimed" | "today" | "ahead" | "missed";

/**
 * 출석 판 — 일곱 칸이 **3칸 두 줄 + 넓은 일곱째 띠**로 크게 선다. 칸마다 받는 것은 하나다.
 *
 * 받은 칸은 눌린 채 인장이 찍혀 있고, **오늘 받을 칸만 숨 쉰다.** 그 칸을 누르면 서버가 확정한 뒤 인장이
 * 쾅 찍히고 공용 영수증(`RewardPopup`)이 받은 것을 세운다. 정규는 칸마다 아래에 **광고 덤 칸**이 붙어, 그날 칸을
 * 받은 뒤 광고를 한 번 보면 덤을 더 받는다. 신규는 노란빛, 정규는 푸른빛이다.
 *
 * 받은 뒤에는 판을 닫지 않고 **칸만 새 상태로 다시 그린다** — 덤 칸이 그 자리에서 열려야 이어서 누른다.
 */
export function openAttendancePopup(scene: Phaser.Scene, popups: PopupLayer, track: AttendanceTrackDto, options: AttendancePopupOptions = {}): void {
  const tone = ATTENDANCE_TONE[track.id];
  const withAd = Boolean(track.adDays?.length);
  const layout = attendancePanelLayout(withAd);
  let current = track;
  let busy = false;
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

    const header = scene.add.text(0, layout.headerY, "", textStyle({ role: "emphasis", size: 30, color: tone.text }))
      .setOrigin(0.5)
      .setStroke(tone.stroke, 6)
      .setShadow(2, 4, "#04060a", 0, true, true);
    body.add(header);
    // 받지 못했을 때만 머리줄 아래에 한 줄 선다 — 조용히 넘기면 눌렀는데 아무 일도 없는 칸이 된다.
    const notice = scene.add.text(0, layout.headerY + 38, "", textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0.5);
    body.add(notice);
    const grid = scene.add.container(0, 0);
    body.add(grid);

    const paintHeader = (): void => {
      const remaining = current.endsAt ? lobbyEventRemaining(current.endsAt, Date.now()) : undefined;
      header.setText(`${current.claimed}/${ATTENDANCE_DAYS}${remaining ? `  ·  ${t(REMAINING_KEY[remaining.unit], { value: remaining.value })}` : ""}`);
    };

    /** 받은 것을 영수증으로 세운다. 판이 이미 닫혔어도 받은 것은 알린다(장면이 살아 있을 때만). */
    const receipt = (result: ClaimAttendanceResponse, onDone?: () => void): void => {
      if (!scene.sys.isActive()) return;
      const items = result.granted.map((reward) => ({ icon: rewardDtoTexture(reward), amount: reward.amount })).filter(({ icon, amount }) => icon && amount > 0);
      openRewardPopup(scene, popups, { title: t("attendance.reward.title"), items, onConfirm: onDone });
    };

    const claim = (cell: CellHandle, run: () => Promise<ClaimAttendanceResponse | undefined>): void => {
      if (busy) return;
      busy = true;
      notice.setText("");
      void run().then((result) => {
        if (!result) {
          busy = false;
          if (notice.active) notice.setText(t("stamina.adCancelled"));
          return;
        }
        current = result.tracks.find(({ id }) => id === current.id) ?? current;
        options.onClaimed?.(result);
        // 판이 이미 닫혔으면 인장 없이 영수증만 세운다 — 받은 것을 알리지 않으면 받았는지 알 수 없다.
        if (!cell.container.active) { busy = false; receipt(result); return; }
        cell.stopPulse();
        playAttendanceStamp(scene, cell.container, cell.stamp.x, cell.stamp.y, cell.stamp.size, tone.color, {
          onDone: () => scene.time.delayedCall(SLOT.receiptDelayMs, () => receipt(result, () => {
            busy = false;
            if (grid.active) paint();
          })),
        });
      }).catch(() => {
        busy = false;
        if (notice.active) notice.setText(t("attendance.claimFailed"));
      });
    };

    const paint = (): void => {
      grid.removeAll(true);
      paintHeader();
      layout.slots.forEach((rect) => {
        const index = rect.day - 1;
        const mainState: CellState = index < current.claimed ? "claimed" : current.claimableToday && index === current.claimed ? "today" : "ahead";
        const cell = addMainCell(scene, grid, rect, current, mainState);
        if (mainState === "today") cell.onTap = () => claim(cell, () => attendanceManager.claim(current.id));
        const adReward = current.adDays?.[index];
        if (!rect.ad || !adReward) return;
        const adState: CellState = current.adClaimed.includes(rect.day) ? "claimed"
          : current.adClaimableToday && rect.day === current.claimed ? "today"
            : index < current.claimed ? "missed" : "ahead";
        const adCell = addAdCell(scene, grid, rect, current, adReward, adState);
        if (adState === "today") adCell.onTap = () => claim(adCell, () => attendanceManager.claimAd());
      });
    };
    paint();
  });
}

interface CellHandle {
  container: Phaser.GameObjects.Container;
  onTap?: () => void;
  stopPulse: () => void;
  /** 인장이 찍힐 자리(칸 안 좌표)와 크기. */
  stamp: { x: number; y: number; size: number };
}

/** 칸 한 장의 판 · 숨 쉬는 빛 · 받은 칸의 어둠과 인장 · 누르는 면. 안에 무엇을 그릴지는 `content`가 채운다. */
function addCellFrame(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  at: { x: number; y: number; width: number; height: number },
  track: AttendanceTrackDto,
  state: CellState,
  look: { strong: boolean; stamp: { x: number; y: number; size: number } },
  content: (container: Phaser.GameObjects.Container) => void,
): CellHandle {
  const tone = ATTENDANCE_TONE[track.id];
  const { width, height } = at;
  const container = scene.add.container(at.x, at.y);
  parent.add(container);
  const bevel = Math.min(width, height) * SLOT.bevel;
  const shape = chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  const today = state === "today";
  const handle: CellHandle = { container, stopPulse: () => undefined, stamp: look.stamp };

  // 오늘 받을 칸만 바깥으로 빛이 번지며 숨 쉰다.
  if (today) {
    const glow = drawLayer(scene, 0, 0, chipPoints(width + 20, height + 20, { bevel: { topLeft: bevel + 7, topRight: 0, bottomRight: bevel + 7, bottomLeft: 0 } }), { fill: tone.color, alpha: SLOT.pulse.alpha, shadow: false });
    container.add(glow);
    const motion = motionPolicy(session.settings);
    // 배율은 누름 손맛(`pressIn`)이 쓰므로 맥동은 빛과 빛의 크기만 움직인다.
    const tween = motion.nonEssentialRepeatFactor > 0
      ? scene.tweens.add({ targets: glow, alpha: 0.12, scaleX: SLOT.pulse.scale, scaleY: SLOT.pulse.scale, duration: SLOT.pulse.duration, yoyo: true, repeat: -1, ease: "Sine.easeInOut" })
      : undefined;
    handle.stopPulse = () => { tween?.remove(); glow.destroy(); };
  }
  container.add(drawLayer(scene, 0, 0, shape, {
    fill: tone.fill, alpha: 0.94,
    glow: { color: tone.color, strength: look.strong ? 0.42 : today ? 0.34 : 0.18, height: 0.55 },
    edge: tone.color, edgeAlpha: today || look.strong ? 1 : 0.6, edgeWidth: today ? 4 : 3,
  }));
  content(container);

  // 받은 칸·지나간 칸은 눌러 두고, 아직 오지 않은 칸은 조금 덜 가라앉힌다 — 지금 누를 수 없다는 것을 진하기가 말한다.
  if (state === "claimed" || state === "missed") container.add(drawLayer(scene, 0, 0, shape, { fill: 0x000000, alpha: SLOT.claimedDim, shadow: false }));
  if (state === "claimed") container.add(addAttendanceStamp(scene, look.stamp.x, look.stamp.y, look.stamp.size, tone.color));

  if (today) {
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(container));
    hit.on("pointerout", () => pressOut(container, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(container); handle.onTap?.(); });
    handle.stopPulse = ((stop) => () => { stop(); hit.disableInteractive(); })(handle.stopPulse);
    container.add(hit);
  }
  return handle;
}

/** 본 칸 — 왼쪽 위 일차, 가운데 큰 액자, 그 아래 이름. 오늘 칸은 오른쪽 위에 「오늘」 꼬리표가 붙는다. */
function addMainCell(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, rect: AttendanceSlotRect, track: AttendanceTrackDto, state: CellState): CellHandle {
  const tone = ATTENDANCE_TONE[track.id];
  const finale = rect.day === ATTENDANCE_DAYS;
  const width = rect.width;
  const height = rect.main.height;
  const reward = track.days[rect.day - 1];
  const iconSize = finale ? SLOT.finaleIcon : SLOT.icon;
  const lit = finale || state === "today";
  return addCellFrame(scene, parent, { x: rect.x, y: rect.y + rect.main.y, width, height }, track, state, { strong: finale, stamp: { x: 0, y: SLOT.iconY, size: height * SLOT.stampRatio } }, (container) => {
    container.add(addTag(scene, -width / 2 + SLOT.day.inset, -height / 2 + SLOT.day.inset, t("attendance.day", { day: rect.day }), SLOT.day, lit ? tone.color : 0x05070a, lit ? "#05070a" : COLOR.ink, "left"));
    if (state === "today") container.add(addTag(scene, width / 2 - SLOT.today.inset, -height / 2 + SLOT.today.inset, t("attendance.today"), SLOT.today, tone.color, "#05070a", "right"));
    if (!reward) return;
    addFramedIcon(scene, container, 0, SLOT.iconY, iconSize, rewardDtoTexture(reward), { amount: formatCurrency(reward.amount), color: tone.color, plain: true });
    const name = scene.add.text(0, SLOT.iconY + iconSize / 2 + SLOT.nameGap, rewardDtoName(reward), textStyle({ role: "emphasis", size: SLOT.nameSize, color: finale ? tone.text : COLOR.ink }))
      .setOrigin(0.5)
      .setShadow(2, 3, "#04060a", 0, true, true);
    squeezeTextToWidth(name, width - 28);
    container.add(name);
  });
}

/** 덤 칸 — 왼쪽에 광고 표식, 그 옆 액자와 이름. 아직 열리지 않은 칸과 지나간 칸은 가라앉아 있다. */
function addAdCell(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, rect: AttendanceSlotRect, track: AttendanceTrackDto, reward: MailRewardDto, state: CellState): CellHandle {
  const tone = ATTENDANCE_TONE[track.id];
  const ad = rect.ad!;
  const width = rect.width;
  const height = ad.height;
  const left = -width / 2 + 20;
  const iconX = left + SLOT.ad.badge + 16 + SLOT.ad.icon / 2;
  // 인장은 받은 것(액자) 위에 찍힌다 — 칸 끝에 두면 이름 글자를 덮는다.
  const stamp = { x: iconX, y: 0, size: height * 0.62 };
  return addCellFrame(scene, parent, { x: rect.x, y: rect.y + ad.y, width, height }, track, state, { strong: false, stamp }, (container) => {
    container.add(scene.add.image(left + SLOT.ad.badge / 2, 0, UI_ICON.ad).setDisplaySize(SLOT.ad.badge, SLOT.ad.badge).setTint(state === "today" ? tone.color : 0xc9ccd2));
    addFramedIcon(scene, container, iconX, 0, SLOT.ad.icon, rewardDtoTexture(reward), { amount: formatCurrency(reward.amount), color: tone.color, plain: true });
    const nameX = iconX + SLOT.ad.icon / 2 + 12;
    const name = scene.add.text(nameX, 0, rewardDtoName(reward), textStyle({ role: "emphasis", size: SLOT.ad.nameSize, color: COLOR.ink })).setOrigin(0, 0.5);
    squeezeTextToWidth(name, width / 2 - nameX - 16);
    container.add(name);
    if (state === "ahead") {
      const bevel = Math.min(width, height) * SLOT.bevel;
      container.add(drawLayer(scene, 0, 0, chipPoints(width, height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } }), { fill: 0x000000, alpha: SLOT.lockedDim, shadow: false }));
    }
  });
}

/** 칸 모서리의 작은 꼬리표(일차·오늘). 기울인 판 위에 글자 하나. */
function addTag(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  spec: { size: number; padX: number; height: number },
  fill: number,
  color: string,
  anchor: "left" | "right",
): Phaser.GameObjects.Container {
  const tag = scene.add.container(x, y);
  const text = scene.add.text(0, 0, label, textStyle({ role: "display", size: spec.size, color })).setOrigin(0.5);
  const width = text.width + spec.padX * 2;
  const offset = anchor === "left" ? width / 2 : -width / 2;
  tag.add(drawLayer(scene, offset, spec.height / 2, chipPoints(width, spec.height, { bevel: { topLeft: 8, topRight: 0, bottomRight: 8, bottomLeft: 0 } }), { fill, alpha: 0.92, shadow: false }));
  text.setPosition(offset, spec.height / 2);
  tag.add(text);
  return tag;
}
