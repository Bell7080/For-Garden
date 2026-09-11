/**
 * 원화를 칸에 채워 넣을 때 **늘이지 않고 잘라 내는** 규칙.
 *
 * 상자 크기에 그림을 맞춰 넣으면(`setDisplaySize`) 원화마다 비율이 달라 얼굴이 옆으로
 * 퍼지거나 세로로 눌린다. 그림은 제 비율 그대로 두고 **넘치는 만큼만 잘라** 칸을 채운다 —
 * 일부만 보여도 좋으니 생김새는 바뀌지 않는다.
 *
 * Phaser를 import하지 않는 이유는 화면과 테스트가 같은 값을 읽어야 하기 때문이다. 잘라 내는
 * 것은 기하 마스크가 아니라 이미지 자신의 crop이라, 세로로 흐르는 목록에서도 컨테이너를 따라
 * 함께 움직인다 — 기하 마스크는 컨테이너 이동을 물려받지 않아 스크롤하는 순간 그림만 제자리에
 * 남는다.
 */
export interface CoverCrop {
  /** 그림에 걸 배율. 가로·세로 중 모자란 쪽에 맞춰 칸을 덮는다. */
  readonly scale: number;
  /** 원본 픽셀 좌표로 잘라 낼 네모. 그림 한가운데를 남긴다. */
  readonly cropX: number;
  readonly cropY: number;
  readonly cropWidth: number;
  readonly cropHeight: number;
}

export function coverCrop(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number): CoverCrop {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { scale: 1, cropX: 0, cropY: 0, cropWidth: Math.max(0, sourceWidth), cropHeight: Math.max(0, sourceHeight) };
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  // 잘라 낼 몫은 원본 픽셀이라 배율로 되돌린다. 반올림 오차로 한 줄이 비지 않도록 원본을 넘지 않게 막는다.
  const cropWidth = Math.min(sourceWidth, targetWidth / scale);
  const cropHeight = Math.min(sourceHeight, targetHeight / scale);
  return {
    scale,
    cropX: (sourceWidth - cropWidth) / 2,
    cropY: (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
  };
}
