import { describe, expect, it } from "vitest";
import { AccountSaveSync, hashSaveData } from "../../src/api/AccountSaveSync";
import type { AccountApi, RemoteSaveMetadata } from "../../src/api/AccountApi";
import { createDefaultSession } from "../../src/state/session";

/** 원격 저장 동시성/병합 계약을 실제 UI나 플랫폼 SDK 없이 검증하는 최소 가짜 구현이다. */
function api(overrides: Partial<AccountApi>): AccountApi {
  const unsupported = async () => ({ ok: false as const, code: "unsupported" as const, message: "unsupported" });
  return { getState: unsupported, login: unsupported, logout: unsupported, requestWithdrawal: unsupported, getRemoteSaveMetadata: unsupported, downloadRemoteSave: unsupported, uploadRemoteSave: unsupported, deleteRemoteSave: unsupported, mergeGuestSave: unsupported, ...overrides };
}

const metadata: RemoteSaveMetadata = { revision: "7", etag: '"save-7"', saveVersion: 34, serverModifiedAt: "2026-09-09T00:00:00Z", dataHash: "different", summary: { playerLevel: 9, currency: { gems: 20, gold: 30 }, lastPlayedAt: "2026-09-09T00:00:00Z" } };

describe("AccountSaveSync", () => {
  it("uses the server idempotent merge endpoint for a guest local choice", async () => {
    const calls: unknown[] = [];
    const merged = createDefaultSession();
    const remote = api({ getRemoteSaveMetadata: async () => ({ ok: true, value: metadata }), mergeGuestSave: async request => { calls.push(request); return { ok: true, value: { metadata, data: merged } }; } });
    const saves = { exportData: () => ({ saveVersion: 34 }), importRemote: (data: unknown) => { expect(data).toBe(merged); return createDefaultSession(); } };
    const result = await new AccountSaveSync(remote, saves as never).synchronize(createDefaultSession(), async () => "local", "merge-1");
    expect(result.ok).toBe(true);
    expect(calls).toMatchObject([{ requestId: "merge-1", expectedRemote: { revision: "7", etag: '"save-7"' } }]);
  });

  it("rejects a download whose revision changed after the choice", async () => {
    let imported = false;
    const remote = api({ getRemoteSaveMetadata: async () => ({ ok: true, value: metadata }), downloadRemoteSave: async () => ({ ok: true, value: { metadata: { ...metadata, revision: "8" }, data: {} } }) });
    const saves = { exportData: () => ({}), importRemote: () => { imported = true; return createDefaultSession(); } };
    const result = await new AccountSaveSync(remote, saves as never).synchronize(createDefaultSession(), async () => "remote");
    expect(result).toMatchObject({ ok: false, code: "save-conflict" }); expect(imported).toBe(false);
  });

  it("hashes semantically identical object key orders equally", async () => {
    expect(await hashSaveData({ b: 2, a: 1 })).toBe(await hashSaveData({ a: 1, b: 2 }));
  });
});
