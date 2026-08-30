import { describe, expect, it } from "vitest";
import { createDefaultSession, isStageUnlocked, replaceSession } from "../../src/state/session";

describe("신규 계정 기본 렐릭", () => {
  it("루카·도디·메테를 즉시 보유하되 기본 전투 편성은 세 자리만 유지한다", () => {
    const session = createDefaultSession();

    // 보유 상태와 성장 상태가 함께 생겨 저장 검증 및 상세 화면이 서로 어긋나지 않아야 한다.
    expect([...session.owned]).toEqual(["anky", "rex", "spino", "luka", "dodo", "mette"]);
    expect(Object.keys(session.relicProgress)).toEqual([...session.owned]);
    expect(session.party).toEqual(["anky", "rex", "spino"]);
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
