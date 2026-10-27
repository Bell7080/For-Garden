import { utcDateKey } from "./dailyContent";

/**
 * 출석의 **저장 모양**과 하루 넘김 규칙 — 신규 7일과 정규 7일 두 줄이다.
 *
 * - **신규**는 기한이 없다. 빠진 날은 이어 받고(하루에 한 칸), 일곱 칸을 다 받으면 끝나 다시 열리지 않는다.
 *   한때 계정 시작부터 14일 창을 두었는데, 신규 출석은 붙잡아 두려는 판이라 놓친 사람을 내쫓을 이유가 없어 걷었다.
 * - **정규**는 일곱 칸을 하루에 한 칸씩 이어 받는다. 첫 칸을 받은 날부터 10일(일곱 칸 + 유예 3일)이 한 바퀴이고,
 *   그 안에 다 받으면 **다음 날 곧바로** 새 바퀴가 열린다. 10일이 지나도록 다 받지 못하면 남은 칸은 사라지고
 *   1일차부터 다시 시작한다.
 *
 * 날짜는 서버 UTC 날짜 키(`utcDateKey`)로만 센다 — 기기 시간대를 바꿔 하루를 두 번 받지 못하게 한다.
 */

export const ATTENDANCE_DAYS = 7;
/** 정규 출석 한 바퀴의 날수(첫 칸을 받은 날 포함 — 일곱 칸 + 유예 3일). */
export const REGULAR_ATTENDANCE_WINDOW_DAYS = 10;

export type AttendanceTrackId = "newcomer" | "regular";
export const ATTENDANCE_TRACK_IDS: readonly AttendanceTrackId[] = ["newcomer", "regular"];

export interface AttendanceTrackState {
  /** 이 바퀴가 시작된 UTC 날짜. 신규는 계정 시작일, 정규는 첫 칸을 받은 날이다. 빈 값은 아직 시작 전이다. */
  startDay: string;
  /** 받은 칸 수(0~7). */
  claimed: number;
  /** 마지막으로 받은 UTC 날짜. 같은 날 두 칸을 받지 못하게 한다. */
  lastClaimDay: string;
  /**
   * 이 바퀴에서 광고 덤을 받은 일차(1~7, 오름차순). 정규만 쓴다 — 덤은 **받은 칸**에만 붙고 일차마다 한 번이다.
   * 그날 받지 않은 덤도 바퀴가 끝나기 전까지는 광고를 보고 나중에 받을 수 있다.
   */
  adClaimed: number[];
}

export interface AttendanceState {
  newcomer: AttendanceTrackState;
  regular: AttendanceTrackState;
  /** 로비가 출석 판을 저절로 연 마지막 UTC 날짜. 하루에 한 번만 저절로 연다. */
  autoShownDay: string;
}

export function createEmptyAttendanceState(): AttendanceState {
  return { newcomer: emptyTrack(), regular: emptyTrack(), autoShownDay: "" };
}

function emptyTrack(lastClaimDay = ""): AttendanceTrackState {
  return { startDay: "", claimed: 0, lastClaimDay, adClaimed: [] };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const dayKeyOrEmpty = (value: unknown): string => (typeof value === "string" && DAY_KEY.test(value) ? value : "");
const claimedCount = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? Math.min(ATTENDANCE_DAYS, value as number) : 0);

function normalizeTrack(value: unknown): AttendanceTrackState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof AttendanceTrackState, unknown>>;
  const claimed = claimedCount(source.claimed);
  // 덤은 받은 칸에만 붙는다 — 아직 받지 않은 일차의 덤 기록은 버린다.
  const adClaimed = Array.isArray(source.adClaimed)
    ? [...new Set(source.adClaimed.filter((day): day is number => Number.isInteger(day) && (day as number) >= 1 && (day as number) <= claimed))].sort((a, b) => a - b)
    : [];
  return { startDay: dayKeyOrEmpty(source.startDay), claimed, lastClaimDay: dayKeyOrEmpty(source.lastClaimDay), adClaimed };
}

export function normalizeAttendanceState(value: unknown): AttendanceState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof AttendanceState, unknown>>;
  return { newcomer: normalizeTrack(source.newcomer), regular: normalizeTrack(source.regular), autoShownDay: dayKeyOrEmpty(source.autoShownDay) };
}

export function isValidAttendanceState(value: unknown): value is AttendanceState {
  if (!value || typeof value !== "object") return false;
  const normalized = normalizeAttendanceState(value);
  return JSON.stringify(normalized) === JSON.stringify(value);
}

export function cloneAttendanceState(state: AttendanceState): AttendanceState {
  return { newcomer: { ...state.newcomer, adClaimed: [...(state.newcomer.adClaimed ?? [])] }, regular: { ...state.regular, adClaimed: [...(state.regular.adClaimed ?? [])] }, autoShownDay: state.autoShownDay };
}

/** 두 UTC 날짜 키 사이의 날수(`to - from`). */
export function dayKeyDistance(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

/**
 * 오늘에 맞춰 바퀴를 넘긴다. 신규는 계정 시작일을 처음 읽을 때 정하고, 정규는 다 받은 바퀴를 다음 날 비우며
 * 기한이 지난 바퀴도 비운다. 원본은 바꾸지 않는다.
 */
export function rollAttendance(state: AttendanceState, now: Date): AttendanceState {
  const today = utcDateKey(now);
  const next = cloneAttendanceState(state);
  if (!next.newcomer.startDay) next.newcomer.startDay = today;
  const regular = next.regular;
  if (regular.startDay) {
    const lapDone = regular.claimed >= ATTENDANCE_DAYS && regular.lastClaimDay !== today;
    const expired = dayKeyDistance(regular.startDay, today) >= REGULAR_ATTENDANCE_WINDOW_DAYS;
    if (lapDone || expired) next.regular = emptyTrack(regular.lastClaimDay);
  }
  return next;
}

/** 한 줄의 지금 모습 — 판이 그대로 그린다. */
export interface AttendanceTrackView {
  id: AttendanceTrackId;
  /** 이 줄을 아직 세우는가. 신규는 다 받으면 서지 않는다. */
  open: boolean;
  claimed: number;
  /** 오늘 받을 수 있는가. 참이면 `claimed`번째 칸(0부터)이 오늘의 칸이다. */
  claimableToday: boolean;
  /** 이 줄이 닫히는 시각(ISO, 그 날짜가 지나는 자정). 신규는 기한이 없어 늘 `null`, 정규는 바퀴가 시작되기 전이면 `null`. */
  endsAt: string | null;
  /** 이 바퀴에서 광고 덤을 받은 일차. */
  adClaimed: number[];
  /** 오늘 받은 칸의 광고 덤을 지금 받을 수 있는가(정규만). 참이면 `claimed`번째 일차(1부터)의 덤이다. */
  adClaimableToday: boolean;
  /** 지금 광고를 보고 받을 수 있는 덤의 일차(1부터, 오름차순). 받은 칸 중 덤을 아직 안 받은 날 전부이며, 지나간 날도 든다(정규만). */
  adClaimableDays: number[];
}

function windowEnd(startDay: string, days: number): string {
  const end = new Date(`${startDay}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return end.toISOString();
}

/** 넘긴 상태(`rollAttendance` 뒤)를 오늘 기준으로 읽는다. */
export function attendanceTrackView(state: AttendanceState, id: AttendanceTrackId, now: Date): AttendanceTrackView {
  const today = utcDateKey(now);
  const track = state[id];
  const claimedToday = track.lastClaimDay === today;
  if (id === "newcomer") {
    const done = track.claimed >= ATTENDANCE_DAYS;
    // 일곱째 칸을 받은 날은 그 도장을 보도록 판을 남긴다 — 다음 날부터 서지 않는다.
    const open = !done || claimedToday;
    return { id, open, claimed: track.claimed, claimableToday: open && !done && !claimedToday, endsAt: null, adClaimed: [], adClaimableToday: false, adClaimableDays: [] };
  }
  return {
    id, open: true, claimed: track.claimed,
    claimableToday: track.claimed < ATTENDANCE_DAYS && !claimedToday,
    endsAt: track.startDay ? windowEnd(track.startDay, REGULAR_ATTENDANCE_WINDOW_DAYS) : null,
    adClaimed: [...track.adClaimed],
    adClaimableToday: claimedToday && track.claimed >= 1 && !track.adClaimed.includes(track.claimed),
    adClaimableDays: Array.from({ length: track.claimed }, (_, index) => index + 1).filter((day) => !track.adClaimed.includes(day)),
  };
}

/** 오늘의 칸 하나를 받은 상태. 받을 수 없으면 `null`이다. */
export function claimAttendanceDay(state: AttendanceState, id: AttendanceTrackId, now: Date): { state: AttendanceState; day: number } | null {
  const rolled = rollAttendance(state, now);
  if (!attendanceTrackView(rolled, id, now).claimableToday) return null;
  const today = utcDateKey(now);
  const track = rolled[id];
  const day = track.claimed + 1;
  rolled[id] = { startDay: track.startDay || today, claimed: day, lastClaimDay: today, adClaimed: [...track.adClaimed] };
  return { state: rolled, day };
}

/**
 * 정규 출석의 광고 덤을 받은 상태. `day`를 주지 않으면 오늘 받은 칸의 덤을, 없으면 가장 오래된 못 받은 덤을 받는다.
 * 받을 칸이 아니거나 이미 받은 일차면 `null`이다.
 */
export function claimAttendanceAdBonus(state: AttendanceState, now: Date, day?: number): { state: AttendanceState; day: number } | null {
  const rolled = rollAttendance(state, now);
  const claimable = attendanceTrackView(rolled, "regular", now).adClaimableDays;
  const target = day ?? (claimable.includes(rolled.regular.claimed) && rolled.regular.lastClaimDay === utcDateKey(now) ? rolled.regular.claimed : claimable[0]);
  if (target === undefined || !claimable.includes(target)) return null;
  rolled.regular = { ...rolled.regular, adClaimed: [...rolled.regular.adClaimed, target].sort((a, b) => a - b) };
  return { state: rolled, day: target };
}

/** 어느 줄이든 오늘 받을 칸이 남았는가 — 로비의 빨간 점과 저절로 여는 판이 함께 읽는다. */
export function attendanceClaimable(state: AttendanceState, now: Date): boolean {
  const rolled = rollAttendance(state, now);
  return ATTENDANCE_TRACK_IDS.some((id) => attendanceTrackView(rolled, id, now).claimableToday);
}
