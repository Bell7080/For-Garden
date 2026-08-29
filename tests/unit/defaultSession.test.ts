import { describe, expect, it } from "vitest";
import { createDefaultSession } from "../../src/state/session";

describe("신규 계정 기본 렐릭", () => {
  it("루카·도디·메테를 즉시 보유하되 기본 전투 편성은 세 자리만 유지한다", () => {
    const session = createDefaultSession();

    // 보유 상태와 성장 상태가 함께 생겨 저장 검증 및 상세 화면이 서로 어긋나지 않아야 한다.
    expect([...session.owned]).toEqual(["anky", "rex", "spino", "luka", "dodo", "mette"]);
    expect(Object.keys(session.relicProgress)).toEqual([...session.owned]);
    expect(session.party).toEqual(["anky", "rex", "spino"]);
  });
});
