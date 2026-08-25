import type { ExcavationCurrency } from "../core/idleExcavation";

/** 발굴 카드의 작은 자원 특화 SVG 키다. 재화 아이콘과 달리 단색 선화라 카드가 색을 입힌다. */
export const EXCAVATION_TRAIT_ICON: Record<ExcavationCurrency, "excavation-trait-gold" | "excavation-trait-supplies"> = {
  gold: "excavation-trait-gold",
  cheesecake: "excavation-trait-supplies",
  // 전용 선화가 추가되기 전까지 저장 키에 가장 가까운 기존 자원 계열 선화를 재사용한다.
  fossil: "excavation-trait-gold",
  gems: "excavation-trait-supplies",
};

/** 타이틀 로딩 단계가 SVG를 한 번만 래스터화하도록 키·경로를 한 표에서 관리한다. */
export const EXCAVATION_TRAIT_ICON_ASSETS: ReadonlyArray<readonly [string, string]> = [
  [EXCAVATION_TRAIT_ICON.gold, "/sprites/excavation/gold.svg"],
  [EXCAVATION_TRAIT_ICON.cheesecake, "/sprites/excavation/supplies.svg"],
];
