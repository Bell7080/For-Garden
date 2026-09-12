import { describe, expect, it } from "vitest";
import { latinEcho } from "../../src/ui/latinEcho";

/**
 * 라틴 장식 줄은 이름의 글자를 보고 선다.
 *
 * 언어 코드로 가르면 라틴을 쓰는 언어가 늘 때마다 목록을 고쳐야 하고, 고치기 전까지 그 언어의
 * 버튼에는 같은 낱말이 두 줄로 선다.
 */
describe("라틴 장식 줄", () => {
  it("은 이름이 라틴이 아닐 때만 선다", () => {
    expect(latinEcho("출  격", "SORTIE")).toBe("SORTIE");
    expect(latinEcho("교류", "EXCHANGE")).toBe("EXCHANGE");
    expect(latinEcho("交流", "EXCHANGE")).toBe("EXCHANGE");
  });

  it("은 이름이 이미 라틴이면 서지 않는다", () => {
    // 같은 낱말이 두 줄로 서면 장식이 아니라 실수로 보인다.
    expect(latinEcho("Exchange", "EXCHANGE")).toBeUndefined();
    expect(latinEcho("S O R T I E", "SORTIE")).toBeUndefined();
    // 숫자·문장부호가 섞여도 라틴 한 줄이다.
    expect(latinEcho("Duel (PvP)", "DUEL")).toBeUndefined();
  });
});
