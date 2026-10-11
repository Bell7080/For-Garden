import type { AttendanceTrackId } from "../core/attendance";

/**
 * 출석 두 줄의 결과 자리 — Phaser 없이 읽히는 표다. 이벤트 카드와 출석 판이 같은 값을 읽는다.
 *
 * **신규는 노란빛, 정규는 푸른빛이다.** 신규는 매일 들어오고 싶게 화려하게(둘이 좌우에서 뛰고 보상이 수북이
 * 쌓인다), 정규는 매일 받는 맛만 남기고 정돈된 결이다(혼자 뛰고 보상은 한 줄로 가지런하다).
 */
export const ATTENDANCE_TONE: Readonly<Record<AttendanceTrackId, { color: number; text: string; fill: number; deep: number; stroke: string }>> = {
  newcomer: { color: 0xf2cc4a, text: "#ffe07a", fill: 0x1d170a, deep: 0x6b4a08, stroke: "#2a1a02" },
  regular: { color: 0x6fa8d6, text: "#9fd0f0", fill: 0x0b131c, deep: 0x1d4566, stroke: "#06121e" },
};

/** 카드에 서는 SD — 렐릭 ID와 쪽. 신규는 파루아·도디가 좌우에서, 정규는 토리카 혼자 뛴다. */
export const ATTENDANCE_CAST: Readonly<Record<AttendanceTrackId, readonly { relicId: string; side: "left" | "right" }[]>> = {
  newcomer: [{ relicId: "parua", side: "left" }, { relicId: "dodo", side: "right" }],
  regular: [{ relicId: "torika", side: "left" }],
};

/**
 * 신규 카드 가운데에 수북이 쌓이는 보상 더미 — 뒤에서 앞으로 그린다. 그림은 그 줄의 보상 가운데 중요한
 * 것부터 차례로 채운다(자리 수보다 보상 종류가 적으면 남는 자리는 비운다).
 */
export const ATTENDANCE_PILE: readonly { x: number; y: number; size: number; rotation: number }[] = [
  { x: -96, y: 30, size: 66, rotation: -0.22 },
  { x: 96, y: 30, size: 66, rotation: 0.22 },
  { x: 0, y: 12, size: 84, rotation: 0 },
  { x: -50, y: 50, size: 74, rotation: -0.1 },
  { x: 50, y: 50, size: 74, rotation: 0.12 },
];

/** 더미 둘레에서 깜빡이는 네 갈래 반짝임 자리(더미 중심 기준). 난수 없이 번호에서 박자를 정한다. */
export const ATTENDANCE_SPARKLES: readonly { x: number; y: number; size: number }[] = [
  { x: -128, y: -8, size: 16 }, { x: 132, y: 4, size: 14 }, { x: -60, y: -24, size: 12 }, { x: 70, y: -20, size: 18 }, { x: 0, y: 84, size: 12 },
];

/** 출석 판 안 일곱 칸의 자리. 4칸 + (2칸 + 넓은 일곱째 칸)으로 두 줄을 같은 폭으로 채운다. */
export interface AttendanceSlotRect { day: number; x: number; y: number; width: number; height: number }

export const ATTENDANCE_PANEL = {
  width: 940,
  /** 제목표 아래 머리줄(남은 기간·진행 마름모)의 높이. */
  header: 150,
  slot: { width: 190, height: 236, gap: 20, rowGap: 26 },
  bottomPad: 72,
} as const;

/** 판 높이와 일곱 칸의 자리(판 가운데가 0). */
export function attendancePanelLayout(): { width: number; height: number; headerY: number; slots: AttendanceSlotRect[] } {
  const { width, header, slot, bottomPad } = ATTENDANCE_PANEL;
  const height = header + slot.height * 2 + slot.rowGap + bottomPad;
  const rowWidth = slot.width * 4 + slot.gap * 3;
  const left = -rowWidth / 2;
  const top = -height / 2 + header;
  const slots: AttendanceSlotRect[] = [];
  for (let index = 0; index < 4; index += 1) {
    slots.push({ day: index + 1, x: left + slot.width / 2 + index * (slot.width + slot.gap), y: top + slot.height / 2, width: slot.width, height: slot.height });
  }
  const secondY = top + slot.height + slot.rowGap + slot.height / 2;
  for (let index = 0; index < 2; index += 1) {
    slots.push({ day: index + 5, x: left + slot.width / 2 + index * (slot.width + slot.gap), y: secondY, width: slot.width, height: slot.height });
  }
  const wide = slot.width * 2 + slot.gap;
  slots.push({ day: 7, x: left + (slot.width + slot.gap) * 2 + wide / 2, y: secondY, width: wide, height: slot.height });
  return { width, height, headerY: -height / 2 + header / 2 + 18, slots };
}
