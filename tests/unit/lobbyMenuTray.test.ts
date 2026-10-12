import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/ui/LobbyMenuTray.ts", "utf8");

describe("로비 메뉴 판", () => {
  it("칩을 눌러도 판을 접지 않는다", () => {
    expect(source).toMatch(/onClick: \(\) => item\.onClick\(\)/);
    expect(source).not.toMatch(/this\.close\(\);\s*item\.onClick/);
  });

  it("창이 떠 있는 동안과 창을 닫는 누름에는 판 밖 누르기로 접히지 않는다", () => {
    expect(source).toContain("pressedOverPopup");
    expect(source).toMatch(/this\.pressedOverPopup \|\| this\.isPopupOpen\(\)/);
  });
});
