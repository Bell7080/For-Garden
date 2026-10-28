/**
 * 쿠폰 등록. DB 함수(`redeem_coupon`)를 로그인한 계정으로 부르고, 서버에 연결되지 않은 빌드는 `unsupported`를
 * 돌려준다(등록된 척하지 않는다). 코드 검증·기간·계정당 1회·실패 제한은 서버가 하고, 보상은 그 계정의
 * 우편함으로 간다 — 화면은 지갑을 바꾸지 않는다.
 *
 * 홈페이지 쿠폰 페이지로 넘어갈 때는 짧게 사는 연결 티켓(`create_coupon_ticket`)을 받아 주소에 싣는다.
 * 홈페이지는 그 티켓으로 이 계정의 UID·닉네임을 보여 주고 코드만 받는다.
 */
import type { RpcCaller } from "./SupportApi";

export type CouponError =
  | "unsupported" | "network" | "no_player" | "account_restricted" | "rate_limited"
  | "invalid_code" | "unavailable" | "already_redeemed" | "already_used" | "exhausted";

export type CouponResult<T> = { ok: true; value: T } | { ok: false; error: CouponError };

export interface CouponReward { asset: string; amount: number; }

const KNOWN: ReadonlySet<string> = new Set(["no_player", "account_restricted", "rate_limited", "invalid_code", "unavailable", "already_redeemed", "already_used", "exhausted"]);

/** 서버와 같은 정규화 — 영숫자만 남겨 대문자로. 화면이 붙임표를 넣어 보여 줘도 같은 코드다. */
export function normalizeCouponCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** 서버가 받는 길이(4~32자) 안인가. 그 밖은 요청을 보내지 않는다 — 보내면 실패 횟수만 쌓인다. */
export function couponCodeReady(raw: string): boolean {
  const length = normalizeCouponCode(raw).length;
  return length >= 4 && length <= 32;
}

export class CouponApi {
  constructor(private readonly rpc: RpcCaller | null) {}

  private async call(name: string, args: Record<string, unknown>): Promise<CouponResult<Record<string, unknown>>> {
    if (!this.rpc) return { ok: false, error: "unsupported" };
    const r = await this.rpc.callRpc(name, args);
    if (!r.ok) return { ok: false, error: r.code === "unsupported" ? "unsupported" : "network" };
    const body = (r.value ?? {}) as Record<string, unknown>;
    if (body.ok !== true) return { ok: false, error: KNOWN.has(String(body.error)) ? (body.error as CouponError) : "network" };
    return { ok: true, value: body };
  }

  async redeem(code: string): Promise<CouponResult<{ name: string; rewards: CouponReward[] }>> {
    const r = await this.call("redeem_coupon", { p_code: normalizeCouponCode(code) });
    if (!r.ok) return r;
    const rewards = Array.isArray(r.value.rewards) ? (r.value.rewards as Array<Record<string, unknown>>) : [];
    return { ok: true, value: {
      name: String(r.value.name ?? ""),
      rewards: rewards.map((item) => ({ asset: String(item.asset), amount: Number(item.amount) })).filter((item) => Number.isFinite(item.amount)),
    } };
  }

  /** 홈페이지 쿠폰 페이지용 연결 티켓. 15분 동안만 산다. */
  async createWebTicket(): Promise<CouponResult<string>> {
    const r = await this.call("create_coupon_ticket", {});
    if (!r.ok) return r;
    return typeof r.value.ticket === "string" ? { ok: true, value: r.value.ticket } : { ok: false, error: "network" };
  }
}
