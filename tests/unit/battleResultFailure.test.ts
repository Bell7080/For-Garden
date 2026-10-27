import { describe, expect, it } from "vitest";
import { battleResultFailure } from "../../src/core/battleResultFailure";
describe("전투 종료 진단", () => {
    it("검증 거절과 저장 오류를 구분한다", () => {
        expect(battleResultFailure({ status: 422, code: "rejected", message: "COMBAT_REJECTED" }, "verify")).toEqual({ key: "battle.settle.scoreRejected", reference: "verify:COMBAT_REJECTED", status: 422 });
        expect(battleResultFailure({ code: "PERSISTENCE_FAILED" }, "stage").key).toBe("battle.settle.persistenceFailed");
    });
    it("저장 뒤 표시 실패를 저장 오류로 안내하지 않는다", () => {
        expect(battleResultFailure(Error("renderer stopped"), "display").key).toBe("battle.settle.failed");
    });
    it("임의 서버 원문이나 계정 내용은 진단에 포함하지 않는다", () => {
        const result = battleResultFailure({ status: 500, code: "private-player-data", message: "private-player-data" }, "stage");
        expect(result.reference).toBe("stage:HTTP_500");
        expect(JSON.stringify(result)).not.toContain("private-player-data");
    });
});
