/** 기울어진 판의 네 모서리까지 포함한 축 정렬 크기다. Phaser 없이 정적 안전 영역을 검증한다. */
export function tiltedPopupSize(width: number, height: number, tilt = 0): { width: number; height: number } {
  const radians = Math.abs(tilt) * Math.PI / 180;
  return {
    width: Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)),
    height: Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)),
  };
}

/** 공용 닫기 조작의 판 모서리 기준 배치다. 렌더링과 정적 입력면 검사가 같은 수치를 쓴다. */
export const POPUP_CLOSE_LAYOUT = { centerInset: 40, hitSize: 84 } as const;
