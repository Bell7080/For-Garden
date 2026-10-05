/**
 * DNA 마일리지 적립 규칙 — Phaser와 상태를 모르는 순수 모듈이다.
 *
 * 마일리지는 **뽑기에서 모이는 재화**다. 한 슬롯이 얻는 양은 두 몫의 합이다.
 *  1. 뽑기 한 번마다 기본 1 (신규·파편·회색 칸을 가리지 않는다).
 *  2. 이미 돌파 V인 개체의 중복은 파편이 쓸 곳이 없어 한 번 더 전환되며, 그 값은 등급이 정한다.
 *
 * 등급별 값은 그 등급 한 장이 나오기까지의 평균 뽑기 수(SSR 1% ≈ 100회 · SR 4% ≈ 25회 ·
 * R 12% ≈ 8회)에 비례해 잡았다. 값을 바꾸면 상점 가격(`data/mileageShop.ts`)과
 * `docs/economy-design.md`를 함께 본다.
 */
import type { RelicRarity } from "./types";

/** 뽑기 한 번마다 얹는 기본 적립. 10연은 열 번이다. */
export const MILEAGE_PER_PULL = 1;

/** 돌파 V 개체의 중복 한 장이 마일리지로 바뀌는 양. */
export const MILEAGE_OVERFLOW_BY_RARITY: Readonly<Record<RelicRarity, number>> = { SSR: 30, SR: 8, R: 2 };

/** 한 번의 연구가 지급하는 마일리지 총량. 결과 상단 칩과 지갑 반영이 같은 값을 읽는다. */
export function mileageForPull(count: number, overflowTotal: number): number {
  return count * MILEAGE_PER_PULL + overflowTotal;
}
