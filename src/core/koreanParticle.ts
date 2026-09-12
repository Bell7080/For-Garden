/**
 * 한국어 조사를 **받침으로 골라** 준다.
 *
 * 문구 표는 `「{name}」을 시전한다`처럼 조사를 글자로 적어 두는데, 그 자리에 들어오는 이름은
 * 받침이 있을 수도 없을 수도 있다 — 「지각 붕괴」는 `를`, 「온화한 방패」는 `가`가 맞는데 표에
 * 적힌 한 글자가 그대로 서서 **두 문장 다 틀린 채로** 화면에 있었다.
 *
 * 규칙 자체는 "문장을 조각내어 이어 붙이지 않는다"와 부딪히지 않는다 — 조각내는 것이 아니라
 * **자리 표시 하나가 값과 그 뒤의 조사까지 함께** 채우기 때문이다(`{name:을}`). 자리 이름은
 * 여전히 `name` 하나라 다른 언어의 표는 조사를 적지 않고 `{name}`만 쓰면 된다.
 */

/** 표에 적을 수 있는 조사 쌍. 앞이 받침 있는 쪽, 뒤가 없는 쪽이다. */
const PAIRS: readonly (readonly [string, string])[] = [
  ["은", "는"], ["이", "가"], ["을", "를"], ["과", "와"], ["으로", "로"], ["아", "야"], ["이라", "라"],
];

/**
 * 조사를 고를 때 읽는 마지막 글자.
 *
 * 이름은 `「지각 붕괴」`처럼 **따옴표에 싸여** 들어오므로 끝 글자를 그대로 읽으면 `」`가 잡힌다.
 * 뒤에서부터 한글·숫자·영문 한 글자를 찾아 그것으로 판단한다.
 */
function lastSpokenChar(value: string): string | undefined {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const char = value[index];
    if (/[0-9A-Za-z가-힣]/.test(char)) return char;
  }
  return undefined;
}

/** 숫자는 읽는 소리로 받침을 가른다 — 1(일)·3(삼)·6(육)·7(칠)·8(팔)·0(영)이 받침 있는 쪽이다. */
const DIGITS_WITH_FINAL = new Set(["0", "1", "3", "6", "7", "8"]);

/** 마지막 글자에 받침이 있는가. 판단할 글자가 없으면 없는 쪽으로 본다. */
export function hasFinalConsonant(value: string): boolean {
  const char = lastSpokenChar(value);
  if (char === undefined) return false;
  if (DIGITS_WITH_FINAL.has(char)) return true;
  if (/[0-9]/.test(char)) return false;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/** `ㄹ` 받침인가. `으로/로`만 이 경우를 받침 없는 쪽과 같이 다룬다. */
function endsWithRieul(value: string): boolean {
  const char = lastSpokenChar(value);
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

/**
 * 값 뒤에 붙일 조사를 고른다. 표에 없는 말을 적어 두면 그대로 돌려준다 — 조사가 아닌 글자를
 * 적은 표가 조용히 사라지지 않게 하려는 것이다.
 */
export function pickParticle(value: string, particle: string): string {
  const pair = PAIRS.find(([withFinal, withoutFinal]) => withFinal === particle || withoutFinal === particle);
  if (!pair) return particle;
  const [withFinal, withoutFinal] = pair;
  // `으로/로`는 `ㄹ` 받침도 받침 없는 쪽을 쓴다(`서울로`).
  if (withFinal === "으로" && endsWithRieul(value)) return withoutFinal;
  return hasFinalConsonant(value) ? withFinal : withoutFinal;
}
