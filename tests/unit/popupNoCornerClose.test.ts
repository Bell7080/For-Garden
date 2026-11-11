import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as geometry from "../../src/ui/popupGeometry";

/**
 * 팝업 오른쪽 위 X는 결코 쓰지 않는다(응태 결정, 2026-11-11). 닫는 길은 판 밖 우하단의 공용
 * 뒤로가기와 판 밖 누르기 둘뿐이다. 소스 모양으로 지킨다 — 화면에만 보이는 규칙이라 값으로 남지 않는다.
 */
describe("팝업 닫기 규칙", () => {
  const source = readFileSync("src/ui/PopupLayer.ts", "utf8");

  it("모서리 X 배치표가 다시 생기지 않는다", () => {
    expect("POPUP_CLOSE_LAYOUT" in geometry).toBe(false);
    expect(source).not.toContain("POPUP_CLOSE_LAYOUT");
    expect(source).not.toMatch(/closeButton\s*=/);
  });

  it("제목이 있는 판은 따로 말하지 않아도 판 밖 우하단 뒤로가기를 단다", () => {
    expect(source).toMatch(/options\.backButton \?\? \(Boolean\(options\.title\) && !options\.hideCloseButton\)/);
    expect(source).toContain("new IconButton(this.scene, BACK_SLOT.x, BACK_SLOT.y");
  });

  it("판 밖 누르기가 기본으로 닫는다", () => {
    expect(source).toContain("options.closeOnBackdrop !== false");
  });
});
