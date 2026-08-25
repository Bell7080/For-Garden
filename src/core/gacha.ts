/** Phaser와 상태 변경을 모르는 결정적 가챠 규칙. 모든 난수는 호출자가 주입한다. */
import type { RelicRarity } from "./types";

/** 재화. 화석은 흔하고, 호박석은 귀하다. */
export interface Wallet {
  /** UI의 일반 화석이 저장되는 키이며 발굴 수확도 이 값을 직접 올린다. */
  fossil: number;
  amber: number;
  /** UI의 다이아 저장 키다. 상단 줄·유료 결제·발굴 수확이 모두 이 값을 사용한다. */
  gems: number;
  /** 상단 줄의 둘째 칸. 성장과 교환에 두루 쓰는 흔한 재화라 자릿수가 크게 늘어난다. */
  gold: number;
  /** 상단 줄의 셋째 칸. 콘텐츠 입장에 쓰며 시간이 지나면 차오른다. */
  stamina: number;
  /** DNA 숙련도 상한에서 중복 렐릭이 바뀌는 공용 성장 재료다. */
  dnaFragments: number;
  /** 프로토타입에서 렐릭 레벨 복원에만 쓰는 치즈케이크다. 추후 경험치 재화로 교체할 임시 단일 재료다. */
  cheesecake: number;
}

/** 배너 비용으로 쓸 수 있는 재화만 허용하고 보상 재료는 제외한다. */
export type Currency = "fossil" | "amber";
export const RARITIES: readonly RelicRarity[] = ["SSR", "SR", "R"];

export interface Banner {
  id: string;
  /** 교체되어도 천장과 픽업 확정을 함께 이월하는 운영 정책 단위다. */
  pityGroupId: string;
  name: string;
  desc: string;
  /** 배너 대표 그림에 쓰며 pickupRelicIds에도 반드시 포함되는 렐릭이다. */
  featuredRelicId: string;
  currency: Currency;
  costOne: number;
  costTen: number;
  /** 누적 확률은 SSR → SR → R 순서로 판정하며 합계는 1이어야 한다. */
  rarityRates: Record<RelicRarity, number>;
  /** 등급 결정 뒤에만 참조하는 등급별 전체 렐릭 풀이다. */
  relicPools: Record<RelicRarity, string[]>;
  /** 해당 등급이 뽑혔을 때 별도의 픽업 판정을 받을 렐릭 목록이다. */
  pickupRelicIds: Partial<Record<RelicRarity, string[]>>;
  /** 픽업이 존재하는 등급에서 픽업 그룹을 선택할 조건부 확률이다. */
  pickupRate: number;
  /** 이 횟수째에도 SSR이 없으면 해당 슬롯의 다른 보장보다 우선해 SSR을 강제한다. */
  highestRarityGuarantee: number;
}

export interface PullResult {
  relicIds: string[];
  rarities: RelicRarity[];
  /** 슬롯별 SSR에서 0으로 초기화되고, 비SSR에서 1씩 증가한 최종 천장 카운터다. */
  pity: GachaPityState;
}

/** SSR 미획득 횟수와 다음 SSR 픽업 확정을 서로 독립적으로 보존한다. */
export interface GachaPityState {
  pullsSinceSsr: number;
  pickupGuaranteed: boolean;
}

export function pullCost(banner: Banner, count: number): number {
  return count === 10 ? banner.costTen : banner.costOne * count;
}

export function canPull(wallet: Wallet, banner: Banner, count: number): boolean {
  return wallet[banner.currency] >= pullCost(banner, count);
}

/** 0 이상 1 미만이라는 RNG 계약을 방어적으로 배열 인덱스에 맞춘다. */
function choose<T>(values: readonly T[], rng: () => number): T {
  if (values.length === 0) throw new Error("추첨할 렐릭 풀이 비어 있습니다.");
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/** 경계값은 다음 등급으로 넘어가도록 `<`로 비교한다(예: SSR 3%에서 0.03은 SR). */
export function determineRarity(banner: Banner, random: number): RelicRarity {
  let cumulative = 0;
  for (const rarity of RARITIES) {
    // 0.1 + 0.2가 0.30000000000000004가 되는 부동소수 오차로 경계가 뒤집히지 않게 정규화한다.
    cumulative = Number((cumulative + banner.rarityRates[rarity]).toFixed(12));
    if (random < cumulative) return rarity;
  }
  return "R";
}

/**
 * 순서는 반드시 `등급 결정 → 해당 등급 픽업 판정 → 렐릭 선택`이다.
 * 천장은 10연 SR 보장보다 우선하고, 10연 보장은 마지막 슬롯의 자연 등급이 R일 때만 SR로 올린다.
 */
export function pull(
  banner: Banner,
  count: number,
  currentPity: GachaPityState,
  rng: () => number,
): PullResult {
  const relicIds: string[] = [];
  const rarities: RelicRarity[] = [];
  let pity = { ...currentPity };

  for (let slot = 0; slot < count; slot += 1) {
    const pityForcesSsr = pity.pullsSinceSsr + 1 >= banner.highestRarityGuarantee;
    let rarity = pityForcesSsr ? "SSR" : determineRarity(banner, rng());
    if (!pityForcesSsr && count === 10 && slot === 9 && rarity === "R") rarity = "SR";

    const fullPool = banner.relicPools[rarity];
    const pickupPool = banner.pickupRelicIds[rarity] ?? [];
    const nonPickupPool = fullPool.filter((id) => !pickupPool.includes(id));
    // 픽업이 없으면 불필요한 난수를 소비하지 않는다. 픽업 판정 뒤 선택 난수만 소비한다.
    // 픽업 확정은 SSR 슬롯에만 적용하며, 확정 때는 판정 난수를 소비하지 않는다.
    const guaranteesPickup = rarity === "SSR" && pity.pickupGuaranteed && pickupPool.length > 0;
    const pickedUp = guaranteesPickup || (pickupPool.length > 0 && rng() < banner.pickupRate);
    const selectionPool = pickedUp ? pickupPool : (nonPickupPool.length > 0 ? nonPickupPool : fullPool);
    relicIds.push(choose(selectionPool, rng));
    rarities.push(rarity);
    if (rarity === "SSR") {
      // SSR 픽업 실패만 다음 SSR 확정을 켜고, 픽업 획득은 기존 확정까지 해제한다.
      pity = { pullsSinceSsr: 0, pickupGuaranteed: pickupPool.length > 0 && !pickedUp };
    } else {
      pity = { ...pity, pullsSinceSsr: pity.pullsSinceSsr + 1 };
    }
  }

  return { relicIds, rarities, pity };
}

/** 비용을 치른 새 지갑. 모자라면 원래 참조를 돌려준다. */
export function spend(wallet: Wallet, banner: Banner, count: number): Wallet {
  if (!canPull(wallet, banner, count)) return wallet;
  return { ...wallet, [banner.currency]: wallet[banner.currency] - pullCost(banner, count) };
}

export type AcquisitionKind = "new" | "fragment" | "overflow";

/** 한 슬롯이 실제 수집 상태에 준 변화를 UI까지 손실 없이 전달한다. */
export interface AcquisitionResult {
  relicId: string;
  kind: AcquisitionKind;
  /** 이 슬롯으로 늘어난 그 개체의 파편 수(중복 한 장 = 1). */
  fragments: number;
  /** 이 슬롯이 공용 DNA 조각으로 바뀐 수. 별 다섯에 닿은 개체의 중복만 여기로 간다. */
  overflowFragments: number;
}

export interface AcquisitionOutcome {
  slots: AcquisitionResult[];
  newRelicIds: string[];
  duplicateRelicIds: string[];
  /** 호출자가 원본 상태를 건드리지 않고 한 번에 커밋할 수 있는 다음 값이다. */
  ownedRelicIds: Set<string>;
  /** 개체별 파편 보유량의 다음 값. 늘지 않은 개체도 그대로 담아 통째로 교체할 수 있다. */
  fragmentsById: Record<string, number>;
  overflowFragments: number;
}

/**
 * 슬롯 순서대로 신규/파편/마일리지를 계산하는 Phaser 비의존 순수 규칙이다.
 *
 * 중복 한 장은 **그 개체의 파편** 한 개다. 별이 이미 다섯인 개체(`starsById`가 상한)만
 * 공용 DNA 조각으로 바뀐다 — 더 올릴 별이 없는 파편은 쓸 곳이 없기 때문이다.
 */
export function resolveAcquisitions(
  ownedRelicIds: ReadonlySet<string>,
  fragmentsById: Readonly<Record<string, number>>,
  results: readonly string[],
  /** 개체별 현재 별(1~5). 주지 않은 개체는 별 하나로 본다. */
  starsById: Readonly<Record<string, number>> = {},
  maxStars = 5,
): AcquisitionOutcome {
  const owned = new Set(ownedRelicIds);
  const fragments = { ...fragmentsById };
  const slots: AcquisitionResult[] = [];
  const newRelicIds: string[] = [];
  const duplicateRelicIds: string[] = [];
  let overflowFragments = 0;

  for (const relicId of results) {
    if (!owned.has(relicId)) {
      owned.add(relicId);
      newRelicIds.push(relicId);
      slots.push({ relicId, kind: "new", fragments: 0, overflowFragments: 0 });
      continue;
    }
    duplicateRelicIds.push(relicId);
    if ((starsById[relicId] ?? 1) >= maxStars) {
      // 별 다섯에 닿은 개체의 중복 한 장은 공용 DNA 조각 한 개(마일리지)로 바뀐다.
      overflowFragments += 1;
      slots.push({ relicId, kind: "overflow", fragments: 0, overflowFragments: 1 });
    } else {
      fragments[relicId] = (fragments[relicId] ?? 0) + 1;
      slots.push({ relicId, kind: "fragment", fragments: 1, overflowFragments: 0 });
    }
  }
  return { slots, newRelicIds, duplicateRelicIds, ownedRelicIds: owned, fragmentsById: fragments, overflowFragments };
}
