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

/**
 * 돌아오는 재화 액자 한 칸.
 *
 * 액자를 키운 것은 **눌러서 재화 안내를 여는 자리**이기도 하기 때문이다 — 엄지가 닿아야 하는
 * 칸이 작으면 옆 칸까지 함께 눌린다. 품목이 늘면 판을 키우지 않고 이 줄만 가로로 흐른다.
 */
export const INTERACTION_CITY_REWARD_FRAME = { size: 104, gap: 20 } as const;

/**
 * 안내 원화 한 장과 그 아래 설명이 갖는 자리.
 *
 * 원화를 낮춘 것은 아래 네 줄이 서로를 밟지 않을 만큼의 자리를 내주기 위해서다 — 판을 키우면
 * 위 칸의 파견대와 아래 조작이 함께 밀린다.
 */
export const INTERACTION_CITY_BRIEF_ART = { height: 200, descriptionGap: 26, descriptionSize: 25 } as const;

/**
 * 아래 칸 안내의 세로 차례 — **아래 칸 밑변에서부터 위로 재는 값**이다.
 *
 * 예전에는 "돌아오는 것" 이름표가 소요 시간과 **같은 줄에 겹쳐** 두 문장이 서로를 갉아먹었다.
 * 화면에서 눈대중으로 몇 픽셀씩 옮기지 않도록 네 줄의 차례를 한 표로 두고, 줄 사이가 실제로
 * 벌어지는지는 `tests/unit/interactionCityLayout.test.ts`가 지킨다.
 */
export const INTERACTION_CITY_BRIEF_ROWS = { divider: -186, duration: -152, rewardLabel: -112, rewardFrames: -30 } as const;

/** 안내 줄의 글자 크기. 줄이 서로를 밟지 않는지 재려면 높이도 같은 표에서 나와야 한다. */
export const INTERACTION_CITY_BRIEF_TEXT = { duration: 26, rewardLabel: 22 } as const;

/**
 * 아래 칸이 무엇을 보여 주든 주요 조작은 같은 높이에 선다. 발굴과 같은 자리다.
 *
 * **폭도 여기서 정한다.** 이 판만 우하단에 뒤로가기를 함께 세우므로, 조작 줄이 그 자리까지
 * 뻗으면 배치 중에 보내기 버튼이 뒤로가기에 깔린다. 자리와 폭이 두 파일에 갈려 있으면 한쪽만
 * 고쳐 그때부터 겹친다.
 */
export const INTERACTION_CITY_ACTION = {
  y: 545,
  cancelX: -300, cancelWidth: 220, cancelHeight: 82,
  primaryX: 40,
  /** 배치 중에는 취소가 왼쪽에 서므로 조금 좁아진다. */
  editingWidth: 400, editingHeight: 92,
  width: 460, height: 108,
} as const;

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
