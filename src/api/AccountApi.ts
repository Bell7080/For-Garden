/** 계정 제공자. 인증 비밀이 아니라 화면에 공개해도 되는 분류만 표현한다. */
export type AccountProvider = "guest" | "google" | "apple";

/** SDK/서버가 보관하는 계정 상태의 표시용 투영이다. 토큰은 계약에 의도적으로 없다. */
export interface AccountState {
  kind: "guest" | "linked";
  provider: AccountProvider;
  /** 로그·화면 노출에 적합하도록 플랫폼 구현이 이미 마스킹한 식별자다. */
  maskedId: string;
}

/** 충돌 화면에서 양쪽 진행을 사람이 비교하는 데 필요한 최소 요약이다. */
export interface ProgressSummary {
  playerLevel: number;
  currency: { gems: number; gold: number };
  /** ISO 8601 서버/클라이언트 기록 시각이다. */
  lastPlayedAt: string;
}

/** 원격 저장 본문과 분리해 먼저 조회하는 비교·동시성 메타데이터다. */
export interface RemoteSaveMetadata {
  saveVersion: number;
  serverModifiedAt: string;
  summary: ProgressSummary;
  dataHash: string;
}

export type AccountFailureCode =
  | "unsupported"
  | "cancelled"
  | "network-error"
  | "guest-merge-unavailable"
  | "conflict-cancelled";

/** 예외 문자열 대신 UI가 취소·통신 실패·합치기 불가를 구별하게 하는 공통 결과다. */
export type AccountResult<T> = { ok: true; value: T } | { ok: false; code: AccountFailureCode; message: string };

export interface LoginRequest {
  provider: Exclude<AccountProvider, "guest">;
  /** true면 플랫폼이 지원하는 경우에만 게스트 진행 합치기를 시도한다. */
  mergeGuestProgress: boolean;
}

/**
 * 인증과 원격 저장의 플랫폼 경계다.
 *
 * 보안 주의: 액세스/리프레시 토큰은 반환하지 않는다. 네이티브 보안 저장소 또는 향후 HttpOnly
 * 서버 세션이 소유해야 하며 Session/localStorage DTO에 추가하면 안 된다.
 */
export interface AccountApi {
  getState(): Promise<AccountResult<AccountState>>;
  login(request: LoginRequest): Promise<AccountResult<AccountState>>;
  logout(): Promise<AccountResult<AccountState>>;
  requestWithdrawal(): Promise<AccountResult<void>>;
  getRemoteSaveMetadata(): Promise<AccountResult<RemoteSaveMetadata | null>>;
}

const UNSUPPORTED = "이 빌드에는 계정 플랫폼 SDK가 연결되어 있지 않습니다.";

/** SDK가 없는 웹 프로토타입은 성공을 가장하지 않고 모든 원격 동작에 명확한 미지원 결과를 준다. */
export class UnsupportedAccountApi implements AccountApi {
  async getState(): Promise<AccountResult<AccountState>> {
    // 게스트 표시 자체는 로컬에서 안전하게 알 수 있으므로 조회만 성공시킨다.
    return { ok: true, value: { kind: "guest", provider: "guest", maskedId: "GUEST-••••" } };
  }
  async login(_request: LoginRequest): Promise<AccountResult<AccountState>> { return this.unsupported(); }
  async logout(): Promise<AccountResult<AccountState>> { return this.unsupported(); }
  async requestWithdrawal(): Promise<AccountResult<void>> { return this.unsupported(); }
  async getRemoteSaveMetadata(): Promise<AccountResult<RemoteSaveMetadata | null>> { return this.unsupported(); }

  private unsupported<T>(): AccountResult<T> { return { ok: false, code: "unsupported", message: UNSUPPORTED }; }
}

/** 실제 SDK 어댑터가 주입되기 전 사용하는 유일한 기본 구현이다. */
export const accountApi: AccountApi = new UnsupportedAccountApi();
