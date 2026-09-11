/** 기울어진 판의 네 모서리까지 포함한 축 정렬 크기다. Phaser 없이 정적 안전 영역을 검증한다. */
export function tiltedPopupSize(width: number, height: number, tilt = 0): { width: number; height: number } {
  const radians = Math.abs(tilt) * Math.PI / 180;
  return {
    width: Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)),
    height: Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)),
  };
}

/**
 * 팝업 몸판이 왼쪽 위·오른쪽 아래를 깎는 깊이(짧은 변 대비).
 *
 * 판 뒤에 원화를 까는 화면은 **같은 실루엣으로 잘라야** 그림이 깎인 모서리 밖으로 삐져나오지
 * 않는다. 값이 두 곳에 있으면 한쪽만 고쳐 그때부터 한 창 안에 판이 두 장 보인다.
 */
export const POPUP_BODY_BEVEL_RATIO = 0.14;

/** 공용 닫기 조작의 판 모서리 기준 배치다. 렌더링과 정적 입력면 검사가 같은 수치를 쓴다. */
export const POPUP_CLOSE_LAYOUT = { centerInset: 40, hitSize: 84 } as const;

/** 뒤로가기 한 변. 자리를 재는 쪽과 그리는 쪽이 같은 값을 읽어야 빗변 계산이 맞는다. */
export const BACK_BUTTON_SIZE = 108;

/** 우하단 뒤로가기가 깎인 모서리에서 더 떨어져 앉는 여백. */
const POPUP_BACK_MARGIN = 8;

/**
 * 큰 작업판의 우하단 뒤로가기 자리 — **깎인 모서리 안쪽**이다.
 *
 * 두 변에서 같은 만큼만 들어가면 버튼이 오른쪽 아래의 빗변을 넘어 판 밖으로 삐져나와 붙인
 * 스티커처럼 보인다. 예전에는 반지름과 여백만 더한 고정값이라 판이 클수록(=깎임이 깊을수록)
 * 더 많이 튀어나왔다. 빗변은 `x + y = width/2 + height/2 - 깎임`이므로, 버튼의 바깥 모서리가
 * 그 선을 넘지 않는 최소 여백은 `(한 변 + 깎임) / 2`다.
 */
export function popupBackButtonSpot(width: number, height: number, size: number): { x: number; y: number } {
  const bevel = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  const inset = (size + bevel) / 2 + POPUP_BACK_MARGIN;
  return { x: width / 2 - inset, y: height / 2 - inset };
}
