import { describe, expect, it } from "vitest";
import { nicknameCreationRequired, nicknameProblem } from "../../src/core/playerCard";

describe("첫 이름 등록 시점", () => {
  it("새 계정은 1-1 전에는 묻지 않고 첫 클리어 후부터 묻는다", () => {
    expect(nicknameCreationRequired({ nickname: "" }, new Set())).toBe(false);
    expect(nicknameCreationRequired({ nickname: "" }, new Set(["1-1"]))).toBe(true);
  });
  it("기존 무명 계정도 묻고 이름이 저장된 계정은 재접속해도 묻지 않는다", () => {
    expect(nicknameCreationRequired({ nickname: "" }, new Set(["2-5"]))).toBe(true);
    expect(nicknameCreationRequired({ nickname: "연구원도디" }, new Set(["1-1"]))).toBe(false);
  });
  it("표시 조건과 같은 최소 2자·최대 12자 및 제어문자 규칙을 사용한다", () => {
    expect(nicknameProblem("가")).toBe("tooShort");
    expect(nicknameProblem("가나")).toBeUndefined();
    expect(nicknameProblem("가".repeat(12))).toBeUndefined();
    expect(nicknameProblem("가".repeat(13))).toBe("tooLong");
    expect(nicknameProblem("이름\u0000")).toBe("invalidCharacter");
  });
});
