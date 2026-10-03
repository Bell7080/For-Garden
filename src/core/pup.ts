/**
 * 디안의 새끼 늑대 한 마리가 가진 규칙 값.
 *
 * `statRatio`는 쿠로·시로 능력치 대비 비율, `maxAlive`는 동시에 설 수 있는 수(미리 만들어 두는 자리 수이기도 하다),
 * `standingWolfMax`는 패시브 돌파가 세는 늑대의 최대 수(쿠로·시로 둘 + 새끼)다. 화면 문구와 전투가 같은 값을 읽는다.
 */
export const PUP = { statRatio: 0.3, bodyScale: 0.4, lifeSeconds: 10, maxAlive: 10, standingWolfMax: 12 } as const;
