/** 모든 편성 화면이 공유하는 손가락 판정값이다. */
export const FORMATION_GESTURE = { longPressMs: 360, dragDistance: 12 } as const;

/** Phaser와 무관한 포인터 표본이라 경계값을 빠른 단위 테스트로 고정할 수 있다. */
export interface FormationGestureSample { elapsedMs: number; startX: number; startY: number; x: number; y: number }
export interface FormationSlotBounds { x: number; y: number; width: number; height: number }
export type FormationGestureKind = "tap" | "longTap" | "drag";
export type FormationGestureCancelReason = "outside" | "sceneShutdown" | "ownerClosed" | "secondPointer" | "disabled";
export type FormationGestureResult = { type: "tap" } | { type: "drop"; target: number } | { type: "cancel"; reason: FormationGestureCancelReason };

/** 시간과 이동량만으로 탭·긴 탭·드래그를 가르는 순수 판정 함수다. */
export function classifyFormationGesture(sample: FormationGestureSample): FormationGestureKind {
  const moved = Math.hypot(sample.x - sample.startX, sample.y - sample.startY);
  if (sample.elapsedMs < FORMATION_GESTURE.longPressMs) return "tap";
  return moved >= FORMATION_GESTURE.dragDistance ? "drag" : "longTap";
}

/** 슬롯 사각형은 가장자리까지 드롭으로 인정하며, 겹치면 배열상 앞 슬롯을 택한다. */
export function formationDropSlot(slots: readonly FormationSlotBounds[], x: number, y: number): number | undefined {
  const found = slots.findIndex((slot) => Math.abs(x - slot.x) <= slot.width / 2 && Math.abs(y - slot.y) <= slot.height / 2);
  return found < 0 ? undefined : found;
}

/** 포인터 종료를 배열 변경 명령으로 바꾸기 전의 최종 순수 판정이다. */
export function resolveFormationGesture(sample: FormationGestureSample, target: number | undefined, cancelled?: FormationGestureCancelReason): FormationGestureResult {
  if (cancelled) return { type: "cancel", reason: cancelled };
  if (target === undefined) return { type: "cancel", reason: "outside" };
  const kind = classifyFormationGesture(sample);
  if (kind === "tap") return { type: "tap" };
  if (kind === "drag") return { type: "drop", target };
  return { type: "cancel", reason: "outside" };
}
