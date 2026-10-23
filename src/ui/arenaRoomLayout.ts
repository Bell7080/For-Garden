/**
 * 실시간 아레나 밴픽 화면의 자리. 위가 상대 칸, 가운데가 격자, 아래가 내 칸이다.
 * Phaser 없는 모듈에 두는 이유는 화면과 E2E가 같은 값을 읽어야 하기 때문이다(스펙이 손으로 좌표를 적지 않는다).
 */
export const ARENA_ROOM_LAYOUT = {
  title: { y: 96 },
  clock: { x: 950, y: 96 },
  enemyName: { y: 196 },
  enemyRow: 360,
  allyRow: 1548,
  allyName: { y: 1760 },
  slotX: [250, 540, 830] as const,
  slot: { width: 230, height: 262, card: { width: 178, height: 222 } },
  hint: { y: 524 },
  grid: { left: 180, right: 1056, top: 566, bottom: 1300, columns: 5 },
  banColumn: { x: 88, y: [770, 1070] as const, card: { width: 132, height: 165 } },
  confirm: { x: 618, y: 1374, width: 560, height: 112 },
  undo: { x: 236, y: 1374, width: 250, height: 96 },
  error: { y: 1846 },
} as const;
