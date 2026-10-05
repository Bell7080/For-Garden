import type { Wallet } from "../core/gacha";
import { STAMINA_HOLD_LIMIT } from "../core/stamina";

/** 라이브 운영에서 지급량과 소비량을 함께 검토하는 네 핵심 경제 재화다. */
export type EconomyCurrency = "fossil" | "amber" | "cheesecake" | "dnaFragments";

/** API 연산 뒤 정수 오버플로와 비정상 적립을 차단하는 재화별 계정 상한이다. */
export const WALLET_CAPS: Readonly<Record<keyof Wallet, number>> = {
  // 발굴의 일반 화석(`fossil`)과 다이아(`gems`)도 다른 API 지급과 같은 계정 상한을 공유한다.
  fossil: 99_999,
  amber: 9_999,
  gems: 9_999_999,
  gold: 999_999_999,
  // 시간 회복은 레벨 상한에서 멈추지만 대가를 치른 충전은 그 위로 이 끝까지 쌓인다.
  stamina: STAMINA_HOLD_LIMIT,
  dnaFragments: 99_999,
  cheesecake: 9_999_999,
  rawStone: 9_999_999,
  // 증표는 가끔 들어가 터는 자리의 몫이라 상한이 사실상 걸리지 않게 둔다 — 몇 주치가
  // 쌓여도 버려지면 그 상점의 경험 자체가 무너진다.
  raidSigil: 9_999_999,
  salvageRecord: 9_999_999,
};

/** 문서의 월간 무과금 수급 계산이 참조하는 30일/4주 기준 목표 지급량이다. */
export const FREE_MONTHLY_TARGETS: Readonly<Record<"daily" | "weekly" | "event" | "story", Readonly<Partial<Record<EconomyCurrency, number>>>>> = {
  daily: { fossil: 0.9, amber: 0.1, cheesecake: 200, dnaFragments: 0 },
  weekly: { fossil: 7, amber: 1, cheesecake: 1_000, dnaFragments: 5 },
  event: { fossil: 18, amber: 6, cheesecake: 2_000, dnaFragments: 20 },
  story: { fossil: 10, amber: 2, cheesecake: 1_000, dnaFragments: 5 },
};

