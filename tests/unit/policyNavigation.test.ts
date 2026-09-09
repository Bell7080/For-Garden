import { describe, expect, it, vi } from "vitest";
import { openPolicyDocument, type PolicyWindow } from "../../src/scenes/policyNavigation";

/** 팝업 허용 여부와 관계없이 정책 문서에 도달하는 브라우저 분기를 고정한다. */
describe("정책 문서 이동", () => {
  it("팝업이 허용되면 절대 URL을 보안 옵션과 함께 새 탭으로 연다", () => {
    const open = vi.fn(() => ({}) as Window);
    const assign = vi.fn();
    openPolicyDocument("/terms", { location: { href: "https://garden.example/settings", assign }, open } as PolicyWindow);
    expect(open).toHaveBeenCalledWith("https://garden.example/terms", "_blank", "noopener,noreferrer");
    expect(assign).not.toHaveBeenCalled();
  });

  it("팝업이 차단되면 같은 창의 정책 주소로 이동한다", () => {
    const open = vi.fn(() => null);
    const assign = vi.fn();
    openPolicyDocument("/privacy", { location: { href: "https://garden.example/", assign }, open } as PolicyWindow);
    expect(assign).toHaveBeenCalledWith("https://garden.example/privacy");
  });
});
