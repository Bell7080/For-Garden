import type { SubmitExpeditionBossScoreResponse } from "../api/contracts";

/** 서버가 확정한 최종 원정 점수 구성값만 상세 팝업에 전달하는 읽기 전용 모델이다. */
export interface ExpeditionScoreDetailModel {
  normalNodeScoreTotal: number;
  bossDamageScore: number;
  runScore: number;
}

/** 표시 계층에서 점수를 다시 계산하지 않도록 서버 영수증의 세 값을 그대로 투영한다. */
export function expeditionScoreDetailModel(receipt: SubmitExpeditionBossScoreResponse): ExpeditionScoreDetailModel {
  return {
    normalNodeScoreTotal: receipt.normalNodeScoreTotal,
    bossDamageScore: receipt.bossDamageScore,
    runScore: receipt.runScore,
  };
}
