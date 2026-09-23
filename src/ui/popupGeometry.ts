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

/**
 * 쪽지와 화면을 대부분 차지하는 작업판이 공유하는 제목 위계다.
 *
 * Phaser를 들여오는 `PopupLayer`가 아니라 이 배치표가 갖는다 — 판 위의 무언가가 제목표 띠를
 * 침범하지 않는지 확인하는 순수 테스트가 같은 값을 읽어야 하기 때문이다(`BACK_SLOT`과 같은 이유).
 */
export const POPUP_TITLE_SIZE = {
  note: 26,
  workboard: 34,
} as const;

/**
 * 제목표가 윗변에 걸터앉아 차지하는 **위아래 절반** 높이.
 *
 * `addSectionTitle`이 제 높이를 `size * 1.52`로 잡고 판 윗변을 가운데로 삼으므로, 판 위쪽에
 * 무언가를 세울 때 이만큼은 비워야 글자와 겹치지 않는다.
 */
export function popupTitleBand(size: number): number {
  return Math.round(size * 1.52) / 2;
}

/**
 * 판 왼쪽 경계의 x — **깎인 모서리 안에서는 대각선이다.**
 *
 * 팝업 몸판은 왼쪽 위를 짧은 변의 14%만큼 비스듬히 깎는다(`POPUP_BODY_BEVEL_RATIO`). 그래서
 * 판 왼쪽에 무언가를 세울 때 `-width / 2`를 기준으로 잡으면 **위쪽에서만 조용히 판 밖으로
 * 삐져나온다** — 높이가 폭보다 큰 긴 판에서는 깎임이 130px을 넘어 액자 하나가 통째로 나간다
 * (v0.95.1의 룬 세공 액자가 45.6px 나가 있었다).
 *
 * `y`는 판 윗변에서 아래로 잰 거리다. 그리는 쪽과 검사하는 쪽이 같은 함수를 읽어야 한쪽만
 * 고쳐지는 일이 없다.
 */
export function popupLeftEdgeAt(width: number, height: number, y: number): number {
  const bevel = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  return y >= bevel ? -width / 2 : -width / 2 + (bevel - y);
}

/**
 * 왼쪽 위 깎임 안에 상자 하나가 온전히 드는가.
 *
 * 상자의 **왼쪽 위 꼭짓점**만 보면 된다 — 깎임은 그 모서리 하나뿐이고, 대각선이라 그 점이
 * 안에 들면 나머지 세 점도 안에 든다.
 */
export function fitsInsidePopupBevel(
  panel: { width: number; height: number },
  box: { left: number; top: number },
  margin = 0,
): boolean {
  return box.left - margin >= popupLeftEdgeAt(panel.width, panel.height, box.top - margin);
}

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
