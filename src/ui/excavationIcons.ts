import type { ExcavationCurrency } from "../core/idleExcavation";

/** 발굴 카드의 작은 자원 특화 SVG 키다. 재화 아이콘과 달리 단색 선화라 카드가 색을 입힌다. */
export const EXCAVATION_TRAIT_ICON: Record<ExcavationCurrency, "excavation-trait-gold" | "excavation-trait-supplies"> = {
  gold: "excavation-trait-gold",
  cheesecake: "excavation-trait-supplies",
};

/** 타이틀 로딩 단계가 SVG를 한 번만 래스터화하도록 키·경로를 한 표에서 관리한다. */
export const EXCAVATION_TRAIT_ICON_ASSETS: ReadonlyArray<readonly [string, string]> = [
  [EXCAVATION_TRAIT_ICON.gold, "/sprites/excavation/gold.svg"],
  [EXCAVATION_TRAIT_ICON.cheesecake, "/sprites/excavation/supplies.svg"],
];
