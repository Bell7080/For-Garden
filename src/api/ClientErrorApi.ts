/**
 * 클라이언트 오류 보고. DB 함수 `report_client_error`를 로그인한 계정으로 부른다. 서버에 연결되지 않은 빌드는
 * `unsupported`를 돌려주고 보고를 버린다(보냈다고 흉내 내지 않는다). 속도 제한·길이 제한·묶기는 서버가 한다.
 */
import type { RpcCaller } from "./SupportApi";
import type { ErrorReportKind } from "../core/errorReport";

export interface ClientErrorPayload {
  kind: ErrorReportKind;
  code: string | null;
  message: string;
  stack: string | null;
  version: string;
  build: string;
  platform: string;
  scene: string | null;
  context: Record<string, string | number | boolean>;
  breadcrumbs: Array<[number, string]>;
}

export type ClientErrorResult = "sent" | "unsupported" | "rejected" | "network";

export class ClientErrorApi {
  constructor(private readonly rpc: RpcCaller | null) {}

  async report(p: ClientErrorPayload): Promise<ClientErrorResult> {
    if (!this.rpc) return "unsupported";
    const r = await this.rpc.callRpc("report_client_error", {
      p_kind: p.kind, p_code: p.code, p_message: p.message, p_stack: p.stack, p_version: p.version, p_build: p.build,
      p_platform: p.platform, p_scene: p.scene, p_context: p.context, p_breadcrumbs: p.breadcrumbs,
    });
    if (!r.ok) return r.code === "unsupported" ? "unsupported" : "network";
    const body = r.value as { ok?: boolean } | null;
    return body?.ok === false ? "rejected" : "sent";
  }
}
