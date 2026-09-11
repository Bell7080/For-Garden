import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

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

/**
 * 화면을 벗어나는 뒤로가기의 고정 자리 — 엄지가 닿는 오른쪽 아래 구석이다.
 *
 * 그리는 쪽(`IconButton`)이 아니라 배치표가 갖는다. 판이 이 자리를 덮지 않는지 확인하는 순수
 * 테스트가 Phaser 없이 같은 값을 읽어야 하기 때문이다.
 */
export const BACK_SLOT = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 } as const;

/**
 * 팝업이 세우는 판 밖 뒤로가기의 깊이 밑값.
 *
 * 아래 화면이 이미 같은 우하단 자리에 제 뒤로가기를 세워 두었으므로(로비의 가방·무역·발굴은
 * 2100, 구매 확인은 2400) 팝업의 것은 **그보다 위**에 있어야 한다 — 그러지 않으면 쪽지가 떠
 * 있는데 아래 화면이 닫힌다. 층마다 둘씩 올려 중첩 팝업끼리도 나중에 연 것이 먼저 눌린다.
 */
export const POPUP_BACK_BUTTON_DEPTH = 2500;
