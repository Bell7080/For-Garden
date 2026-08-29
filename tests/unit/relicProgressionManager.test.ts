import { describe, expect, it } from "vitest";
import { RelicProgressionManager } from "../../src/managers/RelicProgressionManager";
import { createDefaultSession } from "../../src/state/session";

/** 도감의 미보유 렐릭 미리보기가 저장 대상 성장 레코드를 만들지 않는지 회귀 검증한다. */
describe("RelicProgressionManager", () => {
  it("미보유 렐릭의 성장 정보를 읽어도 세션을 변경하지 않는다", () => {
    const state = createDefaultSession();
    const manager = new RelicProgressionManager(state);

    // 도디 기본 해금 이후에도 잠긴 스밀로를 사용해 미보유 조회 계약을 계속 검증한다.
    expect(state.owned.has("smilo")).toBe(false);
    expect(manager.getProgress("smilo")).toMatchObject({ level: 1, breakthrough: 0 });
    expect(state.relicProgress).not.toHaveProperty("smilo");
  });

  it("미보유 렐릭의 성장 상태 변경을 거부한다", () => {
    const manager = new RelicProgressionManager(createDefaultSession());

    // 조회용 기본값이 변경 경로로 새어 들어가 저장 불변식을 깨지 못하게 한다.
    expect(() => manager.setLevel("smilo", 2)).toThrow("보유하지 않은 렐릭");
  });
});
