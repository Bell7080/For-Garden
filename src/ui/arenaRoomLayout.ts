/**
 * 실시간 아레나 밴픽 화면의 자리. 위가 상대 칸, 가운데가 격자, 아래가 내 칸이다.
 * Phaser 없는 모듈에 두는 이유는 화면과 E2E가 같은 값을 읽어야 하기 때문이다(스펙이 손으로 좌표를 적지 않는다).
 */
export const ARENA_ROOM_LAYOUT = {
  title: { y: 96 },
  clock: { x: 950, y: 96 },
  /** 작은 기권 버튼 — 시계의 반대편(왼쪽 위). 랭크전은 뒤로가기도 같은 확인 창을 연다. 친선전에서는 「취소」라 적는다. */
  forfeit: { x: 118, y: 96, width: 156, height: 64 },
  /** 친선전 요청 대기의 큰 「요청 취소」 — 매칭 대기 화면의 「매칭 취소」와 같은 자리·크기. 친선전에는 뒤로가기가 없다. */
  cancel: { x: 540, y: 1640, width: 820, height: 140 },
  /**
   * 요청 대기 판(화면 가운데 900에 선다)의 세로 자리 — 판 중심 기준. 마스코트는 발밑(`mascotY`)에서 위로
   * 서지만 원화 여백 때문에 발밑 아래로도 한 뼘(약 110) 내려온다. 기다림 문구와 규칙 칩은 그 아래에 둬야
   * 가운데 맞부딪히는 연출 뒤로 묻히지 않는다(Puppet은 판보다 위 층이라 겹치면 글자가 가려진다).
   */
  inviteWaiting: { panel: { width: 940, height: 720 }, labelY: -270, nameY: -225, mascotY: 0, mascotHeight: 220, waitingY: 190, chipsY: 275 },
  enemyName: { y: 196 },
  enemyRow: 360,
  allyRow: 1548,
  allyName: { y: 1760 },
  slotX: [250, 540, 830] as const,
  slot: { width: 230, height: 262, card: { width: 178, height: 222 } },
  hint: { y: 524 },
  grid: { left: 180, right: 1056, top: 566, bottom: 1300, columns: 5 },
  /** 왼쪽 밴 띠. `y[0]`이 상대 밴(위), `y[1]`이 내 밴(아래) — 화면 전체가 위는 상대, 아래는 나다. */
  banColumn: { x: 88, y: [770, 1070] as const, card: { width: 132, height: 165 } },
  confirm: { x: 618, y: 1374, width: 560, height: 112 },
  /**
   * 밴 단계에는 내 1·2·3 칸 자리가 통째로 밴 칸 하나다 — 확정 버튼이 그 안에 선다. 밴이 끝나면 이 판이
   * 세 칸으로 갈라지며 픽 단계가 시작된다. 폭은 세 칸이 차지하는 폭과 같다.
   */
  banSlot: { x: 540, y: 1548, width: 810, height: 262 },
  banConfirm: { x: 540, y: 1548, width: 640, height: 132 },
  undo: { x: 236, y: 1374, width: 250, height: 96 },
  error: { y: 1846 },
} as const;
