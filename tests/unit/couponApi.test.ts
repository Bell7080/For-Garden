import { describe, expect, it, vi } from "vitest";
import { CouponApi, couponCodeReady, normalizeCouponCode } from "../../src/api/CouponApi";
import type { AccountResult } from "../../src/api/AccountApi";

const caller = (value: AccountResult<unknown>) => ({ callRpc: vi.fn(async () => value) });

describe("쿠폰 등록 경계", () => {
  it("서버와 같은 규칙으로 코드를 정규화하고 길이 밖은 보내지 않는다", () => {
    expect(normalizeCouponCode(" ab12-cd34-ef56 ")).toBe("AB12CD34EF56");
    expect(couponCodeReady("ab-c")).toBe(false);
    expect(couponCodeReady("abcd")).toBe(true);
    expect(couponCodeReady("A".repeat(33))).toBe(false);
  });

  it("서버에 연결되지 않은 빌드는 등록된 척하지 않는다", async () => {
    expect(await new CouponApi(null).redeem("HELLO2026")).toEqual({ ok: false, error: "unsupported" });
    expect(await new CouponApi(null).createWebTicket()).toEqual({ ok: false, error: "unsupported" });
  });

  it("정규화한 코드로 redeem_coupon을 부르고 보상 목록을 돌려준다", async () => {
    const rpc = caller({ ok: true, value: { ok: true, name: "출시 기념", rewards: [{ asset: "gems", amount: 300 }] } });
    const result = await new CouponApi(rpc).redeem("hello-2026");
    expect(rpc.callRpc).toHaveBeenCalledWith("redeem_coupon", { p_code: "HELLO2026" });
    expect(result).toEqual({ ok: true, value: { name: "출시 기념", rewards: [{ asset: "gems", amount: 300 }] } });
  });

  it("서버 오류 코드는 알려진 것만 그대로, 나머지는 연결 실패로 접는다", async () => {
    expect(await new CouponApi(caller({ ok: true, value: { ok: false, error: "already_redeemed" } })).redeem("HELLO2026"))
      .toEqual({ ok: false, error: "already_redeemed" });
    expect(await new CouponApi(caller({ ok: true, value: { ok: false, error: "weird" } })).redeem("HELLO2026"))
      .toEqual({ ok: false, error: "network" });
  });

  it("홈페이지 연결 티켓을 받는다", async () => {
    const rpc = caller({ ok: true, value: { ok: true, ticket: "abc123", expires_at: "2026-10-27T10:00:00Z" } });
    expect(await new CouponApi(rpc).createWebTicket()).toEqual({ ok: true, value: "abc123" });
    expect(rpc.callRpc).toHaveBeenCalledWith("create_coupon_ticket", {});
  });
});
