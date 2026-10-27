/**
 * 아이디·비밀번호 계정의 입력 규칙. 인증 서비스(Supabase Auth)는 이메일 모양의 식별자를 요구하므로,
 * 플레이어가 고른 아이디를 **메일을 보내지 않는 합성 주소**로 옮겨 쓴다. 메일 인증은 하지 않는다.
 *
 * 비밀번호는 클라이언트가 해시하거나 저장하지 않는다 — 입력 → TLS → 인증 서비스가 해시 보관하고,
 * 이 파일은 길이·글자 검사만 한다(서버가 마지막으로 다시 검사한다).
 * 추후 소셜 로그인(구글 등)은 같은 계정에 **정체성을 더하는** 방식(`linkIdentity`)으로 붙이므로
 * 아이디 계정과 소셜 계정이 같은 유저 ID를 공유하게 된다 — 여기서는 그 전제만 지킨다.
 */
export const ACCOUNT_ID_MIN = 4;
export const ACCOUNT_ID_MAX = 20;
export const ACCOUNT_PASSWORD_MIN = 8;
export const ACCOUNT_PASSWORD_MAX = 64;
/** 합성 주소의 도메인. 실제로 메일이 가지 않으므로 어떤 값이든 되지만 바꾸면 기존 계정을 잃으니 고정한다. */
export const ACCOUNT_ID_DOMAIN = "id.forgarden.app";

export type AccountCredentialProblem = "id-length" | "id-chars" | "password-length" | "password-same-as-id";

/** 대소문자는 구분하지 않는다. 공백을 걷고 소문자로 맞춘 값이 계정의 정체성이다. */
export function normalizeAccountId(raw: string): string {
  return raw.trim().toLowerCase();
}

export function accountIdProblem(raw: string): "id-length" | "id-chars" | null {
  const id = normalizeAccountId(raw);
  if (id.length < ACCOUNT_ID_MIN || id.length > ACCOUNT_ID_MAX) return "id-length";
  return /^[a-z][a-z0-9_]*$/.test(id) ? null : "id-chars";
}

export function accountPasswordProblem(password: string, rawId = ""): "password-length" | "password-same-as-id" | null {
  const length = Array.from(password).length;
  if (length < ACCOUNT_PASSWORD_MIN || length > ACCOUNT_PASSWORD_MAX) return "password-length";
  return rawId !== "" && password.toLowerCase() === normalizeAccountId(rawId) ? "password-same-as-id" : null;
}

export function accountCredentialProblem(rawId: string, password: string): AccountCredentialProblem | null {
  return accountIdProblem(rawId) ?? accountPasswordProblem(password, rawId);
}

/** 인증 서비스에 넘기는 합성 주소. 규칙에 맞지 않는 아이디는 호출 전에 걸러야 한다. */
export function accountIdToAuthEmail(rawId: string): string {
  return `${normalizeAccountId(rawId)}@${ACCOUNT_ID_DOMAIN}`;
}

/** 합성 주소에서 아이디를 되돌린다. 합성 주소가 아니면(소셜 이메일 등) null이다. */
export function authEmailToAccountId(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const suffix = `@${ACCOUNT_ID_DOMAIN}`;
  return email.endsWith(suffix) && email.length > suffix.length ? email.slice(0, -suffix.length) : null;
}

/** 화면·로그에 쓰는 표기: 앞 두 글자만 남기고 가린다. */
export function maskAccountId(id: string): string {
  const head = Array.from(id).slice(0, 2).join("");
  return `${head}••••`;
}
