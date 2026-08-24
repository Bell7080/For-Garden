import type { Wallet } from "./gacha";
import type { ExcavationProductionCurrency, RelicDef, RelicProgress } from "./types";
import { WALLET_CAPS } from "../data/economy";

/** 발굴로 생산하는 재화만 좁혀 다른 지갑 키가 실수로 늘지 않게 한다. */
export type ExcavationCurrency = ExcavationProductionCurrency;

/** JSON으로 그대로 저장할 수 있는 방치 발굴의 단일 상태다. */
export interface IdleExcavationState {
  /** 세 칸은 위치를 보존하며 빈 칸은 null이다. */
  assignedRelicIds: [string | null, string | null, string | null];
  /** null은 구버전 저장을 서버가 처음 조회할 때 초기화해야 한다는 뜻이다. */
  lastSettledAt: string | null;
  unclaimed: Record<ExcavationCurrency, number>;
  baseStorageSeconds: number;
  activeProductionMultiplier: number;
  storageExtensionExpiresAt: string | null;
}

/** 레벨 하나와 한계 돌파 한 단계가 주는 명시적인 생산 증가율이다. */
export const EXCAVATION_GROWTH = { perLevel: 0.02, perBreakthrough: 0.1 } as const;

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
  // 표시 단계에서도 정산과 같은 소수 정규화를 사용해 UI에 부동소수 오차가 새지 않게 한다.
  const levelIncreasePerHour = fixedAmount(basePerHour * Math.max(0, progress.level - 1) * EXCAVATION_GROWTH.perLevel);
  const breakthroughIncreasePerHour = fixedAmount(basePerHour * Math.max(0, progress.breakthrough) * EXCAVATION_GROWTH.perBreakthrough);
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
  const totalsPerHour: Record<ExcavationCurrency, number> = { gold: 0, cheesecake: 0 };
  // 여러 렐릭의 소수를 더할 때도 표시값을 여섯 자리로 고정한다.
  for (const detail of details) totalsPerHour[detail.currency] = fixedAmount(totalsPerHour[detail.currency] + detail.totalPerHour);
  return { relics: details, totalsPerHour };
}

/** 확장권이 활성인 동안 기본 보관 시간을 두 배로 잡는 고정 규칙이다. */
export const STORAGE_EXTENSION_MULTIPLIER = 2;

/** 신규 계정과 구버전 마이그레이션이 공유하는 독립 상태를 만든다. */
export function createIdleExcavationState(lastSettledAt: string | null = null): IdleExcavationState {
  return { assignedRelicIds: [null, null, null], lastSettledAt, unclaimed: { gold: 0, cheesecake: 0 }, baseStorageSeconds: 4 * 60 * 60, activeProductionMultiplier: 1, storageExtensionExpiresAt: null };
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
  const extensionActive = state.storageExtensionExpiresAt !== null && serverNow.getTime() < new Date(state.storageExtensionExpiresAt).getTime();
  const storageLimit = state.baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
  // 앱 종료 시간 전체가 아니라 min(서버 경과 시간, 현재 보관 한도)만 생산한다.
  const elapsedSeconds = Math.min((serverNow.getTime() - previousMs) / 1000, storageLimit);
  const production = excavationProductionDisplayModel(state.assignedRelicIds, relics, progressByRelicId).totalsPerHour;
  const unclaimed = { ...state.unclaimed };
  for (const currency of Object.keys(production) as ExcavationCurrency[]) unclaimed[currency] = fixedAmount(unclaimed[currency] + elapsedSeconds / 3600 * production[currency] * state.activeProductionMultiplier);
  return { ...state, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed };
}

/** 정수 부분만 지갑에 옮기며 지갑 상한 밖의 정수는 버리고 소수 잔량만 보존한다. */
export function harvestIdleExcavation(state: IdleExcavationState, wallet: Wallet): { state: IdleExcavationState; wallet: Wallet; granted: Record<ExcavationCurrency, number>; discarded: Record<ExcavationCurrency, number> } {
  const nextWallet = { ...wallet }; const unclaimed = { ...state.unclaimed };
  const granted = { gold: 0, cheesecake: 0 }; const discarded = { gold: 0, cheesecake: 0 };
  for (const currency of Object.keys(granted) as ExcavationCurrency[]) {
    // Math.floor로 재화별 정수 지급을 고정하고 1 미만 생산분은 다음 수확으로 이월한다.
    const harvestable = Math.floor(unclaimed[currency]); const room = Math.max(0, WALLET_CAPS[currency] - nextWallet[currency]);
    granted[currency] = Math.min(harvestable, room); discarded[currency] = harvestable - granted[currency];
    nextWallet[currency] += granted[currency]; unclaimed[currency] = fixedAmount(unclaimed[currency] - harvestable);
  }
  return { state: { ...state, assignedRelicIds: [...state.assignedRelicIds], unclaimed }, wallet: nextWallet, granted, discarded };
}
