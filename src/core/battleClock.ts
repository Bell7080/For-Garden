/**
 * 전투가 얼마나 흘렀는지를 적는 **순수 시계**.
 *
 * Phaser를 읽지 않는 이유는 다른 순수 표와 같다 — 화면과 회귀 테스트가 같은 값을 읽어야 한다.
 *
 * ## 왜 100분의 1초까지 세우나
 *
 * 전투는 배속을 올려 두고 보는 시간이 훨씬 길다. 초 단위만 세우면 3배속에서 숫자가 뚝뚝
 * 끊겨 **멈춘 것처럼** 보인다. 맨 뒤 두 자리가 쉬지 않고 도는 것이 곧 "지금 돌고 있다"를
 * 말하므로, 읽어야 하는 수(분·초)는 앞에 두고 **도는 것은 뒤에 둔다.**
 *
 * ## 한 시간을 넘기면 칸이 하나 는다
 *
 * 넘길 일이 없는 것이 정상이지만, 넘겼을 때 분 자리가 `61`·`183`처럼 자라면 그 줄이 갑자기
 * 넓어져 옆의 것을 민다. 그래서 60분에서 시 자리를 하나 더 세운다 — 칸이 느는 것이 자릿수가
 * 무한히 자라는 것보다 낫다.
 */

/** 시 자리가 생기는 경계(초). */
export const BATTLE_CLOCK_HOUR_SECONDS = 3600;

/** 두 자리로 맞춘다. 음수·NaN은 0으로 닫아 화면에 새지 않게 한다. */
function pad(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

/**
 * 흐른 시간을 `MM:SS:CC`로 적는다. 한 시간을 넘기면 `HH:MM:SS:CC`가 된다.
 *
 * 맨 뒤는 100분의 1초다. **올림하지 않고 버린다** — 0.999초를 `01`초로 적으면 시작하자마자
 * 1초가 지난 것으로 보인다.
 */
export function formatBattleClock(elapsedSeconds: number): string {
  const safe = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  /*
   * **초를 먼저 쪼개고 나머지를 곱하지 않는다.** `(safe - Math.floor(safe)) * 100`으로 구하면
   * 이진수로 딱 떨어지지 않는 값에서 한 칸이 밀린다 — 3599.99는 실제로 3599.9899999999998이라
   * `59:59:98`이 됐다. 100분의 1초를 단위로 삼아 한 번만 내림하면 그 어긋남이 생기지 않는다.
   */
  const totalCentis = Math.floor(safe * 100 + 1e-6);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  if (totalSeconds < BATTLE_CLOCK_HOUR_SECONDS) return `${pad(minutes)}:${pad(seconds)}:${pad(centis)}`;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:${pad(seconds)}:${pad(centis)}`;
}

/**
 * **데스 카운트** — 끝나지 않는 판을 끝내는 시계.
 *
 * 자동 전투는 양쪽이 서로 못 죽이는 조합이 실제로 나온다. 현상수배는 제한 시간을 두어
 * 그 판을 패배로 세었지만(`BOUNTY.limitSeconds`), 나머지 모드는 손잡이가 없어 영영 돌았다.
 *
 * **제한 시간으로 끊지 않고 판을 기울인다.** 시간이 다 됐다고 그 자리에서 패배를 선언하면
 * 거의 이긴 판과 아무것도 못 한 판이 같은 결과가 된다. 대신 3분을 넘긴 순간부터 매초
 * 아군이 최대 체력의 일부를 잃고 **버티는 수단이 함께 시든다** — 이기고 있던 판은 그 안에
 * 끝나고, 못 끝내는 판은 스스로 무너진다. 어느 쪽이든 판은 반드시 닫힌다.
 *
 * ## 왜 회복·보호막까지 깎나
 *
 * 피해만 얹으면 **회복량이 그 피해보다 큰 편성**은 여전히 영원히 산다. 실제로 끝나지 않는
 * 판의 대부분이 그 모양이라, 버티는 쪽의 성능이 같이 시들어야 시계가 제 일을 한다.
 * 50초면 회복이 0이 되므로 3분 50초 안에는 어떤 편성이든 반드시 닫힌다.
 */
export const BATTLE_DEATH_CLOCK = {
  /** 이 시각(초)을 넘기는 순간부터 돈다. */
  startsAtSeconds: 180,
  /** 몇 초마다 한 번 도는가. */
  tickSeconds: 1,
  /** 한 번 돌 때 아군이 잃는 최대 체력 비율(%). 방어·경감을 지나지 않는 고정 피해다. */
  maxHpDamagePercentPerTick: 2,
  /** 한 번 돌 때 회복·보호막이 잃는 성능(%). 누적이라 50번이면 0이 된다. */
  recoveryLossPercentPerTick: 2,
} as const;

/** 그 시각까지 데스 카운트가 **몇 번 돌았어야 하는가**. 시작 전에는 0이다. */
export function deathClockTicksAt(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds)) return 0;
  const past = elapsedSeconds - BATTLE_DEATH_CLOCK.startsAtSeconds;
  if (past < 0) return 0;
  // 3분에 닿는 그 순간 첫 번째가 돈다 — 그래야 "넘어가면 작동한다"가 화면과 어긋나지 않는다.
  return Math.floor(past / BATTLE_DEATH_CLOCK.tickSeconds) + 1;
}

/**
 * 지금 회복·보호막이 내는 성능(0~1).
 *
 * 곱하는 값 하나로 두는 이유는 **회복과 보호막이 같은 속도로 시들어야** 하기 때문이다 —
 * 한쪽만 깎으면 남은 쪽으로 버티는 편성이 그대로 남는다.
 */
export function deathClockSurvivalMultiplier(elapsedSeconds: number): number {
  const lost = deathClockTicksAt(elapsedSeconds) * BATTLE_DEATH_CLOCK.recoveryLossPercentPerTick;
  return Math.min(1, Math.max(0, 1 - lost / 100));
}

/** 데스 카운트가 도는 중인가. 화면이 시계를 붉게 맥동시키는 조건과 같은 값을 읽는다. */
export function isDeathClockRunning(elapsedSeconds: number): boolean {
  return deathClockTicksAt(elapsedSeconds) > 0;
}
