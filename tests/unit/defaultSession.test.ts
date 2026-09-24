import { describe, expect, it } from "vitest";
import { createDefaultSession, isStageUnlocked, replaceSession } from "../../src/state/session";

describe("신규 계정 기본 렐릭", () => {
  it("오프닝의 쁘띠 로그 셋(토리카·도디·파루아)으로 기본 편성을 세운다", () => {
    const session = createDefaultSession();

    // 보유 상태와 성장 상태가 함께 생겨 저장 검증 및 상세 화면이 서로 어긋나지 않아야 한다.
    expect([...session.owned]).toEqual(["anky", "rex", "spino", "luka", "dodo", "mette", "parua"]);
    expect(Object.keys(session.relicProgress)).toEqual([...session.owned]);
    // 오프닝이 곧장 1-1로 이어지므로, 대본에서 공멸 삼인조와 맞선 셋이 그대로 전장에 선다.
    // 자리는 자동 편성과 같은 직군 규칙이다 — 가운데 탱커, 왼쪽 암살자, 오른쪽 지원가.
    expect(session.party).toEqual(["parua", "anky", "dodo"]);
    // 편성은 보유한 개체만 세울 수 있다.
    for (const id of session.party) expect(session.owned.has(id)).toBe(true);
  });

  it("공유 세션에서도 챕터 끝 클리어만 다음 챕터를 열고 알 수 없는 ID는 거부한다", () => {
    const state = createDefaultSession();
    replaceSession(state);
    expect(isStageUnlocked("1-1")).toBe(true);
    expect(isStageUnlocked("2-1")).toBe(false);
    state.cleared.add("1-10");
    expect(isStageUnlocked("2-1")).toBe(true);
    expect(isStageUnlocked("3-1")).toBe(false);
    state.cleared.add("2-10");
    expect(isStageUnlocked("3-1")).toBe(true);
    expect(isStageUnlocked("missing-stage")).toBe(false);
  });
});
