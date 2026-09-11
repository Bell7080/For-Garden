import { describe, expect, it } from "vitest";
import {
  clearFormationSlot,
  formationMembers,
  nextEmptySlot,
  tapFormationSlot,
  tapRosterRelic,
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

describe("목록의 카드를 누름", () => {
  it("아직 어디에도 없는 렐릭은 고른 자리에 선다", () => {
    const result = tapRosterRelic(["rex", null, null], 2, "spino");
    expect(result.formation).toEqual(["rex", null, "spino"]);
    // 채운 뒤에는 남은 빈 칸으로 선택이 옮겨 간다 — 목록만 세 번 눌러 셋을 채울 수 있어야 한다.
    expect(result.selectedSlot).toBe(1);
  });

  it("채운 뒤에는 바로 옆의 빈 칸이 골라진다", () => {
    const result = tapRosterRelic([null, null, null], 0, "rex");
    expect(result.formation).toEqual(["rex", null, null]);
    expect(result.selectedSlot).toBe(1);
  });

  it("빈 칸이 남지 않으면 방금 채운 자리에 머문다", () => {
    // 다 찬 뒤에 오는 손은 대개 방금 세운 렐릭을 바꿔 보려는 손이다.
    const result = tapRosterRelic(["rex", "anky", null], 2, "spino");
    expect(result.formation).toEqual(["rex", "anky", "spino"]);
    expect(result.selectedSlot).toBe(2);
  });

  it("고른 자리에 누가 서 있으면 그대로 갈아 끼운다", () => {
    const result = tapRosterRelic(["rex", "anky", null], 1, "spino");
    expect(result.formation).toEqual(["rex", "spino", null]);
    // 갈아 끼운 뒤에도 남은 빈 칸이 있으면 그리로 넘어간다.
    expect(result.selectedSlot).toBe(2);
  });

  it("이미 어느 칸에 선 렐릭을 누르면 옮기지 않고 그 칸을 고른다", () => {
    // 1번을 고른 채 3번에 선 렐릭을 눌러도 1번으로 끌어오지 않는다. 옮기는 일은 칸을 끌어서 한다.
    const result = tapRosterRelic(["rex", null, "spino"], 0, "spino");
    expect(result.formation).toEqual(["rex", null, "spino"]);
    expect(result.selectedSlot).toBe(2);
  });

  it("범위 밖 선택은 편성을 바꾸지 않는다", () => {
    expect(tapRosterRelic(["rex", null, null], 5, "spino").formation).toEqual(["rex", null, null]);
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

describe("아무 칸도 고르지 않았을 때", () => {
  it("빈 칸이 있으면 그 첫 칸에 세우고 다음 빈 칸을 고른다", () => {
    // 처음 셋을 채우는 동안에는 어느 칸이든 상관없어, 칸을 먼저 누르게 하는 것이 손만 늘린다.
    const result = tapRosterRelic(["rex", null, null], undefined, "spino");
    expect(result.formation).toEqual(["rex", "spino", null]);
    expect(result.selectedSlot).toBe(2);
  });

  it("이미 다 찼으면 아무것도 바꾸지 않는다", () => {
    // 누구를 물릴지는 사람이 정한다. 마지막 칸을 임의로 갈아 끼우면 누르지 않은 자리가 사라진다.
    const result = tapRosterRelic(["rex", "anky", "spino"], undefined, "dodi");
    expect(result.formation).toEqual(["rex", "anky", "spino"]);
    expect(result.selectedSlot).toBeUndefined();
  });

  it("이미 선 렐릭을 누르면 그때도 그 칸을 고른다", () => {
    expect(tapRosterRelic(["rex", null, "spino"], undefined, "spino").selectedSlot).toBe(2);
  });
});

describe("다음 빈 칸", () => {
  it("는 바로 옆부터 찾는다", () => {
    expect(nextEmptySlot(["rex", null, null], 0)).toBe(1);
  });

  it("는 뒤가 차 있으면 한 바퀴 돌아 앞의 빈 칸을 찾는다", () => {
    // 3번을 먼저 채운 손이 1번을 채우러 칸을 다시 누를 이유가 없다.
    expect(nextEmptySlot([null, "anky", "spino"], 2)).toBe(0);
  });

  it("는 빈 칸이 없으면 아무 칸도 고르지 않는다", () => {
    expect(nextEmptySlot(["rex", "anky", "spino"], 1)).toBeUndefined();
  });
});
