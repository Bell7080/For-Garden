/**
 * 결정적 수학 함수 — 전투 코어(`skirmish.ts`)가 쓰는 hypot·sin·cos·atan2·exp·pow.
 *
 * 서버 재현 검증은 같은 전투를 서버(Node/V8)와 플레이어 기기(iOS는 모든 브라우저가 JavaScriptCore)에서
 * 각각 돌려 결과가 같다고 가정한다. 그런데 `+ - * /`와 `Math.sqrt`는 IEEE 754가 결과를 못 박지만
 * `Math.hypot`·`sin`·`cos`·`atan2`·`exp`·`pow`는 **엔진마다 마지막 자리가 다를 수 있다**(구현 정의).
 * 마지막 자리 하나가 사거리 비교나 밀어내기 방향을 뒤집으면 수천 틱 뒤에는 다른 전투가 되어 정상 승리가
 * `COMBAT_REJECTED`로 끝난다. 그래서 전투 판정에 들어가는 이 함수들은 사칙연산과 sqrt만으로 직접 계산한다.
 * 정밀도는 쓰임새(밀어내기 방향·도약 진동·회복 감쇠)에 충분하면 되고, 중요한 것은 모든 엔진에서
 * 비트까지 같은 값이다. 입력이 NaN이면 NaN을 돌려준다.
 */

const PIO2_HI = 1.5707963267341256e0;
const PIO2_LO = 6.077100506506192e-11;
const TWO_OVER_PI = 0.6366197723675814;
const LN2_HI = 6.93147180369123816490e-1;
const LN2_LO = 1.90821492927058770002e-10;
const LN2 = LN2_HI + LN2_LO;
const LOG2E = 1.4426950408889634;

/** √(x²+y²). 두 값 모두 제곱이 넘치지 않는 전장 좌표 범위에서만 쓴다. */
export function dHypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function sinCosKernel(x: number): { s: number; c: number } {
  const k = Math.round(x * TWO_OVER_PI);
  const r = (x - k * PIO2_HI) - k * PIO2_LO;
  const z = r * r;
  const s = r + r * z * (-1.66666666666666324348e-1 + z * (8.33333333332248946124e-3 + z * (-1.98412698298579493134e-4 + z * (2.75573137070700676789e-6 + z * (-2.50507602534068634195e-8 + z * 1.58969099521155010221e-10)))));
  const c = 1 - 0.5 * z + z * z * (4.16666666666666019037e-2 + z * (-1.38888888888741095749e-3 + z * (2.48015872894767294178e-5 + z * (-2.75573143513906633035e-7 + z * (2.08757232129817482790e-9 + z * -1.13596475577881948265e-11)))));
  const q = ((k % 4) + 4) % 4;
  return q === 0 ? { s, c } : q === 1 ? { s: c, c: -s } : q === 2 ? { s: -s, c: -c } : { s: -c, c: s };
}

export function dSin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  return sinCosKernel(x).s;
}

export function dCos(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  return sinCosKernel(x).c;
}

/** 0 ≤ t ≤ 1 에서의 atan. */
function atanUnit(t: number): number {
  // atan(t) = π/4 − atan((1−t)/(1+t)) 로 [0, tan(π/8)]까지 좁힌 뒤 멱급수를 Horner로 푼다.
  const fold = t > 0.4142135623730951;
  const u = fold ? (1 - t) / (1 + t) : t;
  const z = u * u;
  let sum = 0;
  for (let n = 16; n >= 0; n--) sum = (n % 2 === 0 ? 1 : -1) / (2 * n + 1) + z * sum;
  const a = u * sum;
  return fold ? 0.7853981633974483 - a : a;
}

export function dAtan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax === 0 && ay === 0) return x < 0 || Object.is(x, -0) ? (Object.is(y, -0) || y < 0 ? -Math.PI : Math.PI) : y;
  const a = ay <= ax ? atanUnit(ay / ax) : 1.5707963267948966 - atanUnit(ax / ay);
  const angle = x >= 0 ? a : Math.PI - a;
  return y < 0 || Object.is(y, -0) ? -angle : angle;
}

export function dExp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x * LOG2E);
  const r = (x - k * LN2_HI) - k * LN2_LO;
  let sum = 1;
  for (let n = 14; n >= 1; n--) sum = 1 + (r / n) * sum;
  let scaled = sum;
  for (let i = 0; i < Math.abs(k); i++) scaled = k > 0 ? scaled * 2 : scaled / 2;
  return scaled;
}

export function dLog(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let m = x, e = 0;
  while (m >= 1.4142135623730951) { m /= 2; e += 1; }
  while (m < 0.7071067811865476) { m *= 2; e -= 1; }
  const s = (m - 1) / (m + 1), z = s * s;
  let sum = 0;
  for (let n = 14; n >= 0; n--) sum = 1 / (2 * n + 1) + z * sum;
  return e * LN2 + 2 * s * sum;
}

/** 양수 밑의 거듭제곱. 음수 밑은 쓰이지 않으므로 NaN이다. */
export function dPow(base: number, exponent: number): number {
  if (exponent === 0) return 1;
  if (base === 1) return 1;
  if (Number.isNaN(base) || Number.isNaN(exponent)) return NaN;
  if (base === 0) return exponent > 0 ? 0 : Infinity;
  if (base < 0) return NaN;
  return dExp(exponent * dLog(base));
}
