import type { Wallet } from "./gacha";
import type { ExcavationProductionCurrency, RelicDef, RelicProgress } from "./types";
import { WALLET_CAPS } from "../data/economy";
import { splitAccrualAt, timeAccrualWindow } from "./timeAccrual";

/** 발굴로 생산하는 재화만 좁혀 다른 지갑 키가 실수로 늘지 않게 한다. */
export type ExcavationCurrency = ExcavationProductionCurrency;

/** 발굴의 모든 초기화·정산·수확이 공유하는 유일한 재화 키 목록이다. */
/*
 * **발굴은 화석을 캐지 않는다.** 화석 한 개가 연구 한 번이 된 뒤로는 시간당 1.2개가
 * 하루 스물아홉 번이라, 배치해 두고 걷는 자리가 연구소를 통째로 대신하게 된다. 대신
 * 고고학의 원석을 캔다 — 땅에서 나오는 것이 같고, 개수가 자릿수 하나 큰 재화라 시간당
 * 생산으로 흘려보내기에 맞는다.
 */
export const EXCAVATION_CURRENCIES = ["gold", "cheesecake", "rawStone", "gems"] as const satisfies readonly ExcavationCurrency[];

/** 신규 재화 소급 정산을 저장 단위로 한 번만 실행하게 하는 서버 규칙 버전이다. */
export const RETROACTIVE_EXCAVATION_GRANT_VERSION = 1;

/** 절반부터 수확 시점을 알리되 실제 정수 보상이 없으면 점을 켜지 않는 운영 임계값이다. */
export const EXCAVATION_HARVEST_NOTICE_RATIO = 0.5;

/**
 * 보관 한도의 기본 시간.
 *
 * **네 시간은 방치형에게 너무 짧았다** — 자고 일어나면 여덟 시간 중 넷은 이미 흘러간 뒤였고,
 * 원석·다이아는 시간당 생산이 0.3 언저리라 그 네 시간이 담을 수 있는 양이 **한 개 남짓**이었다.
 * 수확은 정수 단위라 한 번 걷을 때마다 1 미만이 남는데, 한도 자체가 그만한 크기면 남은 몫이
 * 한도의 절반을 차지해 "수확했는데 게이지가 그대로"로 보인다. 여덟 시간이면 어떤 재화든
 * **최소 네 개 분량**을 담아 그 잔량이 한도의 4분의 1 아래로 내려간다
 * (`tests/unit/idleExcavation.test.ts`의 정수 하한 계약).
 *
 * **이 값은 플레이어 진행이 아니라 운영 상수다.** 저장에도 `baseStorageSeconds`로 남지만
 * 정산할 때마다 서버가 지금 값으로 덮으므로, 예전 계정도 다음 정산 한 번이면 같은 한도를 쓴다.
 */
export const EXCAVATION_BASE_STORAGE_SECONDS = 8 * 60 * 60;

/** 정산 로직과 같은 확장 배율로, 지금 시각 기준 보관 한도(초)를 계산한다. */
export function excavationStorageLimitSeconds(state: IdleExcavationState, now: Date): number {
  const extensionActive = state.storageExtensionExpiresAt !== null && now.getTime() < new Date(state.storageExtensionExpiresAt).getTime();
  return state.baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
}

/**
 * 재화별로 **지금 담을 수 있는 최대량**(시간당 생산량 × 보관 한도 초).
 *
 * 게이지의 분모, 정산의 상한, 화면의 예상 누적이 전부 이 한 함수를 읽는다 — 세 곳이 저마다
 * 곱셈을 적어 두면 게이지가 말하는 한도와 실제로 쌓이는 양이 갈린다.
 */
export function excavationStorageCapacity(ratePerHour: Readonly<Record<ExcavationCurrency, number>>, limitSeconds: number): Record<ExcavationCurrency, number> {
  const capacity = emptyExcavationAmounts();
  for (const currency of EXCAVATION_CURRENCIES) capacity[currency] = fixedAmount(Math.max(0, ratePerHour[currency]) / 3600 * Math.max(0, limitSeconds));
  return capacity;
}

/**
 * 한도를 넘겨 담지 않는다. 단 **이미 담긴 것은 절대 줄이지 않는다.**
 *
 * 편성에서 그 재화를 캐던 렐릭을 빼면 시간당 생산이 0이 되고 한도도 0이 된다 — 그때 그냥
 * 자르면 지난 편성이 캐 둔 것이 수확하기도 전에 사라진다. 확장권이 끝나 한도가 반으로 줄 때도
 * 같다. 막는 것은 **새로 쌓는 몫**뿐이다.
 */
export function clampExcavationStorage(previous: number, grown: number, capacity: number): number {
  return fixedAmount(Math.max(previous, Math.min(grown, capacity)));
}

/**
 * 실제로 쌓인 재화량을 그 재화의 보관 한도(시간당 생산량 × 보관 한도 초)와 비교해 채운
 * 비율(0~1)을 계산한다.
 *
 * 마지막 정산 이후 경과 시간으로 계산하면 조회할 때마다 정산이 일어나 기준 시각이 현재로
 * 밀리므로, 창을 열 때마다 게이지가 0%로 보이는 문제가 있었다. 실제 누적 재화량 자체를
 * 기준으로 삼아야 조회 횟수와 무관하게 지금 쌓인 양을 그대로 보여준다.
 *
 * 정산이 한도에서 멈추므로 보통은 1을 넘지 않지만, 한도가 줄어든 뒤(편성 변경·확장권 만료)에는
 * 남아 있던 몫이 그 위에 설 수 있다 — 그것까지 게이지가 넘치게 두지 않고 가득으로 읽는다.
 */
export function excavationStorageFillRatio(unclaimed: Readonly<Record<ExcavationCurrency, number>>, ratePerHour: Readonly<Record<ExcavationCurrency, number>>, limitSeconds: number): number {
  if (limitSeconds <= 0) return 0;
  const capacity = excavationStorageCapacity(ratePerHour, limitSeconds);
  let ratio = 0;
  for (const currency of EXCAVATION_CURRENCIES) {
    if (capacity[currency] > 0) ratio = Math.max(ratio, unclaimed[currency] / capacity[currency]);
  }
  return Math.min(1, ratio);
}

/** API와 알림 manager가 공유할 서버 확정 보관 비율·수확 가능 판정이다. */
export function excavationHarvestStatus(unclaimed: Readonly<Record<ExcavationCurrency, number>>, ratePerHour: Readonly<Record<ExcavationCurrency, number>>, limitSeconds: number, harvestMultiplier = 1): { storageFillRatio: number; harvestNotice: boolean } {
  const storageFillRatio = excavationStorageFillRatio(unclaimed, ratePerHour, limitSeconds);
  // 광고 배율은 실제 수확 시 정수화 전에 적용되므로 알림의 "받을 수 있음"도 같은 순서를 따른다.
  const hasIntegerReward = EXCAVATION_CURRENCIES.some((currency) => Math.floor(unclaimed[currency] * harvestMultiplier) >= 1);
  return { storageFillRatio, harvestNotice: storageFillRatio >= EXCAVATION_HARVEST_NOTICE_RATIO && hasIntegerReward };
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
  gold: EXCAVATION_GROWTH, cheesecake: EXCAVATION_GROWTH, rawStone: EXCAVATION_GROWTH,
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
  return { assignedRelicIds: [null, null, null], lastSettledAt, unclaimed: emptyExcavationAmounts(), baseStorageSeconds: EXCAVATION_BASE_STORAGE_SECONDS, activeProductionMultiplier: 1, productionMultiplierExpiresAt: null, storageExtensionExpiresAt: null, pendingHarvestMultiplier: 1, retroactiveExcavationGrantVersion: RETROACTIVE_EXCAVATION_GRANT_VERSION };
}

/** 새 Record를 만들어 응답과 저장 상태가 같은 객체를 공유하지 않게 한다. */
export function emptyExcavationAmounts(): Record<ExcavationCurrency, number> {
  return Object.fromEntries(EXCAVATION_CURRENCIES.map((currency) => [currency, 0])) as Record<ExcavationCurrency, number>;
}

/** 부동소수 누적 오차가 정수 지급 경계를 넘지 않도록 소수 여섯 자리로 고정한다. */
function fixedAmount(value: number): number { return Number(value.toFixed(6)); }

/** 서버 시각 하나만 받아 경과분을 미수확 자원에 더한 새 상태를 반환한다. */
export function settleIdleExcavation(state: IdleExcavationState, serverNow: Date, relics: readonly RelicDef[] = [], progressByRelicId: Readonly<Record<string, Pick<RelicProgress, "level" | "breakthrough">>> = {}): IdleExcavationState {
  const previousMs = state.lastSettledAt === null ? Number.NaN : Date.parse(state.lastSettledAt);
  const extensionActive = Number.isFinite(previousMs) && state.storageExtensionExpiresAt !== null && previousMs < Date.parse(state.storageExtensionExpiresAt);
  /*
   * **보관 시간은 저장이 아니라 서버가 소유한다.**
   *
   * `baseStorageSeconds`는 저장에 남지만 계정마다 다른 값이 아니라 운영 상수라, 정산할 때마다
   * 지금 값으로 덮는다(소급 지급 버전을 매번 찍는 것과 같은 자리·같은 이유다). 저장에 적힌
   * 옛 값을 그대로 믿으면 한도를 늘려도 이미 만들어진 계정만 예전 한도에 갇힌다.
   */
  const baseStorageSeconds = EXCAVATION_BASE_STORAGE_SECONDS;
  const storageLimit = baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
  const accrual = timeAccrualWindow(state.lastSettledAt, serverNow, storageLimit * 1000);
  // 역행 또는 잘못된 서버 시각은 생산과 저장 기준점 모두 그대로 보존한다.
  if (!accrual.accepted) return { ...state, baseStorageSeconds, assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  // 첫 조회는 과거 생산을 추측하지 않고 검증된 서버 시각만 기준점으로 기록한다.
  if (accrual.initialized) return { ...state, baseStorageSeconds, lastSettledAt: new Date(accrual.window.serverNowMs).toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  const production = excavationProductionDisplayModel(state.assignedRelicIds, relics, progressByRelicId).totalsPerHour;
  const unclaimed = { ...state.unclaimed };
  // 만료 경계를 가로지르면 활성 구간과 기본 구간을 나눠 계산해 1ms도 과다 지급하지 않는다.
  const speedExpiryMs = state.productionMultiplierExpiresAt ? Date.parse(state.productionMultiplierExpiresAt) : accrual.window.startMs;
  const split = splitAccrualAt(accrual.window, state.productionMultiplierExpiresAt);
  const boostedSeconds = split.beforeMs / 1000;
  const normalSeconds = split.afterMs / 1000;
  /*
   * **보관 한도는 계산 구간이 아니라 담기는 양의 상한이다.**
   *
   * 한 번의 정산이 한도 시간까지만 계산하는 것만으로는 한도가 되지 않았다 — 그 시간마다 앱을
   * 열면 그때마다 한 창 분량이 더해져 하루면 한도의 세 배가 쌓였고, 게이지는 100%에서 잘려
   * 그 사이 아무 말도 하지 못했다. 그래서 수확해도 남는 소수가 커져(화석 0.96 / 한도 1.32 =
   * 73%) "수확했는데 게이지가 그대로"로 보였다. 지금은 **한도에 닿으면 거기서 멈춘다** —
   * 100%가 정말 "더 담을 수 없다"는 뜻이 되고, 수확 뒤 남는 것은 정수에 못 미친 몫뿐이다.
   *
   * 상한은 **계산 구간과 같은 한도**(`storageLimit`)로 잡는다. 확장권이 만료되는 순간을 두
   * 기준으로 나눠 판단하면 두 배 구간을 계산해 놓고 기본 구간만큼만 담게 되어 확장권이 아무
   * 일도 하지 않는다. 확장이 끝난 뒤에는 게이지의 분모(지금 기준 한도)보다 담긴 것이 많을 수
   * 있는데, 그때는 게이지가 가득으로 읽히고 담긴 것은 그대로 남는다.
   */
  const capacity = excavationStorageCapacity(production, storageLimit);
  for (const currency of EXCAVATION_CURRENCIES) {
    const previous = unclaimed[currency] ?? 0;
    const grown = previous + production[currency] / 3600 * (boostedSeconds * state.activeProductionMultiplier + normalSeconds);
    unclaimed[currency] = clampExcavationStorage(previous, grown, capacity[currency]);
  }
  return { ...state, baseStorageSeconds, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed, activeProductionMultiplier: speedExpiryMs > serverNow.getTime() ? state.activeProductionMultiplier : 1, productionMultiplierExpiresAt: speedExpiryMs > serverNow.getTime() ? state.productionMultiplierExpiresAt : null, storageExtensionExpiresAt: state.storageExtensionExpiresAt && new Date(state.storageExtensionExpiresAt).getTime() > serverNow.getTime() ? state.storageExtensionExpiresAt : null, retroactiveExcavationGrantVersion: RETROACTIVE_EXCAVATION_GRANT_VERSION };
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
