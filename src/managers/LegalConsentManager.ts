import { backendAccount } from "../api/backendSession";
import { LegalConsentApi } from "../api/LegalConsentApi";

/** 동의 기록 경계. 계정은 부를 때 고른다 — 부트가 연결을 세우기 전에 모듈이 읽혀도 굳지 않는다. */
export function legalConsentApi(): LegalConsentApi {
  return new LegalConsentApi(backendAccount());
}

/**
 * 탈퇴 유예 중에 다시 로그인했다면 삭제 요청을 철회한다(`/legal/withdrawal` 4절). 요청이 없으면 아무 일도 없고,
 * 서버에 연결되지 않은 빌드는 건너뛴다. 실패해도 로그인을 막지 않는다 — 다음 로그인에서 다시 시도한다.
 */
export async function cancelDeletionOnLogin(): Promise<void> {
  const account = backendAccount();
  if (account) await account.callRpc("cancel_account_deletion", {});
}
