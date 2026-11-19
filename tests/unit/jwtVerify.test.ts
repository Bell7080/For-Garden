import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetJwksCache, verifyAccessToken } from "../../src/server/jwtVerify";

const URL = "https://proj.supabase.co";

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let binary = "";
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function setup() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1", alg: "ES256" };
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }))) as unknown as typeof fetch;
  const sign = async (payload: Record<string, unknown>, header: Record<string, unknown> = { alg: "ES256", kid: "k1", typ: "JWT" }) => {
    const head = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(head)));
    return `${head}.${b64url(sig)}`;
  };
  return { fetcher, sign };
}

const now = 1_800_000_000;
const claims = { sub: "player-1", role: "authenticated", aud: "authenticated", iss: `${URL}/auth/v1`, exp: now + 3600 };

describe("로그인 토큰 서버 안 확인", () => {
  beforeEach(() => resetJwksCache());

  it("서명·만료·발급자가 맞으면 사용자 id를 돌려주고 키는 한 번만 받는다", async () => {
    const { fetcher, sign } = await setup();
    const token = await sign(claims);
    expect(await verifyAccessToken(URL, token, { fetcher, nowSeconds: now })).toEqual({ id: "player-1" });
    expect(await verifyAccessToken(`${URL}/`, token, { fetcher, nowSeconds: now })).toEqual({ id: "player-1" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("만료됐거나 서명이 틀린 토큰은 거절한다", async () => {
    const { fetcher, sign } = await setup();
    expect(await verifyAccessToken(URL, await sign({ ...claims, exp: now - 120 }), { fetcher, nowSeconds: now })).toBeNull();
    const token = await sign(claims);
    const forged = token.split(".");
    forged[1] = b64url(JSON.stringify({ ...claims, sub: "someone-else" }));
    expect(await verifyAccessToken(URL, forged.join("."), { fetcher, nowSeconds: now })).toBeNull();
  });

  it("판단할 수 없는 토큰은 예전 왕복으로 넘긴다", async () => {
    const { fetcher, sign } = await setup();
    expect(await verifyAccessToken(URL, "test-token", { fetcher, nowSeconds: now })).toBeUndefined();
    expect(await verifyAccessToken(URL, await sign(claims, { alg: "HS256", typ: "JWT" }), { fetcher, nowSeconds: now })).toBeUndefined();
    expect(await verifyAccessToken(URL, await sign(claims, { alg: "ES256", kid: "unknown" }), { fetcher, nowSeconds: now })).toBeUndefined();
    expect(await verifyAccessToken(URL, await sign({ ...claims, iss: "https://other/auth/v1" }), { fetcher, nowSeconds: now })).toBeUndefined();
    const failing = vi.fn(async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    resetJwksCache();
    expect(await verifyAccessToken(URL, await sign(claims), { fetcher: failing, nowSeconds: now })).toBeUndefined();
  });
});
