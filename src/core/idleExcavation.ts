import type { Wallet } from "./gacha";
import { WALLET_CAPS } from "../data/economy";

/** 발굴로 생산하는 재화만 좁혀 다른 지갑 키가 실수로 늘지 않게 한다. */
export type ExcavationCurrency = "fossil" | "gold" | "cheesecake";

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

/** 슬롯 하나가 초당 만드는 양이다. 소수 생산분은 정산 사이에도 잃지 않는다. */
export const EXCAVATION_RATE_PER_RELIC: Readonly<Record<ExcavationCurrency, number>> = {
  fossil: 1 / 60,
  gold: 1 / 6,
  cheesecake: 1 / 600,
};

/** 확장권이 활성인 동안 기본 보관 시간을 두 배로 잡는 고정 규칙이다. */
export const STORAGE_EXTENSION_MULTIPLIER = 2;

/** 신규 계정과 구버전 마이그레이션이 공유하는 독립 상태를 만든다. */
export function createIdleExcavationState(lastSettledAt: string | null = null): IdleExcavationState {
  return { assignedRelicIds: [null, null, null], lastSettledAt, unclaimed: { fossil: 0, gold: 0, cheesecake: 0 }, baseStorageSeconds: 4 * 60 * 60, activeProductionMultiplier: 1, storageExtensionExpiresAt: null };
}

/** 부동소수 누적 오차가 정수 지급 경계를 넘지 않도록 소수 여섯 자리로 고정한다. */
function fixedAmount(value: number): number { return Number(value.toFixed(6)); }

/** 서버 시각 하나만 받아 경과분을 미수확 자원에 더한 새 상태를 반환한다. */
export function settleIdleExcavation(state: IdleExcavationState, serverNow: Date): IdleExcavationState {
  // 첫 조회 상태는 과거 시간을 추측하지 않고 서버의 현재 시각만 기준점으로 기록한다.
  if (state.lastSettledAt === null) return { ...state, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  const previousMs = new Date(state.lastSettledAt).getTime();
  // 시계가 역행하면 생산하지 않고 기준점도 뒤로 옮기지 않아 이후 시간이 이중 계산되지 않게 한다.
  if (!Number.isFinite(previousMs) || serverNow.getTime() <= previousMs) return { ...state, assignedRelicIds: [...state.assignedRelicIds], unclaimed: { ...state.unclaimed } };
  const extensionActive = state.storageExtensionExpiresAt !== null && serverNow.getTime() < new Date(state.storageExtensionExpiresAt).getTime();
  const storageLimit = state.baseStorageSeconds * (extensionActive ? STORAGE_EXTENSION_MULTIPLIER : 1);
  // 앱 종료 시간 전체가 아니라 min(서버 경과 시간, 현재 보관 한도)만 생산한다.
  const elapsedSeconds = Math.min((serverNow.getTime() - previousMs) / 1000, storageLimit);
  const workers = state.assignedRelicIds.filter((id) => id !== null).length;
  const unclaimed = { ...state.unclaimed };
  for (const currency of Object.keys(EXCAVATION_RATE_PER_RELIC) as ExcavationCurrency[]) unclaimed[currency] = fixedAmount(unclaimed[currency] + elapsedSeconds * workers * EXCAVATION_RATE_PER_RELIC[currency] * state.activeProductionMultiplier);
  return { ...state, lastSettledAt: serverNow.toISOString(), assignedRelicIds: [...state.assignedRelicIds], unclaimed };
}

/** 정수 부분만 지갑에 옮기며 지갑 상한 밖의 정수는 버리고 소수 잔량만 보존한다. */
export function harvestIdleExcavation(state: IdleExcavationState, wallet: Wallet): { state: IdleExcavationState; wallet: Wallet; granted: Record<ExcavationCurrency, number>; discarded: Record<ExcavationCurrency, number> } {
  const nextWallet = { ...wallet }; const unclaimed = { ...state.unclaimed };
  const granted = { fossil: 0, gold: 0, cheesecake: 0 }; const discarded = { fossil: 0, gold: 0, cheesecake: 0 };
  for (const currency of Object.keys(granted) as ExcavationCurrency[]) {
    // Math.floor로 재화별 정수 지급을 고정하고 1 미만 생산분은 다음 수확으로 이월한다.
    const harvestable = Math.floor(unclaimed[currency]); const room = Math.max(0, WALLET_CAPS[currency] - nextWallet[currency]);
    granted[currency] = Math.min(harvestable, room); discarded[currency] = harvestable - granted[currency];
    nextWallet[currency] += granted[currency]; unclaimed[currency] = fixedAmount(unclaimed[currency] - harvestable);
  }
  return { state: { ...state, assignedRelicIds: [...state.assignedRelicIds], unclaimed }, wallet: nextWallet, granted, discarded };
}
