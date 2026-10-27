import { utcDateKey } from "./dailyContent";
import { RAID_TICKET_ITEM } from "../data/raid";

/**
 * 토벌권이 **가끔** 떨어지는 규칙 — 사서 쓰는 입장권이 아니라 스테미나를 녹이며 놀다 보면 생기는 덤이다.
 *
 * 치즈케이크 대작전·현상수배를 이긴 판(소탕 포함) 한 번마다 굴리고, 하루에 받을 수 있는 수에 상한을 둔다 —
 * 많이 풀리면 레이드가 포화된다. 지층 탐사는 판을 만들 때 한 칸을 토벌권으로 바꾸는 길을 따로 갖는다
 * (`strataRaidTicketTile`) — 판 수 자체가 발굴권·재사용 대기로 묶여 있어 하루 상한에 넣지 않는다.
 *
 * **드랍은 레이드가 열린 계정(`raidOpen`)에만, 일반 토벌권만 나온다.** 선택 토벌권은 패스(레이드 패스·진행 패스)
 * 전용 보상이라 던전·고고학 어디서도 떨어지지 않는다. 레이드를 못 여는 계정은 쓸 곳이 없으므로 굴리지도,
 * 하루 수를 세지도 않는다.
 *
 * **굴림은 높은 쪽에서 맞는다**(`roll > 1 - chance`). 난수를 0으로 고정한 테스트·재현이 덤 때문에 결과가
 * 갈리지 않게 한다.
 */
export const RAID_TICKET_DROP = {
  /** 한 판(스테미나 10)마다 일반 토벌권이 떨어질 확률 — 스테미나 100당 약 0.8장. */
  normalChancePerRun: 0.08,
  dailyNormalCap: 3,
  /** 지층 탐사판 한 장에 일반 토벌권 칸이 섞일 확률. */
  strataNormalChance: 0.3,
} as const;

export interface RaidTicketDropState {
  /** 아래 수가 묶인 UTC 날짜. */
  day: string;
  normal: number;
  /** 예전 저장과의 모양 호환용 — 선택 토벌권은 더 떨어지지 않아 늘 0이다. */
  select: number;
}

export function createEmptyRaidTicketDropState(): RaidTicketDropState { return { day: "", normal: 0, select: 0 }; }

const count = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? value as number : 0);

export function normalizeRaidTicketDropState(value: unknown): RaidTicketDropState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof RaidTicketDropState, unknown>>;
  return { day: typeof source.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.day) ? source.day : "", normal: count(source.normal), select: count(source.select) };
}

export function isValidRaidTicketDropState(value: unknown): value is RaidTicketDropState {
  return !!value && typeof value === "object" && JSON.stringify(normalizeRaidTicketDropState(value)) === JSON.stringify(value);
}

/** 떨어진 덤 한 줄 — 결과판·소탕 영수증이 그대로 그린다. */
export interface BonusItemDrop { itemId: string; amount: number; }

/** `runs`판을 이긴 몫의 덤을 굴린다. 날이 바뀌었으면 오늘의 수를 비우고 센다. 원본은 바꾸지 않는다. */
export function rollRaidTicketDrops(state: RaidTicketDropState, runs: number, now: Date, random: () => number, raidOpen: boolean): { state: RaidTicketDropState; drops: BonusItemDrop[] } {
  if (!raidOpen) return { state, drops: [] };
  const today = utcDateKey(now);
  const next = state.day === today ? { ...state } : { day: today, normal: 0, select: 0 };
  let normal = 0;
  for (let run = 0; run < Math.max(0, Math.floor(runs)); run += 1) {
    if (next.normal < RAID_TICKET_DROP.dailyNormalCap && random() > 1 - RAID_TICKET_DROP.normalChancePerRun) { next.normal += 1; normal += 1; }
  }
  const drops: BonusItemDrop[] = [];
  if (normal > 0) drops.push({ itemId: RAID_TICKET_ITEM, amount: normal });
  return { state: next, drops };
}

/** 지층 탐사판 한 장에 섞일 일반 토벌권. 없거나 레이드가 닫혀 있으면 `null`이다. 닫혀 있어도 난수는 한 번 쓴다(판의 나머지 굴림이 갈리지 않게). */
export function strataRaidTicketTile(random: () => number, raidOpen: boolean): string | null {
  const value = random();
  if (!raidOpen) return null;
  return value > 1 - RAID_TICKET_DROP.strataNormalChance ? RAID_TICKET_ITEM : null;
}
