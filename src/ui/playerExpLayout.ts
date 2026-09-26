/**
 * 연구원 경험치가 서는 두 자리의 배치표 — 결과판의 경험치 줄과 프로필의 레벨 가지나무.
 *
 * Phaser를 모르는 순수 값이라 화면과 회귀 테스트(`tests/unit/playerLevelGain.test.ts`)가 같은
 * 값을 읽는다. 좌표를 화면에 손으로 적으면 판 폭을 바꾼 날 줄 끝의 병 액자가 판 밖으로 나간다.
 */

/**
 * 연구원 경험치 **블록** — 결과판(기여도 버튼과 보상 사이)과 소탕 영수증(`RewardPopup` 머리)이 같은
 * 한 벌을 쓴다. 좌표는 블록 가운데(줄의 가운데) 기준이고 **가운데 정렬**이다:
 *
 *   ┌ LV.12 ┐  ← 레벨 판(가운데 · 위)          LEVEL UP!  ← 판 오른쪽에 비스듬히
 *   ▰▰▰▰▰▰▱▱▱▱▱        120 / 500       [병] ← 오른쪽 끝(레벨업 때만)
 *        + 30 EXP                               ← 올린 몫(가운데 · 아래)
 *
 * 레벨이 한가운데 서야 「몇 레벨이 되었나」가 가장 먼저 읽히고, 올린 몫은 그 아래 결말처럼 닫힌다.
 */
export const PLAYER_EXP_ROW = {
  /** 블록 전체 폭. 결과판(940)·영수증(920) 어느 쪽에서도 좌우 60 넘게 비운다. */
  width: 760,
  /** 블록이 차지하는 높이(레벨 판 위끝 ~ 올린 몫 아래끝). 영수증이 제 판 높이를 이만큼 늘린다. */
  height: 150,
  badge: { y: -46, width: 168, height: 56, size: 32, labelSize: 18 },
  bar: { width: 520, height: 22 },
  /** 현재 / 요구 — 줄 오른쪽 끝 위에 작게. */
  value: { y: -24, size: 18 },
  gain: { y: 40, size: 30 },
  levelUp: { gap: 18, y: -50, size: 26 },
  reward: { x: 330, size: 70 },
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
