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

/**
 * 화면이 다시 서도 이어지는 "마지막으로 보여 준 글자" 기억.
 *
 * 전투를 다녀와 상단 줄이 새로 서거나 창이 매 초 다시 그려지면 칸이 빈 글자에서 시작해, 값이 변했어도
 * 굴릴 출발점이 없다. 칸이 **자리 이름**(`topbar:gold`, `stamina-popup:stamina`)으로 마지막에 보인
 * 글자를 적어 두면 다시 선 칸이 거기서부터 새 값으로 굴러 간다. 자리마다 따로 두는 이유는 같은 재화를
 * 보이는 두 칸이 서로의 출발점을 덮어쓰지 않게 하려는 것이다. 계정이 바뀌면 부트가 비운다.
 */
const rollMemory = new Map<string, string>();

export function recallRoll(key: string): string | undefined { return rollMemory.get(key); }
export function rememberRoll(key: string, text: string): void { rollMemory.set(key, text); }
export function clearRollMemory(): void { rollMemory.clear(); }
