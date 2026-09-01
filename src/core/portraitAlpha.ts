/** 초상 효과 한 겹의 알파 입력이다. Phaser 객체와 무관해 합성 계약을 단위 테스트할 수 있다. */
export interface PortraitAlphaLayers {
  /** 원본 초상 텍스처 픽셀의 알파(투명 배경은 0, 칠해진 픽셀은 최대 1)다. */
  sourcePixelAlpha: number;
  /** 선택·충전 가림막처럼 현재 효과가 요구하는 알파다. */
  effectAlpha: number;
  /** 사망·비활성처럼 완성된 카드 전체에 마지막으로 적용하는 알파다. */
  cardAlpha: number;
}

/** 잘못된 외부 상태가 WebGL 합성 범위를 벗어나지 않도록 알파를 0~1로 제한한다. */
const clampAlpha = (alpha: number): number => Math.min(1, Math.max(0, alpha));

/**
 * 실제 초상 픽셀 위에 그리는 효과 한 겹의 최종 알파를 계산한다.
 *
 * 순서는 `원본 픽셀 → 효과 → 카드 전체`이며 각 몫은 정확히 한 번만 곱한다. 머리 복제본에
 * 카드 알파를 미리 굽고 다시 컨테이너 알파를 주는 식의 중복 감쇠를 막기 위한 순수 계약이다.
 */
export function compositePortraitEffectAlpha(layers: PortraitAlphaLayers): number {
  return clampAlpha(layers.sourcePixelAlpha) * clampAlpha(layers.effectAlpha) * clampAlpha(layers.cardAlpha);
}
