import { describe, expect, it } from "vitest";
import {
  clearFormationSlot,
  formationMembers,
  nextFormationSlot,
  placeFormationRelic,
  tapFormationSlot,
  toFormationSlots,
} from "../../src/core/formationSlots";

describe("자리를 비우기", () => {
  it("뒤 자리를 당기지 않는다", () => {
    // 2번을 비워도 3번은 3번에 그대로 선다 — 손대지 않은 자리가 저 혼자 움직이지 않는다.
    expect(clearFormationSlot(["rex", "anky", "spino"], 1)).toEqual(["rex", null, "spino"]);
  });

  it("범위 밖 인덱스는 아무것도 바꾸지 않는다", () => {
    const formation = ["rex", null, null];
    expect(clearFormationSlot(formation, 3)).toEqual(formation);
    expect(clearFormationSlot(formation, -1)).toEqual(formation);
    expect(clearFormationSlot(formation, 1.5)).toEqual(formation);
  });

  it("호출자의 배열을 건드리지 않는다", () => {
    const formation = ["rex", "anky", null];
    clearFormationSlot(formation, 0);
    expect(formation).toEqual(["rex", "anky", null]);
  });
});

describe("고른 자리에 세우기", () => {
  it("빈 자리로 옮기며 중복을 만들지 않는다", () => {
    expect(placeFormationRelic(["rex", null, "spino"], 1, "rex")).toEqual([null, "rex", "spino"]);
  });

  it("차 있는 자리로 옮기면 두 자리를 맞바꾼다", () => {
    expect(placeFormationRelic(["rex", "anky", null], 1, "rex")).toEqual(["anky", "rex", null]);
  });

  it("같은 자리의 렐릭을 다시 누르면 그 자리를 비운다", () => {
    expect(placeFormationRelic(["rex", "anky", null], 0, "rex")).toEqual([null, "anky", null]);
  });

  it("어느 자리에도 없던 렐릭은 고른 자리를 그대로 차지한다", () => {
    expect(placeFormationRelic(["rex", null, null], 2, "spino")).toEqual(["rex", null, "spino"]);
  });
});

describe("배치 뒤 다음 자리", () => {
  it("바로 뒤의 빈 자리로 이어진다", () => {
    expect(nextFormationSlot(["anky", null, null], 0)).toBe(1);
    expect(nextFormationSlot(["anky", "rex", null], 1)).toBe(2);
  });

  it("뒤가 차 있으면 앞쪽 빈 자리로 돌아온다", () => {
    expect(nextFormationSlot([null, "rex", "spino"], 2)).toBe(0);
    expect(nextFormationSlot(["anky", null, "spino"], 2)).toBe(1);
  });

  it("모두 차면 다음 자리에 그대로 머문다", () => {
    expect(nextFormationSlot(["anky", "rex", "spino"], 0)).toBe(1);
    expect(nextFormationSlot(["anky", "rex", "spino"], 2)).toBe(0);
  });
});

describe("자리를 누름", () => {
  it("고르지 않은 자리를 누르면 고르기만 하고 캐릭터는 그대로 선다", () => {
    const result = tapFormationSlot(["rex", "anky", "spino"], 1, 0);
    expect(result.formation).toEqual(["rex", "anky", "spino"]);
    expect(result.selectedSlot).toBe(1);
    expect(result.cleared).toBe(false);
  });

  it("이미 고른 자리를 한 번 더 누르면 그 자리만 비운다", () => {
    const result = tapFormationSlot(["rex", "anky", "spino"], 1, 1);
    expect(result.formation).toEqual(["rex", null, "spino"]);
    expect(result.selectedSlot).toBe(1);
    expect(result.cleared).toBe(true);
  });

  it("`−`는 고르지 않은 자리에서도 곧바로 비운다", () => {
    const result = tapFormationSlot(["rex", "anky", "spino"], 2, 0, "clear");
    expect(result.formation).toEqual(["rex", "anky", null]);
    expect(result.selectedSlot).toBe(2);
  });

  it("빈 자리는 몇 번을 눌러도 고르기만 한다", () => {
    const result = tapFormationSlot(["rex", null, "spino"], 1, 1);
    expect(result.formation).toEqual(["rex", null, "spino"]);
    expect(result.cleared).toBe(false);
  });
});

describe("편성원과 고정 길이", () => {
  it("빈 자리를 뺀 실제 편성원만 센다", () => {
    expect(formationMembers(["rex", null, "spino"])).toEqual(["rex", "spino"]);
  });

  it("모자라면 빈 자리로 채우고 넘치면 자른다", () => {
    expect(toFormationSlots(["rex"], 3)).toEqual(["rex", null, null]);
    expect(toFormationSlots(["rex", "anky", "spino", "dodi"], 3)).toEqual(["rex", "anky", "spino"]);
  });
});
