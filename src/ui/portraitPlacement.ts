import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import type { PuppetAsset } from "../puppets/assets";

/** Alpha 실루엣을 화면 좌표로 옮긴 결과다. UI 안전 영역 테스트도 이 값만 사용한다. */
export interface PortraitScreenBounds { top: number; bottom: number; height: number }

/** 플레이어 조작과 읽기 전용 적 분석창은 하단에서 보호해야 할 콘텐츠가 서로 다르다. */
export const INFO_PORTRAIT_SAFE_AREA = {
  player: { titleBottom: 330, controlsTop: 1420 },
  enemy: { titleBottom: 330, controlsTop: 1660 },
} as const;

/**
 * 정보창 전신 원화의 코어(`중심1`) 관절이 놓이는 자리와 확대 높이.
 *
 * 화면 한가운데(960)보다 아주 조금만 아래에 둔다 — 더 내리면 얼굴이 화면 절반 아래로 내려가
 * 인물이 판 뒤로 가라앉은 것처럼 보인다. 이 값은 테스트와 화면이 함께 읽는다.
 */
export const INFO_PORTRAIT_FOCUS = { x: 336, y: 950, height: 1820 } as const;

/** 모든 정보창이 같은 메타데이터 보정 경로를 지나도록 focus 옵션을 한 곳에서 만든다. */
export function infoPortraitPlacement(asset: PuppetAsset, focus: { x: number; y: number; height: number }) {
  return { focus: { anchor: "core" as const, x: focus.x, y: focus.y + (asset.portraitOffsetY ?? 0) }, height: focus.height * (asset.portraitZoom ?? 1) };
}

/**
 * 원화 감상(돋보기)의 여백.
 *
 * 화면 네 변에서 이만큼만 비우고 나머지를 그림이 다 쓴다. 0으로 두지 않는 이유는 정수리와
 * 발끝이 화면 변에 딱 붙으면 잘린 것처럼 보이기 때문이다.
 */
export const GALLERY_PORTRAIT_MARGIN = 26;

/**
 * 돋보기로 여는 감상 자리.
 *
 * **그림이 한 조각도 잘리지 않는다.** 정보창의 전신은 코어 관절을 기준으로 크게 세워 종아리쯤에서
 * 판 밑변에 잘리는데, 그것을 자세히 보려고 누른 자리에서 같은 방식으로 세우면 더 크게 잘린
 * 그림을 볼 뿐이다. 여기서는 alpha 경계의 **가로와 세로 둘 다** 화면 안에 들어오는 배율을 고르고
 * (둘 중 작은 쪽), 그림 한가운데를 화면 한가운데에 둔다.
 *
 * **개체별 보정(`portraitZoom`·`portraitOffsetY`)을 태우지 않는다.** 그 둘은 정보창에서 여러
 * 개체의 얼굴 크기와 시각 중심을 맞추려고 둔 값이라, 통째로 보는 자리에서 곱하면 어떤 원화는
 * 다시 화면 밖으로 나간다.
 */
export function galleryPortraitPlacement(asset: PuppetAsset): { x: number; groundY: number; height: number } {
  const contentWidth = asset.content.right - asset.content.left;
  const contentHeight = asset.content.bottom - asset.content.top;
  const scale = Math.min(
    (BASE_WIDTH - GALLERY_PORTRAIT_MARGIN * 2) / contentWidth,
    (BASE_HEIGHT - GALLERY_PORTRAIT_MARGIN * 2) / contentHeight,
  );
  const height = contentHeight * scale;
  // `computePlacement`는 그림의 가로 가운데를 `x`에, 밑변을 `groundY`에 맞춘다 — 세로 가운데에
  // 두려면 밑변이 화면 중심보다 그림 높이의 절반만큼 아래에 있으면 된다.
  return { x: BASE_WIDTH / 2, groundY: BASE_HEIGHT / 2 + height / 2, height };
}

/**
 * 로비 광장에 선 애착 렐릭의 자리.
 *
 * 예전에는 상자 하나에 그림을 욱여넣어 크기를 정했다. 그러면 캔버스 여백과 등신이 원화마다
 * 달라 1.08 m 토리카가 1.76 m 메테보다 크게 서고, 발끝도 개체마다 다른 높이에 떴다.
 * 지금은 **바닥선 하나**(`floor`)에 발을 세우고, 키가 큰 개체가 실제로 크게 서도록
 * 기준 높이에 원화별 `lobbyZoom`을 곱한다. 기준은 메론(1.58 m)이다.
 */
export const LOBBY_PORTRAIT_SPOT = { x: BASE_WIDTH / 2, floor: 1930, height: 1740 } as const;

/** 로비 전신이 쓰는 spawn 옵션. 화면이 좌표와 배율을 손으로 적지 않는다. */
export function lobbyPortraitPlacement(asset: PuppetAsset) {
  return {
    // 꼬리가 긴 렉시아도 그림 외곽이 아니라 `중심1` 관절이 광장 중앙에 오도록 맞춘다.
    focusX: { anchor: "core" as const, x: LOBBY_PORTRAIT_SPOT.x },
    groundY: LOBBY_PORTRAIT_SPOT.floor,
    height: LOBBY_PORTRAIT_SPOT.height * (asset.lobbyZoom ?? 1),
  };
}

/** 정적으로 측정한 alpha union과 코어 관절로 실제 화면의 머리·꼬리 끝을 계산한다. */
export function portraitScreenBounds(asset: PuppetAsset, coreY: number, placement: { focusY: number; height: number }): PortraitScreenBounds {
  const scale = placement.height / (asset.content.bottom - asset.content.top);
  const top = placement.focusY + (asset.content.top - coreY) * scale;
  const bottom = placement.focusY + (asset.content.bottom - coreY) * scale;
  return { top, bottom, height: bottom - top };
}

/** 발끝을 바닥선에 맞추는 기록/전투 배치도 정보창과 같은 alpha 경계 표현을 돌려준다. */
export function groundedPortraitBounds(asset: PuppetAsset, groundY: number, height: number): PortraitScreenBounds {
  // grounded 배치는 union bottom을 정확히 groundY에 맞추므로 top은 의도 높이만큼 위다.
  const scale = height / (asset.content.bottom - asset.content.top);
  const renderedHeight = (asset.content.bottom - asset.content.top) * scale;
  return { top: groundY - renderedHeight, bottom: groundY, height: renderedHeight };
}

/** 화면 밖 꼬리는 조작판 뒤에서 잘리지만 제목 쪽 실루엣은 그대로 보존한다. */
export function visiblePortraitBounds(bounds: PortraitScreenBounds): PortraitScreenBounds {
  const top = Math.max(0, bounds.top); const bottom = Math.min(BASE_HEIGHT, bounds.bottom);
  return { top, bottom, height: Math.max(0, bottom - top) };
}
