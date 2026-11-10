/**
 * 출시 시각(`app_config.launch_at`) — 출시 전과 출시 뒤를 가르는 단 하나의 값(응태 결정, 2026-11-10).
 *
 * **출시 전(값 없음)**: 정의에 적힌 끝 날짜로 이벤트·한정 상품·배너를 내리지 않는다(`holdsDefinitionEnds`). 임시 운영 겸 개발
 * 중이라 날짜가 지났다고 판이 비면 안 되기 때문이다. 시작 날짜는 그대로 지킨다. 운영 일정(`live_schedule`) 줄이 덮은 기간은
 * 사람이 정한 값이라 이 유예를 받지 않는다.
 *
 * **출시 뒤(값 있음)**: 유예가 끝나 정의의 기간이 그대로 돌고, 주기가 도는 것들(시즌 패스 · 정기 이벤트 교대 · 결투 시즌)의
 * 기준점이 출시 시각이 든 주의 월요일 00:00(UTC)로 옮겨 간다 — 출시 날이 곧 시즌 1 · 1주차다(`cycleAnchor`). 값은 출시
 * 초기화(`supabase/ops/launch_reset.sql`)가 채운다.
 *
 * 값은 프로세스에 하나만 둔다. 클라이언트는 시작 관문의 공개 설정에서, 서버는 호출마다(짧게 캐시해) DB에서 받아
 * `setLaunchAt`으로 채운다 — 화면과 서버가 같은 함수를 읽어 보인 주기와 받아 주는 주기가 갈리지 않는다.
 *
 * 단위 테스트(`test` 모드)는 정의의 끝 날짜가 지켜지는지를 재므로 유예를 끈 채 시작한다(`setPrelaunchHold`로 켤 수 있다).
 */
const WEEK_MS = 7 * 86_400_000;
/** 1970-01-05는 월요일이다 — 주 경계를 이 날에 맞춘다. */
const MONDAY_OFFSET_MS = 4 * 86_400_000;

let launchAtMs: number | null = null;
let prelaunchHold: boolean = import.meta.env?.MODE !== "test";

/** 서버 값을 받는다. 시각으로 읽히지 않는 값·빈 값은 출시 전이다. */
export function setLaunchAt(raw: unknown): void {
  const parsed = typeof raw === "string" && raw.length > 0 && raw.length <= 40 ? Date.parse(raw) : typeof raw === "number" ? raw : Number.NaN;
  launchAtMs = Number.isFinite(parsed) ? parsed : null;
}

export function launchAt(): number | null {
  return launchAtMs;
}

export function isLaunched(): boolean {
  return launchAtMs !== null;
}

/** 출시 전 유예를 켜고 끈다 — 테스트와 QA 도구용. */
export function setPrelaunchHold(on: boolean): void {
  prelaunchHold = on;
}

/** 정의에 적힌 끝 날짜를 지금은 무시하는가. */
export function holdsDefinitionEnds(): boolean {
  return prelaunchHold && launchAtMs === null;
}

/** 시각이 든 주의 월요일 00:00(UTC). */
export function mondayOf(time: number): number {
  return Math.floor((time - MONDAY_OFFSET_MS) / WEEK_MS) * WEEK_MS + MONDAY_OFFSET_MS;
}

/** 주기의 기준점. 출시 뒤에는 출시 주의 월요일, 출시 전에는 그 주기가 원래 쓰던 기준점이다. */
export function cycleAnchor(prelaunchAnchor: number): number {
  return launchAtMs === null ? prelaunchAnchor : mondayOf(launchAtMs);
}
