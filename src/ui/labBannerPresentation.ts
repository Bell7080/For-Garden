/**
 * 연구소 모집판의 얼굴 — 제목·결·라벨.
 *
 * 배너 원화가 곧 이 화면이라, 그 위에 서는 것은 **무엇을 뽑는 판인가**를 말하는 이름표와 라벨뿐이다.
 * 라벨은 수집형 RPG 모집판이 늘 쓰는 것만 둔다 — 상시/기간 한정, PICK UP 대상, 한정 렐릭, 확정 조건,
 * 남은 횟수. "새 친구를 만나세요" 같은 권유 문구는 조작을 바꾸지 않으므로 세우지 않는다.
 *
 * **라벨은 배너 ID가 아니라 배너의 성질에서 나온다**(횟수 제한·픽업·한정 여부). ID로 가르면 배너를
 * 교체할 때마다 이 표를 함께 고쳐야 하고, 빠뜨린 배너는 조용히 라벨 없이 선다. 결(색)과 제목만
 * 배너마다 고른다.
 *
 * Phaser 없이 읽히도록 값만 둔다 — 화면과 회귀 테스트가 같은 표를 읽는다.
 */

import { bannerGuaranteePending, bannerPullsRemaining, type Banner, type GachaPityState } from "../core/gacha";
import type { TextKey } from "../i18n";

export type BannerTone = "welcome" | "standard" | "limited";

export interface BannerToneStyle {
  /** 제목 글자에 위 → 가운데 → 아래로 흐르는 색. */
  gradient: readonly [string, string, string];
  /** 눈썹 줄·밑줄·반짝이의 색. */
  accent: number;
  /** 주 라벨의 바탕. */
  tagFill: number;
}

/**
 * 결 세 벌.
 *
 * - 상시(화석): 화석과 모래의 따뜻한 상아빛 — 늘 있는 판이라 들뜨지 않게.
 * - 한정(호박석): 호박의 금빛에서 다홍으로 — 가장 화려하다.
 * - 첫 복원: 새로 시작하는 판이라 맑은 민트·하늘빛.
 */
export const BANNER_TONE: Record<BannerTone, BannerToneStyle> = {
  welcome: { gradient: ["#effffb", "#8ef0d8", "#3aa7c9"], accent: 0x7fe3d0, tagFill: 0x1f8f9c },
  standard: { gradient: ["#fffaf0", "#f1dcae", "#b98a4a"], accent: 0xe8c68a, tagFill: 0x8a6331 },
  limited: { gradient: ["#fff6cc", "#ffc247", "#e2582c"], accent: 0xffc247, tagFill: 0xc8452f },
};

/**
 * 제목을 어디서 읽나.
 *
 * **픽업 배너의 제목은 픽업 렐릭의 이름이다** — 한정 모집판이 파는 것은 그 개체이고, 이벤트 이름을
 * 제목으로 세우면 누구를 뽑는 판인지가 부제로 밀려난다. 그 개체를 꾸미는 말(「우당탕탕 늑대 카페
 * 알바생」)은 **부제**로 둔다. 이름은 렐릭 데이터에서 읽으므로 번역도 저절로 따라온다.
 * 픽업이 없는 배너(상시·첫 복원)만 제 문구 키를 제목으로 쓴다.
 */
export type BannerTitleSource = { kind: "key"; key: TextKey } | { kind: "pickup" };

export interface BannerPresentation {
  tone: BannerTone;
  eyebrowKey: TextKey;
  title: BannerTitleSource;
  /** 제목 아래 한 줄 — 픽업 개체를 꾸미는 수식어. 픽업 배너만 쓴다. */
  subtitleKey?: TextKey;
  /** 제목 글자 크기. 한정 배너가 가장 크다. */
  titleSize: number;
  /** 제목 둘레에서 반짝이는 마름모. 한정 배너만 켠다 — 셋 다 반짝이면 무엇이 특별한지 읽히지 않는다. */
  sparkles: boolean;
}

export const BANNER_PRESENTATION: Record<string, BannerPresentation> = {
  welcome: { tone: "welcome", eyebrowKey: "lab.banner.welcome.eyebrow", title: { kind: "key", key: "lab.banner.welcome.title" }, titleSize: 76, sparkles: false },
  fossil: { tone: "standard", eyebrowKey: "lab.banner.fossil.eyebrow", title: { kind: "key", key: "lab.banner.fossil.title" }, titleSize: 76, sparkles: false },
  amber: {
    tone: "limited", eyebrowKey: "lab.banner.amber.eyebrow", title: { kind: "pickup" }, subtitleKey: "lab.banner.amber.subtitle",
    titleSize: 104, sparkles: true,
  },
};

/** 표에 없는 배너가 새로 들어와도 제목 없이 서지 않게 하는 기본값. 이름은 배너 데이터에서 읽는다. */
export function bannerPresentation(banner: Banner): BannerPresentation | undefined {
  return BANNER_PRESENTATION[banner.id];
}

export type BannerTagKind = "primary" | "accent" | "plain";

export interface BannerTag {
  key: TextKey;
  params?: Record<string, string | number>;
  /** `accent`는 결의 강한 색(한정·1회), `primary`는 주 정보(PICK UP), `plain`은 어두운 유리. */
  kind: BannerTagKind;
}

/**
 * 모집판 라벨. 순서가 곧 읽히는 순서다 — 성격(상시/한정/1회) → 무엇이 나오나 → 확정 조건.
 *
 * @param pickupNames 픽업 렐릭의 표시 이름. 화면이 데이터에서 읽어 넘긴다.
 * @param limitedPickup 픽업 대상이 한정 렐릭인가.
 */
export function bannerTags(
  banner: Banner,
  pity: GachaPityState | undefined,
  pickupNames: readonly string[],
  limitedPickup: boolean,
): BannerTag[] {
  const tags: BannerTag[] = [];
  if (banner.pullLimit !== undefined) {
    tags.push({ key: "lab.tag.once", kind: "accent" });
    if (bannerGuaranteePending(banner, pity)) {
      tags.push({ key: "lab.tag.ssrGuarantee", params: { count: banner.highestRarityGuarantee }, kind: "primary" });
    }
    tags.push({ key: "lab.tag.remaining", params: { left: bannerPullsRemaining(banner, pity), total: banner.pullLimit }, kind: "plain" });
    return tags;
  }
  if (pickupNames.length > 0) {
    tags.push({ key: "lab.tag.limited", kind: "accent" });
    // 누구인지는 제목(픽업 렐릭의 이름)이 이미 크게 말하므로 라벨은 "PICK UP"만 선다.
    tags.push({ key: "lab.tag.pickup", kind: "primary" });
    if (limitedPickup) tags.push({ key: "lab.tag.limitedRelic", kind: "plain" });
  } else {
    tags.push({ key: "lab.tag.standard", kind: "primary" });
  }
  // 10연 마지막 칸은 SR 이상이다(`pull`의 10연 보정) — 모든 배너가 같은 규칙이라 조건 없이 선다.
  tags.push({ key: "lab.tag.tenGuarantee", kind: "plain" });
  return tags;
}

/** 할인율(%) — 10연 값이 1회 값의 열 배보다 싸면 그만큼. 할인이 없으면 0이다. */
export function bannerTenDiscountPercent(banner: Banner): number {
  const full = banner.costOne * 10;
  if (banner.costTen >= full) return 0;
  return Math.round((1 - banner.costTen / full) * 100);
}
