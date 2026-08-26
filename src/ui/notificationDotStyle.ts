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
