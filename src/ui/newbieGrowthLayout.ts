import { NEWBIE_GROWTH_DAYS } from "../data/newbieGrowth";

/**
 * 신규 성장 가이드 창의 자리 — 팝업 본문 원점(화면 가운데) 기준. 위에서부터
 * **머리 원화(제목 · 남은 기간 · 토리카) → 누적 마디 길(목표 수 게이지 + 보상 액자 넷) → 날짜 칩 일곱 → 그날의 목표 다섯 → 모두 받기**.
 * 판 크기는 업적 창과 같다(BASE − 70 × BASE − 210).
 */
export const NEWBIE_GROWTH_LAYOUT = {
  popup: { widthInset: 70, heightInset: 270 },
  hero: {
    y: -626, width: 950, height: 316,
    titleX: -430, titleY: -686, taglineY: -620, clockY: -540,
    sd: { x: 300, groundY: -480, height: 330 },
  },
  track: {
    labelY: -426, barY: -386, barLeft: -440, barRight: 330, barHeight: 22,
    frameY: -304, frameSize: 92,
    /** 마지막(SR 선택권) 액자는 한 뼘 크다 — 이 가이드의 끝이 무엇인지가 그 크기로 읽힌다. */
    finalSize: 124, finalX: 410,
  },
  days: { y: -182, width: 124, height: 96, gap: 8 },
  list: { firstY: -46, cardWidth: 950, cardHeight: 140, gap: 152, rewardSize: 104 },
  claim: { y: 730, width: 420, height: 96 },
} as const;

/** 날짜 칩 `day`(1~7)의 가운데 x — 일곱이 판 가운데로 모인다. */
export function newbieGrowthDayX(day: number): number {
  const { width, gap } = NEWBIE_GROWTH_LAYOUT.days;
  const total = NEWBIE_GROWTH_DAYS * width + (NEWBIE_GROWTH_DAYS - 1) * gap;
  return -total / 2 + width / 2 + (day - 1) * (width + gap);
}

/** 마디 `goals`가 게이지 위에 서는 x. 마지막 마디는 게이지 끝 너머 큰 액자 자리다. */
export function newbieGrowthMilestoneX(goals: number, total: number): number {
  const { barLeft, barRight, finalX } = NEWBIE_GROWTH_LAYOUT.track;
  if (goals >= total) return finalX;
  return barLeft + (barRight - barLeft) * (goals / total);
}

/** 고른 날의 목표 줄 `index`의 가운데 y. */
export function newbieGrowthRowY(index: number): number {
  const { firstY, gap } = NEWBIE_GROWTH_LAYOUT.list;
  return firstY + index * gap;
}

/** 처음 열 때 고를 날 — 받을 것이 남은 가장 이른 날, 없으면 지금 열린 마지막 날. */
export function newbieGrowthInitialDay(goals: readonly { day: number; state: string }[], openDay: number): number {
  const claimable = goals.find(({ state }) => state === "claimable");
  return claimable?.day ?? Math.max(1, Math.min(NEWBIE_GROWTH_DAYS, openDay));
}
