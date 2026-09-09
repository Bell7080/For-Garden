import type { AccountApi, AccountFailureCode, AccountResult, ProgressSummary, RemoteSaveMetadata, RemoteSavePrecondition } from "./AccountApi";
import type { SaveManager } from "../state/SaveManager";
import type { Session } from "../state/session";

/** 로그인 뒤 충돌 UI가 결정할 수 있는 세 가지 명시적 결과다. */
export type SaveSyncChoice = "local" | "remote" | "cancel";

/** 메타데이터에서 조건부 쓰기에 필요한 불투명 값만 뽑아 서버로 되돌린다. */
function precondition(metadata: RemoteSaveMetadata): RemoteSavePrecondition {
  return { revision: metadata.revision, etag: metadata.etag };
}

/** 객체 키 순서와 Set 삽입 순서 차이가 같은 진행을 충돌로 보이지 않게 정규화한다. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** 서버와 공유 가능한 SHA-256 hex 해시를 만들며 인증 정보는 입력에 포함하지 않는다. */
export async function hashSaveData(data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** 로컬 비교 카드에는 저장에 이미 있는 서버 확정 시각만 사용해 가짜 최근 시각을 만들지 않는다. */
export function summarizeLocalSave(state: Session): ProgressSummary {
  return { playerLevel: state.playerResearch.level, currency: { gems: state.wallet.gems, gold: state.wallet.gold }, lastPlayedAt: state.staminaUpdatedAt };
}

/** 인증 이후 조회·선택·조건부 쓰기를 조율하되 Phaser와 Session 전역에는 의존하지 않는다. */
export class AccountSaveSync {
  constructor(private readonly api: AccountApi, private readonly saves: Pick<SaveManager, "exportData" | "importRemote">) {}

  async synchronize(local: Session, choose: (local: ProgressSummary, remote: ProgressSummary) => Promise<SaveSyncChoice>, guestMergeRequestId?: string): Promise<AccountResult<void>> {
    const data = this.saves.exportData(local);
    const localHash = await hashSaveData(data);
    const metadataResult = await this.api.getRemoteSaveMetadata();
    if (!metadataResult.ok) return metadataResult;
    const metadata = metadataResult.value;
    // 서버 저장이 없는 첫 연결은 생성 조건(null)으로만 올려 동시 생성을 감지한다.
    if (!metadata) return guestMergeRequestId
      ? this.mergeAndImport({ requestId: guestMergeRequestId, guestData: data, expectedRemote: null })
      : this.asVoid(await this.api.uploadRemoteSave(data, null));
    if (metadata.dataHash === localHash) return { ok: true, value: undefined };

    const choice = await choose(summarizeLocalSave(local), metadata.summary);
    if (choice === "cancel") return { ok: false, code: "conflict-cancelled", message: "저장 선택을 취소했습니다." };
    if (choice === "local") return guestMergeRequestId
      // 병합 결과와 재화·인벤토리 중복 판정은 전부 서버가 소유하며 클라이언트는 DTO를 합산하지 않는다.
      ? this.mergeAndImport({ requestId: guestMergeRequestId, guestData: data, expectedRemote: precondition(metadata) })
      : this.asVoid(await this.api.uploadRemoteSave(data, precondition(metadata)));

    const downloaded = await this.api.downloadRemoteSave();
    if (!downloaded.ok) return downloaded;
    // 메타 조회 뒤 서버가 바뀌었으면 처음 보여 준 선택과 다른 본문을 적용하지 않는다.
    if (downloaded.value.metadata.revision !== metadata.revision || downloaded.value.metadata.etag !== metadata.etag) return this.failure("save-conflict", "선택 중 서버 저장이 갱신되었습니다.");
    try { this.saves.importRemote(downloaded.value.data); }
    catch { return this.failure("invalid-remote-save", "서버 저장을 검증할 수 없습니다."); }
    return { ok: true, value: undefined };
  }

  /** 성공 결과의 메타데이터는 호출자가 보관하지 않으므로 void 계약으로 좁힌다. */
  private asVoid(result: AccountResult<unknown>): AccountResult<void> { return result.ok ? { ok: true, value: undefined } : result; }
  /** 서버가 확정한 병합 본문도 다운로드와 똑같이 SaveManager 검증을 통과시킨다. */
  private async mergeAndImport(request: Parameters<AccountApi["mergeGuestSave"]>[0]): Promise<AccountResult<void>> {
    const merged = await this.api.mergeGuestSave(request);
    if (!merged.ok) return merged;
    try { this.saves.importRemote(merged.value.data); }
    catch { return this.failure("invalid-remote-save", "서버 병합 저장을 검증할 수 없습니다."); }
    return { ok: true, value: undefined };
  }
  private failure(code: AccountFailureCode, message: string): AccountResult<void> { return { ok: false, code, message }; }
}
