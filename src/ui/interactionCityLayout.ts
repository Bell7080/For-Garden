import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 도시 쪽지의 자리표.
 *
 * **Phaser를 import하지 않는다.** 화면과 E2E가 같은 값을 읽어야 하는데, E2E는 Node에서 돌아
 * Phaser 프리팹을 불러올 수 없다. 좌표를 테스트에 손으로 적으면 배치를 고칠 때 화면은 멀쩡한데
 * 테스트만 엉뚱한 곳을 누른다.
 */
export const INTERACTION_CITY_PANEL = { width: 900, height: 1320 } as const;

/** 파견대 세 자리. 발굴과 같은 칸 규격·같은 간격이라 두 화면이 한 몸처럼 읽힌다. */
export const INTERACTION_CITY_SLOT = { y: -310, width: 210, height: 245, step: 250 } as const;

/** SD가 서는 바닥은 칸 안쪽이라 칸 중심에서 늘 같은 거리를 유지한다. */
export const INTERACTION_CITY_SLOT_GROUND_OFFSET = 110;

/** 도시 안내와 보유 렐릭 그리드가 번갈아 사는 아래 칸. 두 화면이 같은 윗변에서 시작한다. */
export const INTERACTION_CITY_LOWER = { left: -415, right: 415, top: -72, bottom: 425 } as const;

/** 아래 칸이 무엇을 보여 주든 주요 조작은 같은 높이에 선다. 발굴과 같은 자리·같은 폭이다. */
export const INTERACTION_CITY_ACTION = { y: 545, cancelX: -280, primaryX: 125 } as const;

/**
 * 쪽지 안의 주요 자리를 게임 좌표로 바꾼 것.
 *
 * 팝업 판은 화면 가운데에 서므로 판 안쪽 좌표에 화면 중심을 더하면 실제로 누를 자리가 된다.
 */
export const INTERACTION_CITY_POPUP_SPOTS = {
  /** 파견대 칸 하나의 중심. 누르면 그 자리가 골라지고 아래 칸이 목록으로 바뀐다. */
  slot: (index: number): { x: number; y: number } => ({
    x: BASE_WIDTH / 2 + (index - 1) * INTERACTION_CITY_SLOT.step,
    y: BASE_HEIGHT / 2 + INTERACTION_CITY_SLOT.y,
  }),
  /** 목록 위 오른쪽의 자동 배치. 배치 중에만 서 있다. */
  autoAssign: {
    x: BASE_WIDTH / 2 + INTERACTION_CITY_LOWER.right - 90,
    y: BASE_HEIGHT / 2 + INTERACTION_CITY_LOWER.top - 42,
  },
  /** 주요 조작. 배치 중에는 취소가 왼쪽에 서므로 오른쪽으로 밀린다. */
  primary: (editing: boolean): { x: number; y: number } => ({
    x: BASE_WIDTH / 2 + (editing ? INTERACTION_CITY_ACTION.primaryX : 0),
    y: BASE_HEIGHT / 2 + INTERACTION_CITY_ACTION.y,
  }),
} as const;
