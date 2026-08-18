export interface Size {
  width: number;
  height: number;
}

/** 뷰포트 안에 기준 해상도를 비율 유지로 맞출 때의 배율. Phaser Scale.FIT과 같은 계산. */
export function fitScale(viewport: Size, base: Size): number {
  return Math.min(viewport.width / base.width, viewport.height / base.height);
}
