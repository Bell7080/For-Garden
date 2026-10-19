import { describe, expect, it } from "vitest";
import { accountCredentialProblem, accountIdProblem, accountIdToAuthEmail, accountPasswordProblem, authEmailToAccountId, maskAccountId, normalizeAccountId } from "../../src/core/accountCredentials";

describe("아이디·비밀번호 계정 입력 규칙", () => {
  it("아이디는 영문 소문자로 시작하는 4~20자 영문·숫자·_ 이고 대소문자를 구분하지 않는다", () => {
    expect(accountIdProblem("Garden_01")).toBeNull();
    expect(normalizeAccountId("  Garden_01 ")).toBe("garden_01");
    expect(accountIdProblem("abc")).toBe("id-length");
    expect(accountIdProblem("a".repeat(21))).toBe("id-length");
    expect(accountIdProblem("1garden")).toBe("id-chars");
    expect(accountIdProblem("gar den")).toBe("id-chars");
    expect(accountIdProblem("가든가든가든")).toBe("id-chars");
    expect(accountIdProblem("a@b.com")).toBe("id-chars");
  });

  it("비밀번호는 8~64자이고 아이디와 같을 수 없다", () => {
    expect(accountPasswordProblem("12345678")).toBeNull();
    expect(accountPasswordProblem("1234567")).toBe("password-length");
    expect(accountPasswordProblem("x".repeat(65))).toBe("password-length");
    expect(accountPasswordProblem("Garden_01", "garden_01")).toBe("password-same-as-id");
    expect(accountCredentialProblem("garden", "longenough")).toBeNull();
  });

  it("아이디는 메일이 가지 않는 합성 주소로 오가고 소셜 이메일은 아이디로 되돌리지 않는다", () => {
    const email = accountIdToAuthEmail("Garden_01");
    expect(email).toBe("garden_01@id.forgarden.app");
    expect(authEmailToAccountId(email)).toBe("garden_01");
    expect(authEmailToAccountId("someone@gmail.com")).toBeNull();
    expect(authEmailToAccountId(undefined)).toBeNull();
    expect(maskAccountId("garden_01")).toBe("ga••••");
  });
});
