/** 설명문 낱말 안에서 강조할 조각과 아닌 조각. */
export interface EmphasisRun {
  text: string;
  accent: boolean;
}

/** 부호·숫자·천 단위 쉼표·소수점과 뒤따르는 `%`. 조사·단위(초·겹·명)는 숫자가 아니다. */
const NUMBER_RUN = /[+\-−]?\d[\d,]*(?:\.\d+)?%?/gu;

/**
 * 낱말을 **수치 조각만** 강조하도록 가른다.
 *
 * 한국어는 조사·단위가 숫자에 붙어(`12%만큼`, `3초에`) 낱말 단위로 칠하면 숫자가 아닌 글자까지
 * 노랗게 물든다. 이어 붙이면 원래 낱말이 되도록 조각 순서를 지킨다.
 */
export function splitEmphasisRuns(word: string): EmphasisRun[] {
  const runs: EmphasisRun[] = [];
  let last = 0;
  for (const match of word.matchAll(NUMBER_RUN)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ text: word.slice(last, start), accent: false });
    runs.push({ text: match[0], accent: true });
    last = start + match[0].length;
  }
  if (last < word.length) runs.push({ text: word.slice(last), accent: false });
  return runs;
}
