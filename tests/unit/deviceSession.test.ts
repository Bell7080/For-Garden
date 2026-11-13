import { afterEach, describe, expect, it } from "vitest";
import {
  checkDeviceSession, claimDeviceSession, currentDeviceSessionId, deviceSessionField, isSessionReplaced,
  noteDeviceSessionResponse, onSessionReplaced, resetDeviceSession, DEVICE_SESSION_PATTERN,
} from "../../src/api/deviceSession";
import { createRemoteGameApi } from "../../src/api/RemoteGameApi";
import { createSupabaseStore } from "../../src/server/supabaseStore";
import { isReadMethod } from "../../src/server/requestPolicy";
import { saveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

const STATE = saveManager.exportData(createDefaultSession());

/** 서버 한 대를 흉내 낸다 — 계정의 지금 기기를 기억하고, 표식이 다르면 409 session_replaced로 거절한다. */
function fakeServer(options: { knowsClaim?: boolean } = {}) {
  let active: string | null = null;
  const bodies: Record<string, unknown>[] = [];
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    bodies.push(body);
    if (body.method === "session.claim") {
      if (options.knowsClaim === false) return new Response(JSON.stringify({ ok: false, code: "unknown_method" }), { status: 400 });
      active = body.device as string;
      return new Response(JSON.stringify({ ok: true, result: null }), { status: 200 });
    }
    if (typeof body.device === "string" && active && body.device !== active) return new Response(JSON.stringify({ ok: false, code: "session_replaced" }), { status: 409 });
    return new Response(JSON.stringify({ ok: true, result: null, state: STATE, revision: "1" }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies, steal: () => { active = "f".repeat(32); } };
}

afterEach(() => resetDeviceSession());

describe("다기기 동시 실행 차단", () => {
  it("표식은 서버가 받는 모양이고, 세우기 전에는 호출에 싣지 않는다", () => {
    expect(currentDeviceSessionId()).toMatch(DEVICE_SESSION_PATTERN);
    expect(deviceSessionField()).toEqual({});
  });

  it("세운 뒤에는 모든 게임 호출이 표식을 싣는다", async () => {
    const server = fakeServer();
    expect(await claimDeviceSession("t", "/api/game", server.fetchImpl)).toBe(true);
    const api = createRemoteGameApi({ getAccessToken: async () => "t", applyState: () => undefined, fetchImpl: server.fetchImpl, endpoint: "/api/game" });
    await api.getPlayerState();
    expect(server.bodies.at(-1)?.device).toBe(currentDeviceSessionId());
  });

  it("다른 기기가 접속하면 다음 호출이 거절되고 신호는 한 번만 간다", async () => {
    const server = fakeServer();
    await claimDeviceSession("t", "/api/game", server.fetchImpl);
    let signals = 0;
    const off = onSessionReplaced(() => { signals += 1; });
    const api = createRemoteGameApi({ getAccessToken: async () => "t", applyState: () => undefined, fetchImpl: server.fetchImpl, endpoint: "/api/game" });
    server.steal();
    await expect(api.getPlayerState()).rejects.toMatchObject({ status: 409, code: "session_replaced" });
    await checkDeviceSession("t", "/api/game", server.fetchImpl);
    expect(signals).toBe(1);
    expect(isSessionReplaced()).toBe(true);
    off();
  });

  it("호출이 없는 동안의 확인도 밀려난 것을 알아차린다", async () => {
    const server = fakeServer();
    await claimDeviceSession("t", "/api/game", server.fetchImpl);
    let signals = 0;
    const off = onSessionReplaced(() => { signals += 1; });
    await checkDeviceSession("t", "/api/game", server.fetchImpl);
    expect(signals).toBe(0);
    server.steal();
    await checkDeviceSession("t", "/api/game", server.fetchImpl);
    expect(signals).toBe(1);
    off();
  });

  it("이 경계를 모르는 예전 서버에는 표식 없이 예전처럼 이어 간다", async () => {
    const server = fakeServer({ knowsClaim: false });
    expect(await claimDeviceSession("t", "/api/game", server.fetchImpl)).toBe(false);
    expect(deviceSessionField()).toEqual({});
  });

  it("다른 409(저장 충돌)는 다른 기기 접속으로 읽지 않는다", () => {
    expect(noteDeviceSessionResponse(409, "save_conflict")).toBe(false);
    expect(isSessionReplaced()).toBe(false);
  });

  it("확인은 조회라 재전송 키가 필요 없고, 세우기는 쓰기다", () => {
    expect(isReadMethod("session.check")).toBe(true);
    expect(isReadMethod("session.claim")).toBe(false);
  });
});

describe("서버 저장소의 기기 확인", () => {
  function storeWith(active: unknown, fail = false) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url.split("/").at(-1)!);
      if (fail) return new Response(JSON.stringify({ message: "missing" }), { status: 404 });
      return new Response(url.endsWith("server_device_session") ? JSON.stringify(active) : "", { status: 200 });
    }) as unknown as typeof fetch;
    return { store: createSupabaseStore({ url: "https://x.supabase.co", serviceKey: "k", fetchImpl }), calls };
  }
  const mine = "a".repeat(32);

  it("지금 기기와 같으면 지나고 다르면 막는다", async () => {
    expect(await storeWith(mine).store.deviceSessionAllowed("p", mine)).toBe(true);
    expect(await storeWith("b".repeat(32)).store.deviceSessionAllowed("p", mine)).toBe(false);
  });

  it("세운 기기가 없거나, 표식이 없거나, 마이그레이션 전이면 막지 않는다", async () => {
    expect(await storeWith(null).store.deviceSessionAllowed("p", mine)).toBe(true);
    const noDevice = storeWith("b".repeat(32));
    expect(await noDevice.store.deviceSessionAllowed("p", null)).toBe(true);
    expect(noDevice.calls).toEqual([]);
    expect(await storeWith(null, true).store.deviceSessionAllowed("p", mine)).toBe(true);
    expect(await storeWith(null, true).store.claimDeviceSession("p", mine)).toBe(true);
  });
});
