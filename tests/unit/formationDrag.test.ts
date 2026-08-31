import { describe, expect, it } from "vitest";
import { FORMATION_GESTURE, classifyFormationGesture, formationDropSlot, resolveFormationGesture } from "../../src/ui/formationGestureRules";

/** Phaser 없이 공용 편성 제스처의 시간·거리·경계 계약을 고정한다. */
describe("formation gesture rules", () => {
  const sample = (elapsedMs: number, x = 0, y = 0) => ({ elapsedMs, startX: 0, startY: 0, x, y });

  it("짧은 입력은 탭으로 판정한다", () => {
    expect(classifyFormationGesture(sample(FORMATION_GESTURE.longPressMs - 1))).toBe("tap");
    expect(resolveFormationGesture(sample(100), 0)).toEqual({ type: "tap" });
  });

  it("오래 누르고 움직이지 않으면 긴 탭이며 변경을 취소한다", () => {
    const held = sample(FORMATION_GESTURE.longPressMs);
    expect(classifyFormationGesture(held)).toBe("longTap");
    expect(resolveFormationGesture(held, 0)).toEqual({ type: "cancel", reason: "outside" });
  });

  it("장기 누름 뒤 기준 거리 이동은 드래그다", () => {
    const dragged = sample(FORMATION_GESTURE.longPressMs, FORMATION_GESTURE.dragDistance);
    expect(classifyFormationGesture(dragged)).toBe("drag");
    expect(resolveFormationGesture(dragged, 2)).toEqual({ type: "drop", target: 2 });
  });

  it("드롭 사각형의 네 경계를 포함하고 바로 바깥은 제외한다", () => {
    const slots = [{ x: 100, y: 100, width: 40, height: 60 }];
    expect(formationDropSlot(slots, 80, 70)).toBe(0);
    expect(formationDropSlot(slots, 120, 130)).toBe(0);
    expect(formationDropSlot(slots, 120.01, 100)).toBeUndefined();
  });

  it.each(["outside", "sceneShutdown", "ownerClosed", "secondPointer"] as const)("%s 취소를 변경 명령보다 우선한다", (reason) => {
    expect(resolveFormationGesture(sample(500, 20), 0, reason)).toEqual({ type: "cancel", reason });
  });
});
