/** 발굴 팝업이 지원하는 광고 두 종류만 클라이언트 표시 계약으로 고정한다. */
export type ExcavationAdOfferId = "excavation-harvest" | "excavation-storage";

/** 서버 운영 문구와 무관하게 버튼이 그릴 효과·사용량·활성 상태를 한 번에 전달한다. */
export interface ExcavationAdOfferDisplayModel {
  label: string;
  usage: string;
  used: number;
  limit: number;
  enabled: boolean;
}

/** 서버는 효과와 한도를 소유하고, 클라이언트는 슬롯 ID별 짧고 안정적인 한국어 표기를 소유한다. */
const LABEL_BY_SLOT: Record<ExcavationAdOfferId, string> = {
  "excavation-harvest": "생산량 ×1.5",
  "excavation-storage": "보관량 ×2",
};

/** 남은 횟수를 그대로 사용량처럼 보이지 않도록 used = limit - remaining을 명시적으로 계산한다. */
export function excavationAdOfferDisplayModel(slotId: ExcavationAdOfferId, limit: number, remaining: number): ExcavationAdOfferDisplayModel {
  // 잘못된 운영 응답도 음수 사용량을 그리지 않도록 표시 범위만 서버 한도 안으로 고정한다.
  const safeLimit = Math.max(0, limit);
  const safeRemaining = Math.min(safeLimit, Math.max(0, remaining));
  const used = safeLimit - safeRemaining;
  return { label: LABEL_BY_SLOT[slotId], usage: `${used}/${safeLimit}`, used, limit: safeLimit, enabled: safeRemaining > 0 };
}
