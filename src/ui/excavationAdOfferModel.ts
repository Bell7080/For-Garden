import { t } from "../i18n";
import { findAdRewardSlot } from "../data/adRewards";
/** 발굴 팝업이 지원하는 광고 두 종류만 클라이언트 표시 계약으로 고정한다. */
export type ExcavationAdOfferId = "excavation-speed" | "excavation-storage";

/** 서버 운영 문구와 무관하게 버튼이 그릴 효과·사용량·활성 상태를 한 번에 전달한다. */
export interface ExcavationAdOfferDisplayModel {
  /** 효과와 지속 시간 — 「보관량 ×2 · 16시간」. 무엇을 얼마 동안 받는지가 버튼 위에서 함께 읽힌다. */
  label: string;
  usage: string;
  /** 라벨 아래 한 줄 — 평소에는 「광고 보기 2/2」, 효과가 도는 동안은 「남은 시간 12:59:13 · 1/2」. */
  sub: string;
  used: number;
  limit: number;
  enabled: boolean;
  /** 광고를 보고 받은 효과가 지금 돌고 있는지. 버튼이 「진행 중」 딱지와 남은 시간 줄을 세운다. */
  active: boolean;
  /** 남은 시간의 몫(0~1) — 지속 시간 전체에 대한 비율이다. 효과가 없으면 0. */
  progress: number;
}

/**
 * 서버는 효과와 한도를 소유하고, 클라이언트는 슬롯 ID별 짧은 표기를 소유한다.
 *
 * 표가 아니라 함수인 이유는 표가 모듈을 읽는 순간 굳기 때문이다.
 */
const labelBySlot = (slotId: ExcavationAdOfferId): string =>
  t(slotId === "excavation-speed" ? "excavation.ad.production" : "excavation.ad.storage");

/**
 * 광고 한 번이 켜는 효과의 지속 시간(초) — 슬롯 정의에서만 읽는다.
 *
 * 보관 늘리기는 「다음 정산 창」에 걸리는 효과라 그 창의 길이(`maxStorageSeconds`)가 곧 지속 시간이다 —
 * 서버도 같은 값으로 만료 시각을 새긴다(`FakeServer`의 `storageExtensionExpiresAt`).
 */
export function excavationAdEffectSeconds(slotId: ExcavationAdOfferId): number {
  const reward = findAdRewardSlot(slotId)?.reward;
  if (reward?.kind !== "excavation_effect") return 0;
  const effect = reward.effect;
  if (effect.kind === "production_speed") return effect.durationSeconds;
  if (effect.kind === "storage_extension") return effect.maxStorageSeconds;
  return 0;
}

/** 지속 시간 표기 — 시간으로 떨어지면 「16시간」, 아니면 「45분」. */
export function formatEffectDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return minutes % 60 === 0 && minutes > 0
    ? t("excavation.duration.hours", { hours: minutes / 60 })
    : t("excavation.duration.minutes", { minutes });
}

/** 다른 광고 칸(AdRewardCard)처럼 남은 횟수/한도로 적는다. 처음에는 0/N이 아니라 N/N이어야 한다. */
export function excavationAdOfferDisplayModel(slotId: ExcavationAdOfferId, limit: number, remaining: number, activeRemainingMs = 0): ExcavationAdOfferDisplayModel {
  // 잘못된 운영 응답도 음수 사용량을 그리지 않도록 표시 범위만 서버 한도 안으로 고정한다.
  const safeLimit = Math.max(0, limit);
  const safeRemaining = Math.min(safeLimit, Math.max(0, remaining));
  const used = safeLimit - safeRemaining;
  const usage = `${safeRemaining}/${safeLimit}`;
  const durationSeconds = excavationAdEffectSeconds(slotId);
  const label = durationSeconds > 0 ? t("excavation.ad.withDuration", { effect: labelBySlot(slotId), duration: formatEffectDuration(durationSeconds) }) : labelBySlot(slotId);
  const active = activeRemainingMs > 0;
  const progress = active && durationSeconds > 0 ? Math.min(1, activeRemainingMs / (durationSeconds * 1000)) : 0;
  const sub = active ? t("excavation.ad.activeSub", { time: formatEffectRemaining(activeRemainingMs), usage }) : t("excavation.ad.idleSub", { usage });
  return { label, usage, sub, used, limit: safeLimit, enabled: safeRemaining > 0, active, progress };
}

/** 켜져 있는 효과의 남은 시간 표기. 숫자만 쓰므로 언어와 무관하다(1:00:00 · 59:12). */
export function formatEffectRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * 보관이 가득 차기까지 남은 초 — 보관 게이지 오른쪽 줄이 읽는다.
 *
 * `fill`·`limitRatio`는 기본 보관 시간을 1로 둔 몫이다(보관 2배가 켜지면 한도가 2). 생산 가속이 켜져 있으면
 * 그 남은 시간 동안만 배율만큼 빨리 차고, 그 뒤로는 기본 속도다. 이미 찼으면 0, 쌓이는 것이 없으면 `undefined`.
 */
export function excavationStorageEtaSeconds(input: { fill: number; limitRatio: number; baseStorageSeconds: number; producing: boolean; speed?: { multiplier: number; remainingSeconds: number } }): number | undefined {
  if (input.fill >= input.limitRatio) return 0;
  if (!input.producing) return undefined;
  const needed = (input.limitRatio - input.fill) * input.baseStorageSeconds;
  const speed = input.speed && input.speed.multiplier > 1 && input.speed.remainingSeconds > 0 ? input.speed : undefined;
  if (!speed) return needed;
  const fastCovered = speed.remainingSeconds * speed.multiplier;
  return needed <= fastCovered ? needed / speed.multiplier : speed.remainingSeconds + (needed - fastCovered);
}
