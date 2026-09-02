import { BASE_HEIGHT } from "../config/gameConfig";
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
