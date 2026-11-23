/**
 * 룬 이름 규칙 — 화면(이름 변경창)과 서버(`renameRune`)가 같은 함수를 읽는다.
 *
 * 글자 수는 유니코드 문자(코드 포인트)로 센다. 입력 칸(`TextInputField`)도 같은 셈으로 자르므로
 * 칸에 들어간 이름이 서버에서 길다고 거절되는 일이 없다. 이모지는 막지 않되 그것이 쓰는 문자 수만큼 센다.
 */
export const MAX_RUNE_NAME_LENGTH = 20;

/** 앞뒤 공백을 지우고, 안쪽에 겹친 공백(전각·탭 포함)을 한 칸으로 줄인다. */
export function normalizeRuneName(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export type RuneNameProblem = "empty" | "tooLong" | "invalid";

/** 다듬은 이름이 쓸 수 있는지. 금칙어는 운영 DB가 갖고 있어 서버만 따로 본다. */
export function runeNameProblem(value: string): RuneNameProblem | undefined {
  const name = normalizeRuneName(value);
  if (!name) return "empty";
  if ([...name].length > MAX_RUNE_NAME_LENGTH) return "tooLong";
  // 제어 문자와 보이지 않는 서식 문자(방향 바꿈 등)는 이름을 엉뚱하게 그리므로 받지 않는다.
  if (/[\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩﻿]/u.test(name)) return "invalid";
  return undefined;
}
