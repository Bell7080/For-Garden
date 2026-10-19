import { describe, expect, it } from "vitest";
import { ACCOUNT_ID_POPUP, accountIdPopupRows } from "../../src/ui/accountIdPopupLayout";

describe("아이디 계정 창 배치", () => {
  for (const mode of ["both", "link"] as const) {
    it(`${mode}: 줄이 위에서 아래로 쌓이고 모두 판 안에 든다`, () => {
      const r = accountIdPopupRows(mode);
      const ys = [r.idLabelY, r.idFieldY, r.passwordLabelY, r.passwordFieldY, r.confirmLabelY, r.confirmFieldY, r.noteY, r.submitY];
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
      expect(ys[0]).toBeGreaterThan(-r.height / 2);
      expect(r.submitY + ACCOUNT_ID_POPUP.submit.height / 2).toBeLessThan(r.height / 2);
      expect(r.height).toBeLessThan(1400);
    });
  }
  it("설정의 연동에도 로그인·회원가입 탭이 있다", () => {
    expect(accountIdPopupRows("both").tabsY).not.toBeNull();
    expect(accountIdPopupRows("link").tabsY).not.toBeNull();
  });
});
