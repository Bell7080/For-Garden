import { describe, expect, it } from "vitest";
import { FORMATION_DRAG_VISUAL, formationDragPreview, formationZoneStyle } from "../../src/ui/formationDragVisual";
import { canStandInSlot, duoSlotIndex, settleFormationSlots } from "../../src/core/formation";
import { getRelic } from "../../src/data/relics";
import { moveFormationSlot } from "../../src/core/formation";

const PICKED = ["anky", "rex", "dodo"];

describe("편성 드래그 미리보기", () => {
  it("든 자리는 손에 들려 있고 나머지는 제자리다", () => {
    const preview = formationDragPreview(PICKED, 0, undefined, 3);
    expect(preview[0]).toEqual({ relicId: "anky", lifted: true, moved: false });
    expect(preview[1]).toEqual({ relicId: "rex", lifted: false, moved: false });
    expect(preview[2]).toEqual({ relicId: "dodo", lifted: false, moved: false });
  });

  it("가리킨 자리의 캐릭터가 든 자리로 미리 옮겨 온다", () => {
    const preview = formationDragPreview(PICKED, 0, 2, 3);
    expect(preview[0]).toMatchObject({ relicId: "dodo", lifted: true });
    expect(preview[2]).toMatchObject({ relicId: "anky", moved: true });
    // 관련 없는 자리는 흔들리지 않는다.
    expect(preview[1]).toEqual({ relicId: "rex", lifted: false, moved: false });
  });

  it("미리보기는 확정 규칙을 그대로 통과시킨다", () => {
    // 보여 준 것과 놓은 결과가 갈리면 미리보기가 거짓말이 된다.
    for (const to of [0, 1, 2]) {
      const preview = formationDragPreview(PICKED, 1, to, 3);
      expect(preview.map((entry) => entry.relicId)).toEqual(moveFormationSlot(PICKED, 1, to));
    }
  });

  it("자기 자리를 다시 가리키면 아무것도 옮기지 않는다", () => {
    const preview = formationDragPreview(PICKED, 1, 1, 3);
    expect(preview.map((entry) => entry.relicId)).toEqual(PICKED);
    expect(preview.filter((entry) => entry.moved)).toEqual([]);
  });

  it("빈 자리와 자리를 바꾸면 든 자리가 비는 것까지 보여 준다", () => {
    const preview = formationDragPreview(["anky", undefined, "dodo"], 0, 1, 3);
    expect(preview[0].relicId).toBeUndefined();
    expect(preview[1]).toMatchObject({ relicId: "anky", moved: true });
  });
});

describe("놓을 자리 칸", () => {
  it("가리킨 칸이 나머지보다 진하고 크다", () => {
    const idle = formationZoneStyle(false);
    const hovered = formationZoneStyle(true);
    expect(hovered.fillAlpha).toBeGreaterThan(idle.fillAlpha);
    expect(hovered.lineAlpha).toBeGreaterThan(idle.lineAlpha);
    expect(hovered.lineWidth).toBeGreaterThan(idle.lineWidth);
    expect(hovered.scale).toBeGreaterThan(idle.scale);
  });

  it("평소 칸도 배경이 비칠 만큼만 채운다", () => {
    // 끄는 동안 계속 떠 있는 칸이라 진하면 판이 세 조각으로 갈라져 보인다.
    expect(formationZoneStyle(false).fillAlpha).toBeLessThanOrEqual(0.2);
    expect(formationZoneStyle(true).fillAlpha).toBeLessThanOrEqual(0.4);
  });

  it("든 캐릭터는 커지고 미리 옮겨 온 캐릭터는 비쳐 보인다", () => {
    expect(FORMATION_DRAG_VISUAL.liftScale).toBeGreaterThan(1);
    expect(FORMATION_DRAG_VISUAL.previewAlpha).toBeLessThan(1);
    expect(FORMATION_DRAG_VISUAL.liftAlpha).toBeGreaterThan(FORMATION_DRAG_VISUAL.previewAlpha);
    expect(FORMATION_DRAG_VISUAL.boardDimAlpha).toBeGreaterThan(0);
    expect(FORMATION_DRAG_VISUAL.boardDimAlpha).toBeLessThan(1);
  });
});

describe("자리 제약", () => {
  /** 슈테만 가운데에 설 수 없다. 확정과 미리보기가 같은 규칙을 지나는지 함께 본다. */
  const allows = (relicId: string | undefined, index: number): boolean =>
    canStandInSlot(relicId === undefined ? undefined : getRelic(relicId), index, 3);

  it("는 3인 편성의 가운데를 듀오 자리로 본다", () => {
    expect(duoSlotIndex(3)).toBe(1);
  });

  it("는 슈테를 가운데에 세우지 못하게 하고 다른 개체는 막지 않는다", () => {
    expect(canStandInSlot(getRelic("shute"), 1, 3)).toBe(false);
    expect(canStandInSlot(getRelic("shute"), 0, 3)).toBe(true);
    expect(canStandInSlot(getRelic("shute"), 2, 3)).toBe(true);
    expect(canStandInSlot(getRelic("rex"), 1, 3)).toBe(true);
  });

  it("는 슈테를 가운데로 끌어다 놓는 교환을 통째로 되돌린다", () => {
    const picked = ["shute", "rex", "dodo"];
    expect(moveFormationSlot(picked, 0, 1, allows)).toEqual(picked);
    // 제약과 무관한 교환은 그대로 이뤄진다.
    expect(moveFormationSlot(picked, 1, 2, allows)).toEqual(["shute", "dodo", "rex"]);
  });

  it("는 고르는 순서 때문에 가운데에 놓인 슈테를 옆자리로 밀어 낸다", () => {
    expect(settleFormationSlots(["rex", "shute", "dodo"], allows)).toEqual(["shute", "rex", "dodo"]);
    // 이미 설 수 있는 편성은 손대지 않는다.
    expect(settleFormationSlots(["shute", "rex", "dodo"], allows)).toEqual(["shute", "rex", "dodo"]);
  });

  it("는 미리보기도 같은 규칙을 지나 보여 준 것과 놓은 결과가 갈리지 않는다", () => {
    const preview = formationDragPreview(["shute", "rex", "dodo"], 0, 1, 3, allows);
    // 되돌려진 교환이므로 옮겨 온 칸이 하나도 없다.
    expect(preview.some((entry) => entry.moved)).toBe(false);
  });
});
