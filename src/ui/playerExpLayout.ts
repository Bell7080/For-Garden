/**
 * 연구원 경험치가 서는 두 자리의 배치표 — 결과판의 경험치 줄과 프로필의 레벨 가지나무.
 *
 * Phaser를 모르는 순수 값이라 화면과 회귀 테스트(`tests/unit/playerLevelGain.test.ts`)가 같은
 * 값을 읽는다. 좌표를 화면에 손으로 적으면 판 폭을 바꾼 날 줄 끝의 병 액자가 판 밖으로 나간다.
 */

/** 결과판(`StageCompletePopup`, 폭 940) 머리의 경험치 줄. 좌표는 판 가운데 기준이다. */
export const PLAYER_EXP_ROW = {
  /** 줄 전체 폭. 결과판 폭(940)에서 좌우 70씩 비운다. */
  width: 800,
  level: { x: -400, size: 34 },
  bar: { left: -250, width: 390, height: 22 },
  gain: { gap: 22, size: 26 },
  value: { offsetY: 30, size: 18 },
  levelUp: { offsetY: -40, size: 26 },
  reward: { x: 350, size: 76 },
  /** 한 레벨을 끝까지 채우는 데 드는 시간. 짧은 몫도 `minSegmentMs` 아래로는 줄이지 않는다. */
  fullSegmentMs: 620,
  minSegmentMs: 180,
  startDelayMs: 360,
} as const;

/**
 * 판의 규격. 길이 창보다 길면 판은 `maxHeight`에서 멈추고 나무만 안에서 흐른다.
 * 머리(`chromeTop`)에는 레벨마다 받는 병 한 줄이 선다.
 */
export const LEVEL_TREE_VIEW = { width: 900, maxHeight: 1160, chromeTop: 196, chromeBottom: 64 } as const;
/** 가지 끝의 잎 한 장. 가지(`REWARD_TRACK.branch`)에서 바깥으로 벌어지되 창 밖으로 나가지 않는다. */
export const LEVEL_TREE_LEAF = { width: 340, offset: 10, lineHeight: 36, padY: 22, avatar: 58, avatarGap: 18 } as const;
/**
 * 지금 레벨 칩. 가까운 마디의 잎 **반대편**에 선다 — 같은 편에 서면 잎을 덮는다. 지금 레벨이 곧
 * 마디면(`snap` 안) 칩 없이 그 마디 이름이 강조색이 된다(칩이 마디 이름과 겹친다).
 */
export const LEVEL_TREE_CURSOR = { x: 128, width: 176, snap: 45 } as const;
