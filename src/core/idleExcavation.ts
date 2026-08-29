import type { Wallet } from "./gacha";
import type { ExcavationProductionCurrency, RelicDef, RelicProgress } from "./types";
import { WALLET_CAPS } from "../data/economy";

/** 발굴로 생산하는 재화만 좁혀 다른 지갑 키가 실수로 늘지 않게 한다. */
export type ExcavationCurrency = ExcavationProductionCurrency;

/** 발굴의 모든 초기화·정산·수확이 공유하는 유일한 재화 키 목록이다. */
export const EXCAVATION_CURRENCIES = ["gold", "cheesecake", "fossil", "gems"] as const satisfies readonly ExcavationCurrency[];

/** 신규 재화 소급 정산을 저장 단위로 한 번만 실행하게 하는 서버 규칙 버전이다. */
export const RETROACTIVE_EXCAVATION_GRANT_VERSION = 1;

/** 마지막 정산 이후 서버 시간이 실제 보관 한계에 닿았는지 생산 슬롯까지 포함해 판정한다. */
export function isExcavationStorageFull(state: IdleExcavationState, serverNow: Date): boolean {
  if (state.lastSettledAt === null || state.assignedRelicIds.every((id) => id === null)) return false;
  const previousMs = new Date(state.lastSettledAt).getTime();
  const extensionActive = state.storageExtensionExpiresAt !== null && previousMs < new Date(state.storageExtensionExpiresAt).getTime();
  const limitSeconds = state.baseStorageSeconds * (extensionActive ? 2 : 1);
  return Math.max(0, serverNow.getTime() - previousMs) / 1000 >= limitSeconds;
}

/** 정산 로직과 같은 확장 배율로, 지금 시각 기준 보관 한도(초)를 계산한다. */
export function excavationStorageLimitSeconds(state: IdleExcavationState, now: Date): number {
  const extensionActive = state.storageExtensionExpiresAt !== null && now.getTime() < new Date(state.storageExtensionExpiresAt).getTime();
  return state.baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
}

/**
 * 실제로 쌓인 재화량을 그 재화의 보관 한도(시간당 생산량 × 보관 한도 초)와 비교해 채운
 * 비율(0~1)을 계산한다.
 *
 * 마지막 정산 이후 경과 시간으로 계산하면 조회할 때마다 정산이 일어나 기준 시각이 현재로
 * 밀리므로, 창을 열 때마다 게이지가 0%로 보이는 문제가 있었다. 실제 누적 재화량 자체를
 * 기준으로 삼아야 조회 횟수와 무관하게 지금 쌓인 양을 그대로 보여준다.
 */
export function excavationStorageFillRatio(unclaimed: Readonly<Record<ExcavationCurrency, number>>, ratePerHour: Readonly<Record<ExcavationCurrency, number>>, limitSeconds: number): number {
  if (limitSeconds <= 0) return 0;
  let ratio = 0;
  for (const currency of EXCAVATION_CURRENCIES) {
    const capacity = ratePerHour[currency] / 3600 * limitSeconds;
    if (capacity > 0) ratio = Math.max(ratio, unclaimed[currency] / capacity);
  }
  return Math.min(1, ratio);
}

/** JSON으로 그대로 저장할 수 있는 방치 발굴의 단일 상태다. */
export interface IdleExcavationState {
  /** 세 칸은 위치를 보존하며 빈 칸은 null이다. */
  assignedRelicIds: [string | null, string | null, string | null];
  /** null은 구버전 저장을 서버가 처음 조회할 때 초기화해야 한다는 뜻이다. */
  lastSettledAt: string | null;
  unclaimed: Record<ExcavationCurrency, number>;
  baseStorageSeconds: number;
  activeProductionMultiplier: number;
  /** 1.5배 생산이 끝나는 서버 UTC 시각이며 null이면 기본 속도다. */
  productionMultiplierExpiresAt?: string | null;
  storageExtensionExpiresAt: string | null;
  /** 현재 확정 미수확량에만 적용될 다음 수확의 일회성 배율이다. */
  pendingHarvestMultiplier?: number;
  /** 서버가 신규 재화 소급 정산을 완료한 규칙 버전이며 클라이언트는 변경하지 않는다. */
  retroactiveExcavationGrantVersion: number;
}

/** 레벨 하나와 한계 돌파 한 단계가 주는 명시적인 생산 증가율이다. */
export const EXCAVATION_GROWTH = { perLevel: 0.02, perBreakthrough: 0.1 } as const;

/** UI의 다이아는 희소하므로 일반 재화보다 레벨/돌파 성장률을 낮게 제한한다. */
const EXCAVATION_GROWTH_BY_CURRENCY: Readonly<Record<ExcavationCurrency, { perLevel: number; perBreakthrough: number }>> = {
  gold: EXCAVATION_GROWTH, cheesecake: EXCAVATION_GROWTH, fossil: EXCAVATION_GROWTH,
  gems: { perLevel: 0.005, perBreakthrough: 0.025 },
};

/** UI가 공식이나 자원 합계를 복제하지 않고 그대로 표시할 렐릭별 생산 상세다. */
export interface RelicExcavationProduction {
  relicId: string;
  currency: ExcavationCurrency;
  basePerHour: number;
  levelIncreasePerHour: number;
  breakthroughIncreasePerHour: number;
  totalPerHour: number;
}

/** 편성 검증 결과를 예외 없이 전달해 API와 UI가 같은 거절 이유를 사용할 수 있게 한다. */
export type ExcavationFormationValidation = { valid: true } | { valid: false; reason: "duplicate" | "unowned" };

/**
 * 편집 그리드에서 렐릭을 목표 슬롯에 놓는다.
 *
 * 렐릭이 다른 슬롯에 있으면 빈 목표로는 이동하고, 차 있는 목표로는 두 렐릭의 자리를 바꾼다.
 * 같은 슬롯의 렐릭을 다시 누르면 빈 슬롯 정책에 따라 해제한다. 항상 새 튜플을 반환하므로
 * 서버 확정 편성과 UI 임시 편성이 같은 배열 참조를 공유하지 않는다.
 */
export function placeExcavationRelic(
  formation: IdleExcavationState["assignedRelicIds"],
  targetSlot: number,
  relicId: string,
): IdleExcavationState["assignedRelicIds"] {
  const next = [...formation] as IdleExcavationState["assignedRelicIds"];
  if (targetSlot < 0 || targetSlot >= next.length) return next;
  const sourceSlot = next.indexOf(relicId);
  if (sourceSlot === targetSlot) {
    // 빈 슬롯을 허용하므로 현재 슬롯의 카드를 다시 누르면 명시적으로 배치를 해제한다.
    next[targetSlot] = null;
    return next;
  }
  const displaced = next[targetSlot];
  next[targetSlot] = relicId;
  if (sourceSlot >= 0) next[sourceSlot] = displaced;
  return next;
}

/**
 * 한 칸을 채운 뒤 이어서 채울 칸이다.
 *
 * 세 자리를 채우는 일은 보통 연속으로 일어나므로, 카드를 고를 때마다 사람이 다시 칸을 누르게
 * 하면 그 손이 그대로 낭비다. 뒤쪽 빈 칸을 먼저 보고, 없으면 앞쪽 빈 칸, 그것도 없으면 다음
 * 칸으로 넘어간다.
 */
export function nextExcavationSlot(formation: IdleExcavationState["assignedRelicIds"], placedSlot: number): number {
  const count = formation.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (placedSlot + step) % count;
    if (formation[index] === null) return index;
  }
  return (placedSlot + 1) % count;
}

/** 빈 슬롯은 허용하되 같은 렐릭의 중복 및 미보유 렐릭은 차단한다. */
export function validateExcavationFormation(assignedRelicIds: IdleExcavationState["assignedRelicIds"], ownedRelicIds: ReadonlySet<string>): ExcavationFormationValidation {
  const ids = assignedRelicIds.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) return { valid: false, reason: "duplicate" };
  if (ids.some((id) => !ownedRelicIds.has(id))) return { valid: false, reason: "unowned" };
  return { valid: true };
}

/** 허용된 성장값만으로 한 렐릭의 시간당 생산 상세를 계산한다. */
export function relicExcavationProduction(def: RelicDef, progress: Pick<RelicProgress, "level" | "breakthrough">): RelicExcavationProduction {
  const basePerHour = def.excavationTrait.baseProductionPerHour * def.excavationTrait.efficiencyMultiplier;
  const growth = EXCAVATION_GROWTH_BY_CURRENCY[def.excavationTrait.primaryCurrency];
  // 표시 단계에서도 정산과 같은 소수 정규화를 사용해 UI에 부동소수 오차가 새지 않게 한다.
  const levelIncreasePerHour = fixedAmount(basePerHour * Math.max(0, progress.level - 1) * growth.perLevel);
  const breakthroughIncreasePerHour = fixedAmount(basePerHour * Math.max(0, progress.breakthrough) * growth.perBreakthrough);
  return { relicId: def.id, currency: def.excavationTrait.primaryCurrency, basePerHour: fixedAmount(basePerHour), levelIncreasePerHour, breakthroughIncreasePerHour, totalPerHour: fixedAmount(basePerHour + levelIncreasePerHour + breakthroughIncreasePerHour) };
}

/** 세 슬롯의 표시 상세와 자원별 합계를 한 번에 반환하는 순수 표시 모델이다. */
export function excavationProductionDisplayModel(assignedRelicIds: IdleExcavationState["assignedRelicIds"], relics: readonly RelicDef[], progressByRelicId: Readonly<Record<string, Pick<RelicProgress, "level" | "breakthrough">>>): { relics: RelicExcavationProduction[]; totalsPerHour: Record<ExcavationCurrency, number> } {
  const definitions = new Map(relics.map((relic) => [relic.id, relic]));
  const details = assignedRelicIds.flatMap((id) => {
    const definition = id === null ? undefined : definitions.get(id); const progress = id === null ? undefined : progressByRelicId[id];
    // 정의나 성장 정보가 없는 저장 슬롯은 생산하지 않는 빈 슬롯처럼 안전하게 취급한다.
    return definition && progress ? [relicExcavationProduction(definition, progress)] : [];
  });
  const totalsPerHour = emptyExcavationAmounts();
  // 여러 렐릭의 소수를 더할 때도 표시값을 여섯 자리로 고정한다.
  for (const detail of details) totalsPerHour[detail.currency] = fixedAmount(totalsPerHour[detail.currency] + detail.totalPerHour);
  return { relics: details, totalsPerHour };
}

/** 확장권이 활성인 동안 기본 보관 시간을 두 배로 잡는 고정 규칙이다. */
export const STORAGE_EXTENSION_MULTIPLIER = 2;

/** 신규 계정과 구버전 마이그레이션이 공유하는 독립 상태를 만든다. */
export function createIdleExcavationState(lastSettledAt: string | null = null): IdleExcavationState {
  return { assignedRelicIds: [null, null, null], lastSettledAt, unclaimed: emptyExcavationAmounts(), baseStorageSeconds: 4 * 60 * 60, activeProductionMultiplier: 1, productionMultiplierExpiresAt: null, storageExtensionExpiresAt: null, pendingHarvestMultiplier: 1, retroactiveExcavationGrantVersion: RETROACTIVE_EXCAVATION_GRANT_VERSION };
}

/** 새 Record를 만들어 응답과 저장 상태가 같은 객체를 공유하지 않게 한다. */
export function emptyExcavationAmounts(): Record<ExcavationCurrency, number> {
  return Object.fromEntries(EXCAVATION_CURRENCIES.map((currency) => [currency, 0])) as Record<ExcavationCurrency, number>;
}

/** 부동소수 누적 오차가 정수 지급 경계를 넘지 않도록 소수 여섯 자리로 고정한다. */
function fixedAmount(value: number): number { return Number(value.toFixed(6)); }

/** 서버 시각 하나만 받아 경과분을 미수확 자원에 더한 새 상태를 반환한다. */
export function settleIdleExcavation(state: IdleExcavationState, serverNow: Date, relics: readonly RelicDef[] = [], progressByRelicId: Readonly<Record<string, Pick<RelicProgress, "level" | "breakthrough">>> = {}): IdleExcavationState {
  // 첫 조회 상태는 과거 시간을 추측하지 않고 서버의 현재 시각만 기준점으로 기록한다.
  if (state.lastSettledAt === null) return { ...state, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  const previousMs = new Date(state.lastSettledAt).getTime();
  // 시계가 역행하면 생산하지 않고 기준점도 뒤로 옮기지 않아 이후 시간이 이중 계산되지 않게 한다.
  if (!Number.isFinite(previousMs) || serverNow.getTime() <= previousMs) return { ...state, assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  const extensionActive = state.storageExtensionExpiresAt !== null && previousMs < new Date(state.storageExtensionExpiresAt).getTime();
  const storageLimit = state.baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
  // 앱 종료 시간 전체가 아니라 min(서버 경과 시간, 현재 보관 한도)만 생산한다.
  const elapsedSeconds = Math.min((serverNow.getTime() - previousMs) / 1000, storageLimit);
  const production = excavationProductionDisplayModel(state.assignedRelicIds, relics, progressByRelicId).totalsPerHour;
  const unclaimed = { ...state.unclaimed };
  // 만료 경계를 가로지르면 활성 구간과 기본 구간을 나눠 계산해 1ms도 과다 지급하지 않는다.
  const speedExpiryMs = state.productionMultiplierExpiresAt ? new Date(state.productionMultiplierExpiresAt).getTime() : previousMs;
  const effectiveEndMs = previousMs + elapsedSeconds * 1000;
  const boostedSeconds = Math.max(0, Math.min(effectiveEndMs, speedExpiryMs) - previousMs) / 1000;
  const normalSeconds = elapsedSeconds - boostedSeconds;
  for (const currency of EXCAVATION_CURRENCIES) unclaimed[currency] = fixedAmount((unclaimed[currency] ?? 0) + production[currency] / 3600 * (boostedSeconds * state.activeProductionMultiplier + normalSeconds));
  return { ...state, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed, activeProductionMultiplier: speedExpiryMs > serverNow.getTime() ? state.activeProductionMultiplier : 1, productionMultiplierExpiresAt: speedExpiryMs > serverNow.getTime() ? state.productionMultiplierExpiresAt : null, storageExtensionExpiresAt: extensionActive ? null : state.storageExtensionExpiresAt, retroactiveExcavationGrantVersion: RETROACTIVE_EXCAVATION_GRANT_VERSION };
}

/** 정수 부분만 지갑에 옮기며 지갑 상한 밖의 정수는 버리고 소수 잔량만 보존한다. */
export function harvestIdleExcavation(state: IdleExcavationState, wallet: Wallet): { state: IdleExcavationState; wallet: Wallet; granted: Record<ExcavationCurrency, number>; discarded: Record<ExcavationCurrency, number> } {
  const nextWallet = { ...wallet }; const unclaimed = { ...state.unclaimed };
  const granted = emptyExcavationAmounts(); const discarded = emptyExcavationAmounts();
  for (const currency of EXCAVATION_CURRENCIES) {
    // Math.floor로 재화별 정수 지급을 고정하고 1 미만 생산분은 다음 수확으로 이월한다.
    const harvestable = Math.floor(unclaimed[currency] * (state.pendingHarvestMultiplier ?? 1)); const room = Math.max(0, WALLET_CAPS[currency] - nextWallet[currency]);
    granted[currency] = Math.min(harvestable, room); discarded[currency] = harvestable - granted[currency];
    nextWallet[currency] += granted[currency]; unclaimed[currency] = fixedAmount(unclaimed[currency] - Math.floor(unclaimed[currency]));
  }
  return { state: { ...state, assignedRelicIds: [...state.assignedRelicIds], unclaimed, pendingHarvestMultiplier: 1 }, wallet: nextWallet, granted, discarded };
}
