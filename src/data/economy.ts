import type { Wallet } from "../core/gacha";

/** 라이브 운영에서 지급량과 소비량을 함께 검토하는 네 핵심 경제 재화다. */
export type EconomyCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments";

/** API 연산 뒤 정수 오버플로와 비정상 적립을 차단하는 재화별 계정 상한이다. */
export const WALLET_CAPS: Readonly<Record<keyof Wallet, number>> = {
  // 발굴의 일반 화석(`fossil`)과 다이아(`gems`)도 다른 API 지급과 같은 계정 상한을 공유한다.
  fossil: 9_999_999,
  amber: 999_999,
  gems: 9_999_999,
  gold: 999_999_999,
  stamina: 9_999,
  dnaFragments: 99_999,
  cheesecake: 9_999_999,
};

/** 문서의 월간 무과금 수급 계산이 참조하는 30일/4주 기준 목표 지급량이다. */
export const FREE_MONTHLY_TARGETS: Readonly<Record<"daily" | "weekly" | "event" | "story", Readonly<Partial<Record<EconomyCurrency, number>>>>> = {
  daily: { fossil: 90, amber: 0.2, cheesecake: 200, dnaFragments: 0 },
  weekly: { fossil: 700, amber: 2, cheesecake: 1_000, dnaFragments: 5 },
  event: { fossil: 1_800, amber: 12, cheesecake: 2_000, dnaFragments: 20 },
  story: { fossil: 1_000, amber: 4, cheesecake: 1_000, dnaFragments: 5 },
};

/** DNA 교환 결과는 무작위 추첨 없이 요청에서 고른 보상으로 확정된다. */
export type DnaExchangeKind = "relic_fragment" | "rune" | "past_event_currency";

/** DNA 조각 교환소의 운영 카탈로그다. targetRequired 항목만 요청에서 대상을 받는다. */
export const DNA_EXCHANGE_OFFERS = [
  { id: "dna-fragment", kind: "relic_fragment", name: "보유 렐릭 파편", dnaCost: 10, targetRequired: true },
  // 교환품은 특정 정적 ID가 아니라 서버가 옵션을 생성하는 희귀도 계약만 지정한다.
  { id: "dna-rune", kind: "rune", name: "고급 룬 제작 재료", dnaCost: 15, targetRequired: false, rarity: "uncommon" },
  { id: "dna-past-event", kind: "past_event_currency", name: "과거 탐사 기록 교환권", dnaCost: 5, targetRequired: false, fossilAmount: 300 },
] as const;
