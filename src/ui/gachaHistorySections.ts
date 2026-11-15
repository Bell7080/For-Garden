/**
 * 연구 기록의 묶음이 **어느 뽑기의 것인가**를 가르는 규칙 — Phaser 없이 읽혀 단위 테스트가 같은 값을 쓴다.
 *
 * 묶음 머리줄이 색·이름만으로는 「천장 카운트 23」이 어느 연구의 23인지 읽히지 않았다(응태 요청, 2026-11-15).
 * 모든 기록은 한 목록에 쌓이고(뽑기가 늘어도 탭이 늘지 않게), 묶음마다 그 배너의 모집판 결·픽업 얼굴과
 * 그 천장 그룹의 분모(`n / 120`)가 선다. 머리 판은 두지 않는다(응태, 2026-11-15). 천장은 배너가 아니라 **천장 그룹**(`Banner.pityGroupId`)마다 쌓인다 —
 * 플레샤·디안 픽업은 교대로 서도 한 그룹이라 천장이 이월된다(`pickupRotation.ts`).
 */
import type { Banner } from "../core/gacha";
import { PITY_GROUP, QA_PICKUP_BANNER_PREFIX } from "../data/banners";
import { BANNER_TONE, bannerPresentation, type BannerTone } from "./labBannerPresentation";

export type GachaHistorySection = "pickup" | "standard" | "welcome";

/** 갈래 — 천장 그룹마다 하나. */
export const GACHA_HISTORY_SECTIONS: readonly GachaHistorySection[] = ["pickup", "standard", "welcome"];

const SECTION_GROUP: Record<GachaHistorySection, string> = {
  pickup: PITY_GROUP.LIMITED_PICKUP,
  standard: PITY_GROUP.STANDARD,
  welcome: PITY_GROUP.WELCOME,
};

/** 정의를 못 찾은 배너의 결 — 한정 픽업은 호박석 픽업의 금빛, 나머지는 제 배너의 결이다. */
export const GACHA_HISTORY_SECTION_TONE: Record<GachaHistorySection, BannerTone> = {
  pickup: "limited",
  standard: "standard",
  welcome: "welcome",
};

export function gachaHistorySectionOfGroup(groupId: string): GachaHistorySection {
  return GACHA_HISTORY_SECTIONS.find((section) => SECTION_GROUP[section] === groupId) ?? "standard";
}

/**
 * 묶음이 어느 갈래인가. 끝나 목록에서 사라진 배너도 기록에는 남으므로, 정의를 못 찾으면 QA 픽업 머리말만
 * 한정으로 보고 나머지는 상시로 둔다.
 */
export function gachaHistorySectionOfBanner(bannerId: string, banners: readonly Banner[]): GachaHistorySection {
  const banner = banners.find(({ id }) => id === bannerId);
  if (banner) return gachaHistorySectionOfGroup(banner.pityGroupId);
  return bannerId.startsWith(QA_PICKUP_BANNER_PREFIX) ? "pickup" : "standard";
}

/** 묶음 머리줄의 분모(`n / 120`) — 그 배너가 속한 천장 그룹의 확정 횟수. 정의를 못 찾으면 0. */
export function gachaHistoryPityTotal(bannerId: string, banners: readonly Banner[]): number {
  const group = SECTION_GROUP[gachaHistorySectionOfBanner(bannerId, banners)];
  return banners.find((banner) => banner.pityGroupId === group)?.highestRarityGuarantee ?? 0;
}

export interface GachaHistoryTint {
  /** 띠·윗변 선·제목 글자 — 모집판 제목 그라데이션의 가운데 색. */
  accent: number;
  accentText: string;
  /** 머리줄 바탕에 옅게 물드는 색 — 모집판 라벨의 바탕. */
  fill: number;
}

function toneTint(tone: BannerTone): GachaHistoryTint {
  const style = BANNER_TONE[tone];
  return { accent: Number.parseInt(style.gradient[1].slice(1), 16), accentText: style.gradient[1], fill: style.tagFill };
}

/**
 * 묶음 머리줄의 결 — 그 배너의 모집판과 같은 색이다(디안 금빛 · 플레샤 페리윙클 · 상시 상아 · 첫 복원 장미).
 * 눈썹 줄 색(`accent`)은 디안·플레샤가 둘 다 노랑이라 갈리지 않으므로 제목 그라데이션의 가운데 색을 쓴다.
 */
export function gachaHistoryEntryTint(bannerId: string, banners: readonly Banner[]): GachaHistoryTint {
  const banner = banners.find(({ id }) => id === bannerId);
  const tone = banner ? bannerPresentation(banner)?.tone : undefined;
  return toneTint(tone ?? GACHA_HISTORY_SECTION_TONE[gachaHistorySectionOfBanner(bannerId, banners)]);
}


/** 픽업 배너의 대표(SSR 픽업) 렐릭 — 머리줄의 얼굴과 「○○ 픽업」 제목. 픽업이 없으면 없다. */
export function gachaHistoryPickupRelicId(bannerId: string, banners: readonly Banner[]): string | undefined {
  const banner = banners.find(({ id }) => id === bannerId);
  return banner?.pickupRelicIds.SSR?.[0];
}
