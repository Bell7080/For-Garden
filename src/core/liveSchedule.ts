/**
 * 운영 일정 — 배너·상품·이벤트를 **언제 여는가**만 서버가 정한다.
 *
 * 무엇을 파는지·무엇이 나오는지(풀·확률·가격·보상)는 지금처럼 클라이언트 정의가 갖는다. 서버 표
 * (`live_schedule`)에 줄이 있는 항목만 그 줄의 기간과 켜짐을 따르고, 줄이 없으면 정의에 적힌 기간
 * 그대로다 — 그래서 일정 표가 비어 있어도(마이그레이션 전·서버 없는 빌드) 지금과 똑같이 돈다.
 *
 * 줄의 `startsAt`·`endsAt`이 `null`이면 그쪽 끝을 열어 둔다(정의 값으로 돌아가지 않는다). 기간을
 * 고치지 않고 잠깐 닫기만 하려면 `enabled: false`를 쓴다.
 *
 * 값은 프로세스에 하나만 둔다. 클라이언트는 시작 관문의 공개 설정에서, 서버는 호출마다(짧게 캐시해)
 * DB에서 받아 `setLiveSchedule`로 채운다. 화면과 서버가 같은 함수(`scheduledWindow`)를 지나므로
 * 보여 준 기간과 받아 주는 기간이 갈리지 않는다.
 */
import { holdsDefinitionEnds } from "./launchAnchor";

export const LIVE_SCHEDULE_KINDS = ["banner", "product", "event", "lobby"] as const;
export type LiveScheduleKind = (typeof LIVE_SCHEDULE_KINDS)[number];

export interface LiveScheduleEntry {
  readonly kind: LiveScheduleKind;
  readonly id: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly enabled: boolean;
}

/** 정의가 들고 있는 기간. 둘 다 없으면 늘 열려 있다. */
export interface ScheduleWindow {
  readonly startsAt?: string;
  readonly endsAt?: string;
}

/** 서버 일정을 적용한 결과. `enabled: false`면 기간과 상관없이 닫혀 있다. */
export interface ScheduledWindow extends ScheduleWindow {
  readonly enabled: boolean;
  /** 서버 일정 줄이 이 항목을 덮었는가. */
  readonly overridden: boolean;
}

let current: readonly LiveScheduleEntry[] = [];

/** 끝을 열어 둔 기간을 문자열로 적어야 하는 자리(DTO·로비 카드)가 쓰는 먼 시각. */
export const OPEN_START = "2000-01-01T00:00:00.000Z";
export const OPEN_END = "2099-12-31T23:59:59.000Z";

const isTime = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));

/** 서버가 준 값을 거른다. 모양이 틀린 줄은 버리고 나머지는 쓴다 — 줄 하나 때문에 일정 전체를 잃지 않는다. */
export function parseLiveSchedule(raw: unknown): LiveScheduleEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveScheduleEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (!LIVE_SCHEDULE_KINDS.includes(r.kind as LiveScheduleKind)) continue;
    if (typeof r.id !== "string" || r.id.length === 0 || r.id.length > 96) continue;
    const startsAt = r.startsAt === null || r.startsAt === undefined ? null : isTime(r.startsAt) ? new Date(r.startsAt).toISOString() : undefined;
    const endsAt = r.endsAt === null || r.endsAt === undefined ? null : isTime(r.endsAt) ? new Date(r.endsAt).toISOString() : undefined;
    if (startsAt === undefined || endsAt === undefined) continue;
    out.push({ kind: r.kind as LiveScheduleKind, id: r.id, startsAt, endsAt, enabled: r.enabled !== false });
  }
  return out;
}

export function setLiveSchedule(raw: unknown): void {
  current = parseLiveSchedule(raw);
}

export function liveSchedule(): readonly LiveScheduleEntry[] {
  return current;
}

/** 정의의 기간에 서버 일정을 덮는다. */
export function scheduledWindow(kind: LiveScheduleKind, id: string, def: ScheduleWindow, entries: readonly LiveScheduleEntry[] = current): ScheduledWindow {
  const entry = entries.find((row) => row.kind === kind && row.id === id);
  // 출시 전에는 정의의 끝 날짜로 내리지 않는다(`launchAnchor.ts`). 사람이 정한 일정 줄은 그대로 따른다.
  if (!entry) return { ...(def.startsAt !== undefined ? { startsAt: def.startsAt } : {}), ...(def.endsAt !== undefined && !holdsDefinitionEnds() ? { endsAt: def.endsAt } : {}), enabled: true, overridden: false };
  return { ...(entry.startsAt !== null ? { startsAt: entry.startsAt } : {}), ...(entry.endsAt !== null ? { endsAt: entry.endsAt } : {}), enabled: entry.enabled, overridden: true };
}

/** 시작 포함 · 종료 제외. */
export function windowOpen(window: ScheduledWindow, now: number): boolean {
  if (!window.enabled) return false;
  if (window.startsAt !== undefined && now < Date.parse(window.startsAt)) return false;
  if (window.endsAt !== undefined && now >= Date.parse(window.endsAt)) return false;
  return true;
}

export function scheduleOpen(kind: LiveScheduleKind, id: string, def: ScheduleWindow, now: number, entries: readonly LiveScheduleEntry[] = current): boolean {
  return windowOpen(scheduledWindow(kind, id, def, entries), now);
}
