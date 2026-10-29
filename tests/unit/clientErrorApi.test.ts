import { describe, expect, it } from "vitest";
import { ClientErrorApi, type ClientErrorPayload } from "../../src/api/ClientErrorApi";
import type { RpcCaller } from "../../src/api/SupportApi";

const payload: ClientErrorPayload = { kind: "report", code: "a.b", message: "m", stack: null, version: "1", build: "production", platform: "web", scene: "LobbyScene", context: { x: 1 }, breadcrumbs: [[0.1, "c"]] };
const fake = (value: unknown, ok = true): RpcCaller & { calls: Array<[string, Record<string, unknown>]> } => {
  const calls: Array<[string, Record<string, unknown>]> = [];
  return { calls, async callRpc(name, args) { calls.push([name, args]); return ok ? { ok: true, value } : { ok: false, code: "network-error", message: "x" }; } };
};

describe("ClientErrorApi", () => {
  it("서버 함수에 필드를 그대로 싣는다", async () => {
    const rpc = fake({ ok: true });
    expect(await new ClientErrorApi(rpc).report(payload)).toBe("sent");
    expect(rpc.calls[0][0]).toBe("report_client_error");
    expect(rpc.calls[0][1]).toMatchObject({ p_kind: "report", p_code: "a.b", p_scene: "LobbyScene", p_context: { x: 1 } });
  });
  it("거절·네트워크 실패·미연결을 구분한다", async () => {
    expect(await new ClientErrorApi(fake({ ok: false, error: "rate_limited" })).report(payload)).toBe("rejected");
    expect(await new ClientErrorApi(fake(null, false)).report(payload)).toBe("network");
    expect(await new ClientErrorApi(null).report(payload)).toBe("unsupported");
  });
});
