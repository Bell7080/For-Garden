/**
 * 약관·처리방침 동의의 서버 기록(`record_legal_consent`). 문서 판과 만 14세 이상 확인을 계정에 남기며,
 * 서버에 연결되지 않은 빌드는 `unsupported`를 돌려준다(기록된 척하지 않는다). 기기 기록은 `settings.game.legalConsent`다.
 */
import type { RpcCaller } from "./SupportApi";
import { LEGAL_VERSIONS } from "../core/legalConsent";

export type LegalConsentResult = { ok: true } | { ok: false; error: "unsupported" | "network" | "age_required" };

export class LegalConsentApi {
  constructor(private readonly rpc: RpcCaller | null) {}

  async record(): Promise<LegalConsentResult> {
    if (!this.rpc) return { ok: false, error: "unsupported" };
    const r = await this.rpc.callRpc("record_legal_consent", { p_terms_version: LEGAL_VERSIONS.terms, p_privacy_version: LEGAL_VERSIONS.privacy, p_age_14: true });
    if (!r.ok) return { ok: false, error: r.code === "unsupported" ? "unsupported" : "network" };
    const body = r.value as { ok?: boolean; error?: string } | null;
    return body?.ok === true ? { ok: true } : { ok: false, error: body?.error === "age_required" ? "age_required" : "network" };
  }
}
