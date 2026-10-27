/**
 * 재화 숫자가 굴러가는 중간 글자를 짓는 순수 규칙이다.
 *
 * 칸의 값은 `1,234`·`64/122`·`1.2K`처럼 부르는 쪽이 이미 다듬어 넘긴다. 굴릴 때도 그 모양을
 * 그대로 지켜야 칸 폭이 흔들리지 않으므로, **새 글자의 첫 숫자 덩어리만** 같은 꼴(쉼표·소수 자리·
 * K/M 접미사)로 보간해 바꿔 끼운다. 나머지(`/122` 같은 상한)는 그대로 둔다.
 */
const NUMBER = /(\d[\d,]*(?:\.\d+)?)([KMB]?)/;
const UNIT: Readonly<Record<string, number>> = { "": 1, K: 1e3, M: 1e6, B: 1e9 };

interface Parsed { raw: number; decimals: number; commas: boolean; suffix: string; start: number; end: number }

function parse(text: string): Parsed | undefined {
  const match = NUMBER.exec(text);
  if (!match) return undefined;
  const digits = match[1];
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  const suffix = match[2];
  return { raw: Number(digits.replace(/,/g, "")) * UNIT[suffix], decimals, commas: digits.includes(","), suffix, start: match.index, end: match.index + match[0].length };
}

/** 두 글자의 첫 숫자를 읽어 굴릴 수 있으면 [시작 값, 끝 값]을, 아니면 undefined를 돌려준다. */
export function rollEndpoints(from: string, to: string): [number, number] | undefined {
  const a = parse(from); const b = parse(to);
  if (!a || !b || a.raw === b.raw) return undefined;
  return [a.raw, b.raw];
}

/** `to`의 첫 숫자를 `value`(원래 단위의 값)로 바꾼 글자. */
export function rollText(to: string, value: number): string {
  const parsed = parse(to);
  if (!parsed) return to;
  const scaled = value / UNIT[parsed.suffix];
  const fixed = parsed.decimals > 0 ? scaled.toFixed(parsed.decimals) : String(Math.round(scaled));
  const shown = parsed.commas ? Number(fixed).toLocaleString("en-US", { minimumFractionDigits: parsed.decimals, maximumFractionDigits: parsed.decimals }) : fixed;
  return to.slice(0, parsed.start) + shown + parsed.suffix + to.slice(parsed.end);
}
