import { describe, expect, it } from "vitest";
import { Breadcrumbs, ERROR_REPORT_LIMITS, ReportThrottle, clip, describeError, isNoise, sanitizeContext, scrubText } from "../../src/core/errorReport";

describe("오류 보고 정리", () => {
  it("토큰·이메일·긴 식별자·주소 질의를 지운다", () => {
    expect(scrubText("a eyJabcdefgh.ijklmnopq.rstuv b")).toBe("a [token] b");
    expect(scrubText("mail me@x.com now")).toBe("mail [email] now");
    expect(scrubText("key " + "a".repeat(40))).toBe("key [long]");
    expect(scrubText("GET https://x.io/a/b?token=abc#h ok")).toBe("GET https://x.io/a/b ok");
  });
  it("메시지·스택은 상한으로 자른다", () => {
    expect(clip("ab ".repeat(5000), ERROR_REPORT_LIMITS.message)!.length).toBe(500);
    expect(describeError(new Error("boom")).message).toBe("boom");
    expect(describeError("s").message).toBe("s");
  });
  it("맥락은 평평한 원시값만 남기고 중첩·함수는 버린다", () => {
    expect(sanitizeContext({ a: 1, b: "x", c: true, d: { e: 1 }, f: () => 0, g: NaN })).toEqual({ a: 1, b: "x", c: true });
    const big = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, "v".repeat(100)]));
    expect(JSON.stringify(sanitizeContext(big)).length).toBeLessThanOrEqual(ERROR_REPORT_LIMITS.contextJson);
  });
  it("조작 흔적은 스무 개까지, 상대 시간으로 남긴다", () => {
    let t = 1000;
    const b = new Breadcrumbs(() => t);
    for (let i = 0; i < 30; i += 1) { b.add(`c${i}`); t += 100; }
    const s = b.snapshot();
    expect(s).toHaveLength(20);
    expect(s[0][1]).toBe("c10");
    expect(s[19][0]).toBe(0.1);
  });
  it("같은 오류는 한 번만, 세션 총량과 간격을 지킨다", () => {
    let t = 0;
    const th = new ReportThrottle(() => t);
    expect(th.allow("a")).toBe(true);
    expect(th.allow("b")).toBe(false); // 간격
    t += 2000;
    expect(th.allow("a")).toBe(false); // 중복
    let ok = 0;
    for (let i = 0; i < 100; i += 1) { t += 2000; if (th.allow(`s${i}`)) ok += 1; }
    expect(ok + 1).toBe(ERROR_REPORT_LIMITS.perSession);
  });
  it("무해한 브라우저 잡음은 거른다", () => {
    expect(isNoise("ResizeObserver loop limit exceeded")).toBe(true);
    expect(isNoise("Cannot read properties of null (reading 'x')")).toBe(false);
  });
});
