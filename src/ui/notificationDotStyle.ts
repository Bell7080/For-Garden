/** 모든 버튼이 공유하는 붉은 점의 픽셀 규격이며 Phaser와 무관한 시각 테스트 기준이다. */
export const NOTIFICATION_DOT_STYLE = {
  radius: 13,
  fill: 0xd92f45,
  outline: 0xffffff,
  outlineWidth: 4,
  shadow: 0x090b10,
  shadowAlpha: 0.82,
  shadowOffsetY: 7,
} as const;

/** Phaser를 불러오지 않고 기울어진 판의 알림점 앵커를 검증하기 위한 좌표 계약이다. */
export interface NotificationAnchorOptions { x: number; y: number; rotation?: number }

/** 판의 로컬 우상단 좌표를 회전된 버튼 좌표로 바꾸는 순수 배치 계산이다. */
export function rotatedNotificationAnchor(options: NotificationAnchorOptions): { x: number; y: number } {
  const rotation = options.rotation ?? 0;
  const cosine = Math.cos(rotation); const sine = Math.sin(rotation);
  return { x: options.x * cosine - options.y * sine, y: options.x * sine + options.y * cosine };
}

/**
 * 원근 사다리꼴 버튼의 실제 우상단 변 안쪽을 찾은 뒤 판의 회전까지 적용한다.
 *
 * 발굴처럼 판만 별도 자식 컨테이너에서 회전하는 버튼은 바깥 컨테이너의 사각 bounds를 앵커로
 * 쓰면 점이 허공에 남는다. 이 계산은 Button의 `perspectiveRect` 규격과 같은 taper를 사용한다.
 */
export function perspectiveButtonNotificationAnchor(options: {
  width: number;
  height: number;
  tall: "left" | "right";
  rotation: number;
  inset: number;
}): { x: number; y: number } {
  const halfWidth = options.width / 2;
  const halfHeight = options.height / 2;
  const shortHalfHeight = halfHeight * (1 - 0.42);
  // 오른쪽 변이 짧은 왼쪽 버튼은 그 실제 윗점을, 오른쪽 버튼은 온전한 윗점을 기준으로 삼는다.
  const cornerY = options.tall === "left" ? -shortHalfHeight : -halfHeight;
  return rotatedNotificationAnchor({
    x: halfWidth - options.inset,
    y: cornerY + options.inset,
    rotation: options.rotation,
  });
}
