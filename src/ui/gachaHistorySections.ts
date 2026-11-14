/**
 * 연구 기록을 **천장이 함께 쌓이는 갈래**로 나누는 규칙 — Phaser 없이 읽혀 단위 테스트가 같은 값을 쓴다.
 *
 * 기록을 한 줄로 늘어놓던 때는 「천장 카운트 23」이 어느 연구의 23인지 읽히지 않았다(응태 요청, 2026-11-15).
 * 천장은 배너가 아니라 **천장 그룹**(`Banner.pityGroupId`)마다 쌓이므로 탭도 그룹을 따른다 — 상시(화석) ·
 * 한정 픽업 · 첫 복원. 한정 픽업은 플레샤·디안이 교대로 서도 **한 그룹이라 천장이 이월된다**(`pickupRotation.ts`),
 * 그래서 한 탭에 함께 서고 묶음마다 그 픽업의 결(색)과 얼굴로 갈린다.
 */
import type { Banner, GachaPityState } from "../core/gacha";
import type { GachaHistoryEntry } from "../core/gachaHistory";
import { PITY_GROUP, QA_PICKUP_BANNER_PREFIX } from "../data/banners";
import { BANNER_TONE, bannerPresentation, type BannerTone } from "./labBannerPresentation";

export type GachaHistorySection = "pickup" | "standard" | "welcome";

/** 탭 순서 — 가장 자주 도는 한정 픽업이 먼저, 첫 복원은 끝이다. */
export const GACHA_HISTORY_SECTIONS: readonly GachaHistorySection[] = ["pickup", "standard", "welcome"];

const SECTION_GROUP: Record<GachaHistorySection, string> = {
  pickup: PITY_GROUP.LIMITED_PICKUP,
  standard: PITY_GROUP.STANDARD,
  welcome: PITY_GROUP.WELCOME,
};

/** 탭의 결 — 한정 픽업은 호박석 픽업의 금빛, 나머지는 제 배너의 결이다. */
export const GACHA_HISTORY_SECTION_TONE: Record<GachaHistorySection, BannerTone> = {
  pickup: "limited",
  standard: "standard",
  welcome: "welcome",
};

export function gachaHistorySectionGroup(section: GachaHistorySection): string {
  return SECTION_GROUP[section];
}

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

/** 그 갈래의 묶음만 — 받은 순서(최신부터)를 지킨다. */
export function gachaHistoryEntriesOf(section: GachaHistorySection, entries: readonly GachaHistoryEntry[], banners: readonly Banner[]): GachaHistoryEntry[] {
  return entries.filter((entry) => gachaHistorySectionOfBanner(entry.bannerId, banners) === section);
}

/**
 * 세울 탭. 상시·한정 픽업은 늘 선다. 첫 복원은 계정당 한 번의 배너라 **기록이 있거나 지금 그 배너를 보고
 * 있을 때만** 선다 — 다 쓴 뒤에도 빈 탭이 남으면 고를 것 없는 칸이 하나 는다.
 */
export function visibleGachaHistorySections(entries: readonly GachaHistoryEntry[], banners: readonly Banner[], current: GachaHistorySection): GachaHistorySection[] {
  return GACHA_HISTORY_SECTIONS.filter((section) => section !== "welcome"
    || current === "welcome"
    || entries.some((entry) => gachaHistorySectionOfBanner(entry.bannerId, banners) === "welcome"));
}

export interface GachaHistorySummary {
  /** 그 갈래의 SSR 이후 누적 횟수. */
  count: number;
  /** 확정까지의 총 횟수(천장). */
  total: number;
  /** SSR 확정까지 남은 횟수. */
  left: number;
  /** 다음 SSR이 픽업으로 확정되었나. */
  pickupNext: boolean;
  /** 천장·픽업 확정이 다음 픽업으로 이월되는 갈래인가. */
  carriesOver: boolean;
}

/** 탭 머리 판 — 지금 그 갈래의 천장. 배너 정의의 확정 횟수와 저장의 천장 그룹 값을 그대로 읽는다. */
export function gachaHistorySummary(section: GachaHistorySection, banners: readonly Banner[], pityByGroup: Readonly<Record<string, GachaPityState>>): GachaHistorySummary {
  const group = SECTION_GROUP[section];
  const total = banners.find((banner) => banner.pityGroupId === group)?.highestRarityGuarantee ?? 0;
  const pity = pityByGroup[group];
  const count = pity?.pullsSinceSsr ?? 0;
  return {
    count,
    total,
    left: Math.max(0, total - count),
    pickupNext: section === "pickup" && pity?.pickupGuaranteed === true,
    carriesOver: section === "pickup",
  };
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

export function gachaHistorySectionTint(section: GachaHistorySection): GachaHistoryTint {
  return toneTint(GACHA_HISTORY_SECTION_TONE[section]);
}

/** 픽업 배너의 대표(SSR 픽업) 렐릭 — 머리줄의 얼굴과 「○○ 픽업」 제목. 픽업이 없으면 없다. */
export function gachaHistoryPickupRelicId(bannerId: string, banners: readonly Banner[]): string | undefined {
  const banner = banners.find(({ id }) => id === bannerId);
  return banner?.pickupRelicIds.SSR?.[0];
}
