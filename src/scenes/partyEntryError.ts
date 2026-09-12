import { GameApiError } from "../api/contracts";
import { t } from "../i18n";

/** 전투 입장 실패가 요구하는 안내와 후속 UI를 Phaser 없이 판정해 회귀 테스트할 수 있게 한다. */
export interface PartyEntryErrorView {
  message: string;
  openStaminaPopup: boolean;
}

/**
 * 입장 API 오류만 사용자 안내로 바꾼다.
 *
 * 파티 저장은 이미 끝난 뒤 호출되는 별도 서버 경계이므로, 여기서 저장 실패 문구를 반환하면
 * 스테미나 부족 같은 복구 가능한 입장 거절을 저장 장애로 오인하게 된다.
 */
export function partyEntryErrorView(error?: GameApiError): PartyEntryErrorView {
  if (error?.code === "INSUFFICIENT_STAMINA") {
    return { message: t("partyEntry.noStamina"), openStaminaPopup: true };
  }
  return { message: t("partyEntry.failed"), openStaminaPopup: false };
}
