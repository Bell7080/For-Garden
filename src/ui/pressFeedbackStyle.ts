/**
 * 누르는 손맛의 값. **모든 버튼·탭·칩이 이 한 표를 읽는다**(`pressFeedback.ts`).
 *
 * 누르면 **살짝 눌려 들어가고**, 떼면 한 번 튕겼다가 제자리로 돌아온다. 예전에는 "누르면 커진다"를
 * 프리팹마다 1.03~1.16배로 제각각 적고 `setScale`로 뚝 바꿔 끼워, 같은 손짓이 화면마다 다른 무게로
 * 읽혔고 움직임이 없어 눌렸다는 느낌이 나지 않았다. 세기는 셋뿐이다 — 늘 누르는 것(일반), 한 판을
 * 시작하는 것(주요), 게임의 손맛 그 자체인 급여(급여).
 *
 * Phaser를 읽지 않는 순수 표라 테스트가 같은 값을 지킨다.
 */
export const PRESS_FEEDBACK = {
  tiers: {
    /** 일반 버튼·탭·칩·아이콘. */
    normal: { down: 0.94, downMs: 70, pop: 1.04, popMs: 200 },
    /** 출격·전투 시작처럼 한 판을 여는 조작. 조금 더 깊이 눌리고 더 튄다. */
    primary: { down: 0.92, downMs: 80, pop: 1.06, popMs: 230 },
    /** 급여. 연타하는 손이라 눌림은 짧고 튕김이 가장 통통하다. */
    feed: { down: 0.9, downMs: 50, pop: 1.08, popMs: 210 },
  },
  /** 움직임 줄이기: 튕기지 않고 이 시간에 제자리로만 돌아온다. */
  reducedReturnMs: 90,
} as const;

export type PressTier = keyof typeof PRESS_FEEDBACK.tiers;
