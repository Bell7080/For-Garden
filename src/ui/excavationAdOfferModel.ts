import { t } from "../i18n";
/** 발굴 팝업이 지원하는 광고 두 종류만 클라이언트 표시 계약으로 고정한다. */
export type ExcavationAdOfferId = "excavation-speed" | "excavation-storage";

/** 서버 운영 문구와 무관하게 버튼이 그릴 효과·사용량·활성 상태를 한 번에 전달한다. */
export interface ExcavationAdOfferDisplayModel {
  label: string;
  usage: string;
  used: number;
  limit: number;
  enabled: boolean;
}

/**
 * 서버는 효과와 한도를 소유하고, 클라이언트는 슬롯 ID별 짧은 표기를 소유한다.
 *
 * 표가 아니라 함수인 이유는 표가 모듈을 읽는 순간 굳기 때문이다.
 */
const labelBySlot = (slotId: ExcavationAdOfferId): string =>
  t(slotId === "excavation-speed" ? "excavation.ad.production" : "excavation.ad.storage");

/** 다른 광고 칸(AdRewardCard)처럼 남은 횟수/한도로 적는다. 처음에는 0/N이 아니라 N/N이어야 한다. */
export function excavationAdOfferDisplayModel(slotId: ExcavationAdOfferId, limit: number, remaining: number): ExcavationAdOfferDisplayModel {
  // 잘못된 운영 응답도 음수 사용량을 그리지 않도록 표시 범위만 서버 한도 안으로 고정한다.
  const safeLimit = Math.max(0, limit);
  const safeRemaining = Math.min(safeLimit, Math.max(0, remaining));
  const used = safeLimit - safeRemaining;
  return { label: labelBySlot(slotId), usage: `${safeRemaining}/${safeLimit}`, used, limit: safeLimit, enabled: safeRemaining > 0 };
}

/** 켜져 있는 효과의 남은 시간 표기. 숫자만 쓰므로 언어와 무관하다(1:00:00 · 59:12). */
export function formatEffectRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
