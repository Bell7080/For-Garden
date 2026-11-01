/**
 * 순위 칩의 자리 값 — Phaser 없이 읽혀야 하는 수만 둔다. 화면 배치표(`guildLayout.ts` 등)와 회귀 테스트가 칩이 차지하는
 * 자리를 같은 값으로 재야, 순위표의 줄이 칩 밑으로 파고드는 일을 테스트가 잡는다. 칩을 그리는 일은 `RankingChips.ts`가 한다.
 */

/** 칩 한 변. 연구소·고고학의 상점 칩과 같은 크기다. */
export const RANKING_CHIP_SIZE = 104;

/** 순위표 창 안의 보상 칩 자리 — 판 왼쪽 변과 윗변에서 잰 칩 가운데. 결투장·아레나·고대 지층·원정 순위표가 같은 값을 쓴다. */
export const RANKING_POPUP_REWARD_CHIP = { left: 96, top: 82 } as const;

/** 보상 칩의 밑변 — 판 윗변에서 잰 거리. 칩 아래에 서는 첫 줄은 이보다 아래에서 시작해야 한다. */
export const RANKING_POPUP_REWARD_CHIP_BOTTOM = RANKING_POPUP_REWARD_CHIP.top + RANKING_CHIP_SIZE / 2;
