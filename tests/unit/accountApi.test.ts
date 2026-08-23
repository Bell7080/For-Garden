import { describe, expect, it } from "vitest";
import { UnsupportedAccountApi } from "../../src/api/AccountApi";

/** SDK 없는 테스트 환경에서도 계정 기능이 성공한 것처럼 보이지 않는지 계약을 고정한다. */
describe("UnsupportedAccountApi", () => {
  it("returns a display-safe guest state without exposing credentials", async () => {
    const result = await new UnsupportedAccountApi().getState();
    expect(result).toEqual({ ok: true, value: { kind: "guest", provider: "guest", maskedId: "GUEST-••••" } });
    expect(JSON.stringify(result)).not.toMatch(/token|secret|credential/i);
  });
  it("reports explicit unsupported results for SDK operations", async () => {
    const api = new UnsupportedAccountApi();
    expect(await api.login({ provider: "google", mergeGuestProgress: true })).toMatchObject({ ok: false, code: "unsupported" });
    expect(await api.getRemoteSaveMetadata()).toMatchObject({ ok: false, code: "unsupported" });
  });
});
