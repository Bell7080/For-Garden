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

  function stateFetch(status: number) {
    return (async () => new Response(JSON.stringify({ code: "boom" }), { status })) as unknown as typeof fetch;
  }

  it("서버 호출이 막히면 이 기기에서 이어 가지 않고 진단 코드를 돌려준다", async () => {
    const { account } = fakeAccount(null);
    let installed = false;
    const result = await connectServerProgress({ account, saves: new SaveManager(memoryStorage()), marker: marker(null), choose: async () => "cancel", target: createDefaultSession(), install: () => { installed = true; }, fetchImpl: stateFetch(503) });
    expect(result).toMatchObject({ ok: false, code: "network-error" });
    expect((result as { detail?: string }).detail).toMatch(/^game:/);
    expect(installed).toBe(false);
  });

  it("계정을 만들지 못하면 사유를 그대로 돌려준다", async () => {
    const account = { userId: async () => null, accessToken: async () => null, lastFailure: () => "auth:/auth/v1/signup:422:-" } as unknown as ServerProgressAccount;
    const result = await connectServerProgress({ account, saves: new SaveManager(memoryStorage()), marker: marker(null), choose: async () => "cancel", install: () => undefined });
    expect(result).toEqual({ ok: false, code: "network-error", detail: "auth:/auth/v1/signup:422:-" });
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

  it("서버 응답이 이 기기에서 고른 관문을 되돌리지 않는다", () => {
    const target = createDefaultSession();
    target.selectedStageId = "1-2";
    const next = createDefaultSession();
    next.selectedStageId = "1-1";
    applyServerState(target, next, { save: () => undefined });
    expect(target.selectedStageId).toBe("1-2");
    const fresh = createDefaultSession();
    applyServerState(fresh, next, { save: () => undefined });
    expect(fresh.selectedStageId).toBe("1-1");
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

describe('계정 연결 세대',()=>{
 it('토큰을 기다리는 중 계정이 전환되면 이전 게임 연결은 HTTP 요청을 보내지 않는다',async()=>{
  let current=true, deliver!:(token:string)=>void, entered!:()=>void;
  const requested=new Promise<void>(resolve=>{entered=resolve;});
  const {account}=fakeAccount(null);
  account.accessToken=async()=>{entered();return new Promise<string>(resolve=>{deliver=resolve;});};
  let requests=0;
  const pending=connectServerProgress({account,saves:new SaveManager(memoryStorage()),target:createDefaultSession(),marker:marker(null),choose:async()=> 'cancel',isCurrent:()=>current,install:()=>undefined,fetchImpl:(async()=>{requests++;throw Error('stale request');}) as typeof fetch});
  await requested;current=false;deliver('new-account-token');
  expect(await pending).toMatchObject({ok:false});expect(requests).toBe(0);
 });
 it('계정 전환 전의 늦은 서버 응답은 새 진행/설치 상태에 반영하지 않는다',async()=>{
  let current=true, deliver!:(r:Response)=>void, entered!:()=>void;
  const requested=new Promise<void>(resolve=>{entered=resolve;});
  const target=createDefaultSession();const before=target.wallet.gems;
  const remote=createDefaultSession();remote.wallet.gems=before+999;
  const saves=new SaveManager(memoryStorage());const installed:unknown[]=[];
  const {account}=fakeAccount(null);
  const pending=connectServerProgress({account,saves,target,marker:marker(null),choose:async()=> 'cancel',isCurrent:()=>current,install:api=>{installed.push(api);},fetchImpl:(async()=>{entered();return new Promise<Response>(resolve=>{deliver=resolve;});}) as typeof fetch});
  await requested;current=false;deliver(new Response(JSON.stringify({ok:true,result:{},revision:'1',state:saves.exportData(remote)})));
  expect(await pending).toMatchObject({ok:false});expect(target.wallet.gems).toBe(before);expect(installed).toEqual([]);
 });
});
