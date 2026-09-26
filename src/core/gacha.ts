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
  /**
   * 고고학의 **원석**. 지층 탐사로 캐고 특성 재해석이 먹는다.
   *
   * 이름을 「파편」·「조각」으로 짓지 않은 것은 그 둘이 이미 렐릭 돌파 파편과 공용 DNA 조각을
   * 가리키기 때문이다 — 같은 말이 두 경제에서 다른 것을 가리키면 화면의 수치가 무엇인지
   * 말하지 못한다. 아직 가공되지 않은 돌이라는 뜻이 곧 특성 연구(가공)의 그림이다.
   */
  rawStone: number;
  /**
   * 전리품 상점의 두 증표 — **토벌**(레이드)과 **인양**(원정).
   *
   * 둘을 하나로 합치지 않는 이유는 두 콘텐츠의 순환 주기와 기대 수급이 다르기 때문이다.
   * 반대로 셋 이상으로 쪼개지도 않았다 — 탭마다 지갑이 갈리면 한 상점 안에서 "이 탭은
   * 얼마나 모였더라"를 탭 수만큼 다시 읽어야 한다.
   */
  raidSigil: number;
  salvageRecord: number;
}

/** 배너 비용으로 쓸 수 있는 재화만 허용하고 보상 재료는 제외한다. */
export type Currency = "fossil" | "amber";
export const RARITIES: readonly RelicRarity[] = ["SSR", "SR", "R"];
/** 회색은 렐릭 희귀도가 아니라 연구 장치가 찾아낸 비개체 결과의 표시 등급이다. */
export type ResearchGrade = RelicRarity | "GRAY";
export type QuantityRewardKind = "gold" | "cheesecake";
export interface QuantityRewardDefinition { kind: QuantityRewardKind; min: number; max: number; weight: number; }
export type PullSlot =
  | { kind: "relic"; relicId: string; rarity: RelicRarity }
  | { kind: "currency"; currency: QuantityRewardKind; amount: number; grade: "GRAY" };

export interface Banner {
  id: string;
  /** 교체되어도 천장과 픽업 확정을 함께 이월하는 운영 정책 단위다. */
  pityGroupId: string;
  name: string;
  /** 픽업 표식과 결과 판정의 기준이며 pickupRelicIds에도 반드시 포함되는 렐릭이다. */
  featuredRelicId: string;
  /**
   * 그 배너가 화면에 세우는 **모집 원화**.
   *
   * 픽업 렐릭의 전신 Puppet을 가운데 세우던 때는 배너 하나가 개체 하나만 보여 줄 수 있었고,
   * 셋이 함께 서는 모집 원화를 쓸 방법이 없었다. **배너마다 다른 그림**이어야 넘길 때
   * 무엇이 바뀌었는지 그림이 먼저 말하므로, 화면이 아니라 배너가 이 값을 갖는다.
   *
   * **비워 두면 연구소 설비 원화가 대신 선다.** 픽업 원화는 배너를 여는 시점에 맞춰 그리므로
   * 아직 없는 배너가 늘 있는데, 그때 빈 판을 세우면 그 배너만 덜 만든 화면으로 보인다.
   * 연구소 배경은 **그 자리를 메우는 용도로만** 쓰고, 원화가 있는 배너 뒤에는 깔지 않는다 —
   * 두 장을 겹쳐 두면 들어가는 순간 설비 원화가 먼저 보이고 그 위로 픽업 원화가 덮인다.
   */
  artKey?: string;
  currency: Currency;
  costOne: number;
  costTen: number;
  /** 슬롯 확률은 렐릭 희귀도와 회색 연구 결과를 분리하며 네 값의 합은 정확히 1이다. */
  slotRates: Record<ResearchGrade, number>;
  /** 회색 슬롯 안에서 고를 보상과 양 끝을 모두 포함하는 정수 수량 범위다. */
  grayRewards: readonly QuantityRewardDefinition[];
  /** 등급 결정 뒤에만 참조하는 등급별 전체 렐릭 풀이다. */
  relicPools: Record<RelicRarity, string[]>;
  /** 해당 등급이 뽑혔을 때 별도의 픽업 판정을 받을 렐릭 목록이다. */
  pickupRelicIds: Partial<Record<RelicRarity, string[]>>;
  /** 픽업이 존재하는 등급에서 픽업 그룹을 선택할 조건부 확률이다. */
  pickupRate: number;
  /** 이 횟수째에도 SSR이 없으면 해당 슬롯의 다른 보장보다 우선해 SSR을 강제한다. */
  highestRarityGuarantee: number;
  /**
   * 계정당 뽑을 수 있는 총 횟수. 없으면 제한이 없다.
   *
   * 첫 복원 연구(50회)처럼 한 번만 여는 배너가 쓴다. 그 배너는 제 천장 그룹을 따로 쓰므로
   * 누적 횟수는 그 그룹의 `GachaPityState.totalPulls`가 센다. 다 쓰면 목록에서 사라진다.
   */
  pullLimit?: number;
  /**
   * 10회 연구만 연다. 할인이 걸린 1회성 배너가 쓴다.
   *
   * 상시 배너는 "한 개가 한 번"이라 묶음 할인을 두지 않는다 — 두면 한 번씩 뽑는 손이 손해라
   * 10연만 남는다. 할인은 10연만 여는 배너에만 둔다.
   */
  tenOnly?: boolean;
}

/** 천장·10연 보정을 제외한 독립 슬롯 기준의 배너 기대값이다. */
export interface BannerExpectations {
  /** 지정한 추첨 횟수다. 호출자가 결과의 배율을 함께 확인할 수 있게 보존한다. */
  pulls: number;
  /** R, SR, SSR 렐릭이 나오는 기대 슬롯 수다. */
  relicRPlus: number;
  /** 골드가 지급되는 기대 수량이다. 지급되지 않는 슬롯은 0으로 포함한다. */
  gold: number;
  /** 치즈케이크가 지급되는 기대 수량이다. 지급되지 않는 슬롯은 0으로 포함한다. */
  cheesecake: number;
}

/**
 * 정적 배너 정의만으로 독립 추첨의 기대 획득량을 계산하는 Phaser 비의존 분석 함수다.
 * 보장 효과는 현재 천장 상태와 묶음 내 위치에 따라 달라지므로 포함하지 않아 운영 확률 자체를 비교할 수 있다.
 */
export function calculateBannerExpectations(banner: Banner, pulls = 1): BannerExpectations {
  const totalRewardWeight = banner.grayRewards.reduce((sum, reward) => sum + reward.weight, 0);
  const expectedRewards: Record<QuantityRewardKind, number> = { gold: 0, cheesecake: 0 };

  // 회색 결과의 조건부 보상 확률과 양 끝을 포함한 균등 정수 수량의 평균을 곱한다.
  if (totalRewardWeight > 0) {
    for (const reward of banner.grayRewards) {
      const averageAmount = (reward.min + reward.max) / 2;
      expectedRewards[reward.kind] += banner.slotRates.GRAY * (reward.weight / totalRewardWeight) * averageAmount;
    }
  }

  // 기대 슬롯/수량은 독립 1회 값을 지정 횟수만큼 선형 합산한다.
  const relicRPlusRate = banner.slotRates.R + banner.slotRates.SR + banner.slotRates.SSR;
  return {
    pulls,
    relicRPlus: relicRPlusRate * pulls,
    gold: expectedRewards.gold * pulls,
    cheesecake: expectedRewards.cheesecake * pulls,
  };
}

export interface PullResult {
  slots: PullSlot[];
  relicIds: string[];
  rarities: RelicRarity[];
  /** 슬롯별 SSR에서 0으로 초기화되고, 비SSR에서 1씩 증가한 최종 천장 카운터다. */
  pity: GachaPityState;
}

/** SSR 미획득 횟수와 다음 SSR 픽업 확정을 서로 독립적으로 보존한다. */
export interface GachaPityState {
  pullsSinceSsr: number;
  pickupGuaranteed: boolean;
  /** 이 그룹에서 지금까지 뽑은 총 횟수. 횟수 제한이 있는 배너만 센다(`Banner.pullLimit`). */
  totalPulls?: number;
}

export function pullCost(banner: Banner, count: number): number {
  return count === 10 ? banner.costTen : banner.costOne * count;
}

/**
 * 연구 재화(화석·호박석) 한 개의 젬 값. **모자란 몫은 한 개에 이 값만큼 젬으로 채운다.**
 *
 * 두 연구는 확률·회색 보상이 같아(`banners.ts`의 `STANDARD_SLOT_RATES`) 한 번의 값도 하나다. 무역
 * 시세(`TRADE_GEM_RATE`)도 이 수를 읽는다 — 두 곳에 따로 적으면 상점과 연구 버튼이 다른 값을 말한다.
 */
export const RESEARCH_TICKET_GEM_PRICE = 300;

/** 한 번의 연구를 무엇으로 치르나 — 가진 연구 재화를 먼저 쓰고 모자란 몫만 젬이다. */
export interface PullPayment {
  /** 쓰는 연구 재화 수. */
  tickets: number;
  /** 모자란 연구 재화를 대신하는 젬. */
  gems: number;
  /** 젬까지 합쳐 치를 수 있는가. */
  affordable: boolean;
}

export function pullPayment(wallet: Pick<Wallet, "fossil" | "amber" | "gems">, banner: Banner, count: number): PullPayment {
  const cost = pullCost(banner, count);
  const tickets = Math.max(0, Math.min(cost, wallet[banner.currency]));
  const gems = (cost - tickets) * RESEARCH_TICKET_GEM_PRICE;
  return { tickets, gems, affordable: wallet.gems >= gems };
}

/** 횟수 제한이 있는 배너에서 남은 횟수. 제한이 없으면 무한이다. */
export function bannerPullsRemaining(banner: Banner, pity: GachaPityState | undefined): number {
  if (banner.pullLimit === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, banner.pullLimit - (pity?.totalPulls ?? 0));
}

/** 이 배너가 지금 이 횟수를 받는가 — 10연 전용·남은 횟수만 본다. 재화는 `canPull`이 본다. */
export function bannerAcceptsCount(banner: Banner, count: number, pity: GachaPityState | undefined): boolean {
  if (banner.tenOnly && count !== 10) return false;
  return count <= bannerPullsRemaining(banner, pity);
}

/**
 * 횟수 제한 배너의 SSR 확정이 아직 남아 있는가.
 *
 * 그 배너의 확정은 **한 번뿐**이다 — 그 전에 SSR이 나오면 천장이 0으로 돌아가 남은 횟수로는
 * 다시 닿지 못한다. SSR이 한 번이라도 나왔다면 미획득 횟수가 총 횟수보다 작다.
 */
export function bannerGuaranteePending(banner: Banner, pity: GachaPityState | undefined): boolean {
  if (banner.pullLimit === undefined) return true;
  const total = pity?.totalPulls ?? 0;
  return (pity?.pullsSinceSsr ?? 0) === total && total < banner.pullLimit;
}

/** 연구 재화에 젬을 더해 치를 수 있고 배너가 그 횟수를 받는가. */
export function canPull(wallet: Wallet, banner: Banner, count: number, pity?: GachaPityState): boolean {
  return pullPayment(wallet, banner, count).affordable && bannerAcceptsCount(banner, count, pity);
}

/** 0 이상 1 미만이라는 RNG 계약을 방어적으로 배열 인덱스에 맞춘다. */
function choose<T>(values: readonly T[], rng: () => number): T {
  if (values.length === 0) throw new Error("추첨할 렐릭 풀이 비어 있습니다.");
  return values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
}

/** SSR→SR→R→회색 순서로 판정하며 경계값은 다음 등급에 포함한다. */
export function determineGrade(banner: Banner, random: number): ResearchGrade {
  let cumulative = 0;
  for (const grade of ["SSR", "SR", "R", "GRAY"] as const) {
    cumulative = Number((cumulative + banner.slotRates[grade]).toFixed(12));
    if (random < cumulative) return grade;
  }
  return "GRAY";
}

/** 범위 양 끝을 포함한다. RNG가 1에 가까워도 max를 넘지 않는다. */
function rewardAmount(reward: QuantityRewardDefinition, random: number): number {
  return reward.min + Math.min(reward.max - reward.min, Math.floor(random * (reward.max - reward.min + 1)));
}

/**
 * 순서는 반드시 `등급 결정 → 해당 등급 픽업 판정 → 렐릭 선택`이다.
 * 천장은 10연 SR 보장보다 우선하고, 10연 보장은 마지막 슬롯의 자연 회색/R을 SR로 올린다.
 */
export function pull(
  banner: Banner,
  count: number,
  currentPity: GachaPityState,
  rng: () => number,
): PullResult {
  const relicIds: string[] = [];
  const rarities: RelicRarity[] = [];
  const slots: PullSlot[] = [];
  let pity = { ...currentPity };

  for (let slot = 0; slot < count; slot += 1) {
    const pityForcesSsr = pity.pullsSinceSsr + 1 >= banner.highestRarityGuarantee;
    let grade: ResearchGrade = pityForcesSsr ? "SSR" : determineGrade(banner, rng());
    // 10번째 슬롯은 자연 회색/R만 SR로 승격한다. 슬롯 판정 RNG는 이미 한 번 소비했고 보상 RNG는 소비하지 않는다.
    if (!pityForcesSsr && count === 10 && slot === 9 && (grade === "GRAY" || grade === "R")) grade = "SR";

    if (grade === "GRAY") {
      // 소비 순서: 슬롯 판정 → 회색 풀 선택 → 수량. 천장 카운터는 다른 비SSR과 똑같이 증가한다.
      const totalWeight = banner.grayRewards.reduce((sum, reward) => sum + reward.weight, 0);
      const roll = rng() * totalWeight;
      let cursor = 0;
      const reward = banner.grayRewards.find((candidate) => (cursor += candidate.weight) > roll) ?? banner.grayRewards.at(-1);
      if (!reward) throw new Error("회색 보상 풀이 비어 있습니다.");
      const amount = rewardAmount(reward, rng());
      slots.push({ kind: "currency", currency: reward.kind, amount, grade: "GRAY" });
      pity = { ...pity, pullsSinceSsr: pity.pullsSinceSsr + 1 };
      continue;
    }
    const rarity = grade;

    const fullPool = banner.relicPools[rarity];
    const pickupPool = banner.pickupRelicIds[rarity] ?? [];
    const nonPickupPool = fullPool.filter((id) => !pickupPool.includes(id));
    // 픽업이 없으면 불필요한 난수를 소비하지 않는다. 픽업 판정 뒤 선택 난수만 소비한다.
    // 픽업 확정은 SSR 슬롯에만 적용하며, 확정 때는 판정 난수를 소비하지 않는다.
    const guaranteesPickup = rarity === "SSR" && pity.pickupGuaranteed && pickupPool.length > 0;
    const pickedUp = guaranteesPickup || (pickupPool.length > 0 && rng() < banner.pickupRate);
    const selectionPool = pickedUp ? pickupPool : (nonPickupPool.length > 0 ? nonPickupPool : fullPool);
    const relicId = choose(selectionPool, rng);
    relicIds.push(relicId);
    rarities.push(rarity);
    slots.push({ kind: "relic", relicId, rarity });
    if (rarity === "SSR") {
      // SSR 픽업 실패만 다음 SSR 확정을 켜고, 픽업 획득은 기존 확정까지 해제한다.
      pity = { pullsSinceSsr: 0, pickupGuaranteed: pickupPool.length > 0 && !pickedUp };
    } else {
      pity = { ...pity, pullsSinceSsr: pity.pullsSinceSsr + 1 };
    }
  }

  return { slots, relicIds, rarities, pity };
}

/** 비용을 치른 새 지갑 — 연구 재화를 먼저 쓰고 모자란 몫은 젬이다. 모자라면 원래 참조를 돌려준다. */
export function spend(wallet: Wallet, banner: Banner, count: number): Wallet {
  if (!canPull(wallet, banner, count)) return wallet;
  const payment = pullPayment(wallet, banner, count);
  return { ...wallet, [banner.currency]: wallet[banner.currency] - payment.tickets, gems: wallet.gems - payment.gems };
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
 * 중복 한 장은 **그 개체의 파편** 한 개다. 별이 이미 다섯인 개체(`breakthroughGradeById`가 상한)만
 * 공용 DNA 조각으로 바뀐다 — 더 올릴 별이 없는 파편은 쓸 곳이 없기 때문이다.
 */
export function resolveAcquisitions(
  ownedRelicIds: ReadonlySet<string>,
  fragmentsById: Readonly<Record<string, number>>,
  results: readonly string[],
  /** 개체별 현재 별(1~5). 주지 않은 개체는 별 하나로 본다. */
  breakthroughGradeById: Readonly<Record<string, number>> = {},
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
    if ((breakthroughGradeById[relicId] ?? 1) >= maxStars) {
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
