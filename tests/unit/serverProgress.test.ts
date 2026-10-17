import { describe, expect, it } from "vitest";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";
import { hashSaveData } from "../../src/api/AccountSaveSync";
import { applyServerState, connectServerProgress, type LinkMarker, type ServerProgressAccount } from "../../src/api/serverProgress";
import { gameApi, installGameApi } from "../../src/api/FakeServer";
import type { RemoteSaveMetadata } from "../../src/api/AccountApi";

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
}

async function metaFor(data: unknown): Promise<RemoteSaveMetadata> {
  return { revision: "3", etag: "e3", saveVersion: 1, serverModifiedAt: "", dataHash: await hashSaveData(data), summary: { playerLevel: 1, currency: { gems: 0, gold: 0 }, lastPlayedAt: "" } };
}

function fakeAccount(remote: { data: unknown } | null, options: { network?: boolean } = {}) {
  const uploads: unknown[] = [];
  const state = { remote };
  const account = {
    userId: async () => "user-1",
    accessToken: async () => "token",
    async getRemoteSaveMetadata() {
      if (options.network) return { ok: false as const, code: "network-error" as const, message: "" };
      return { ok: true as const, value: state.remote ? await metaFor(state.remote.data) : null };
    },
    async downloadRemoteSave() { return { ok: true as const, value: { metadata: await metaFor(state.remote!.data), data: state.remote!.data } }; },
    async uploadRemoteSave(data: unknown) { uploads.push(data); state.remote = { data }; return { ok: true as const, value: await metaFor(data) }; },
  } as unknown as ServerProgressAccount;
  return { account, uploads, state };
}

function marker(initial: string | null): LinkMarker & { value: string | null } {
  const m = { value: initial, get: () => m.value, set: (v: string | null) => { m.value = v; } };
  return m;
}

describe("서버 진행 연결", () => {
  it("연결할 서버가 없으면 이 기기의 임시 구현에 머문다", async () => {
    let installed = 0;
    const result = await connectServerProgress({ account: null, saves: new SaveManager(memoryStorage()), marker: marker(null), choose: async () => "cancel", install: () => { installed += 1; } });
    expect(result).toEqual({ ok: true, mode: "local" });
    expect(installed).toBe(0);
  });

  it("서버가 비어 있으면 이 기기의 진행을 올리고 서버 호출로 바꾼다", async () => {
    const { account, uploads } = fakeAccount(null);
    const target = createDefaultSession();
    target.wallet.gold = 777;
    const m = marker(null);
    let installed = false;
    const result = await connectServerProgress({ account, saves: new SaveManager(memoryStorage()), marker: m, choose: async () => "cancel", target, install: (api) => { installed = api !== null; } });
    expect(result).toEqual({ ok: true, mode: "server" });
    expect(uploads).toHaveLength(1);
    expect(installed).toBe(true);
    expect(m.value).toBe("user-1");
    expect(target.wallet.gold).toBe(777);
  });

  it("이미 연결된 기기는 서버 저장을 받되 기기 값은 지킨다", async () => {
    const serverSession = createDefaultSession();
    serverSession.wallet.gold = 5000;
    serverSession.settings.game.battleSpeed = 2;
    serverSession.settings.sound.masterVolume = 0.1;
    const saves = new SaveManager(memoryStorage());
    const { account } = fakeAccount({ data: saves.exportData(serverSession) });
    const target = createDefaultSession();
    target.settings.sound.masterVolume = 0.9;
    target.settings.game.language = "en";
    let chose = 0;
    const result = await connectServerProgress({ account, saves, marker: marker("user-1"), choose: async () => { chose += 1; return "cancel"; }, target, install: () => undefined });
    expect(result).toEqual({ ok: true, mode: "server" });
    expect(chose).toBe(0);
    expect(target.wallet.gold).toBe(5000);
    expect(target.settings.game.battleSpeed).toBe(2);
    expect(target.settings.sound.masterVolume).toBe(0.9);
    expect(target.settings.game.language).toBe("en");
  });

  it("처음 만나는 기기에 서로 다른 진행이 있으면 고르게 하고 취소하면 서버로 바꾸지 않는다", async () => {
    const saves = new SaveManager(memoryStorage());
    const remoteSession = createDefaultSession();
    remoteSession.wallet.gold = 9;
    const { account, uploads } = fakeAccount({ data: saves.exportData(remoteSession) });
    const target = createDefaultSession();
    target.wallet.gold = 1234;
    let installed = false;
    let asked = 0;
    const result = await connectServerProgress({ account, saves, marker: marker(null), choose: async () => { asked += 1; return "cancel"; }, target, install: () => { installed = true; } });
    expect(result).toMatchObject({ ok: false, code: "conflict-cancelled" });
    expect(asked).toBe(1);
    expect(installed).toBe(false);
    expect(uploads).toHaveLength(0);
    expect(target.wallet.gold).toBe(1234);
  });

  it("서버에 닿지 못하면 이 기기에서 이어 가지 않고 실패를 돌려준다", async () => {
    const { account } = fakeAccount(null, { network: true });
    let installed = false;
    const result = await connectServerProgress({ account, saves: new SaveManager(memoryStorage()), marker: marker(null), choose: async () => "cancel", target: createDefaultSession(), install: () => { installed = true; } });
    expect(result).toMatchObject({ ok: false, code: "network-error" });
    expect(installed).toBe(false);
  });

  it("게임 서버 호출 실패는 상태 코드와 서버 코드만 진단 문자열로 남긴다", async () => {
    const { RemoteGameApiError } = await import("../../src/api/RemoteGameApi");
    const { describeGameFailure } = await import("../../src/api/serverProgress");
    expect(describeGameFailure(new RemoteGameApiError(503, "server_not_configured"))).toBe("game:503:server_not_configured");
    expect(describeGameFailure(new TypeError("Failed to fetch"))).toBe("game-exception:TypeError");
  });

  it("서버 상태를 얹어도 세션 객체는 그대로고 기기 값이 남는다", () => {
    const target = createDefaultSession();
    target.settings.accessibility.textScale = 1.3;
    const next = createDefaultSession();
    next.wallet.gems = 42;
    next.settings.game.autoUltimate = true;
    const saved: unknown[] = [];
    applyServerState(target, next, { save: (s) => { saved.push(s); } });
    expect(target.wallet.gems).toBe(42);
    expect(target.settings.game.autoUltimate).toBe(true);
    expect(target.settings.accessibility.textScale).toBe(1.3);
    expect(saved).toHaveLength(1);
  });

  it("gameApi는 설치된 구현으로 넘기고 내리면 임시 구현으로 돌아간다", async () => {
    const calls: string[] = [];
    installGameApi({ getInventory: async () => { calls.push("remote"); return { items: [] }; } } as never);
    await gameApi.getInventory();
    installGameApi(null);
    expect(calls).toEqual(["remote"]);
    await expect(gameApi.getInventory()).resolves.toBeDefined();
    expect(calls).toEqual(["remote"]);
  });
});
