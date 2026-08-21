/**
 * 스킬 설명 안에서 다시 눌러 볼 수 있는 용어 사전.
 *
 * "적에게 화상 피해를 입힌다"처럼 규칙이 따로 있는 말은 설명문 안에서 강조되고, 누르면 그
 * 뜻이 다시 뜬다. 설명문에 규칙을 길게 적어 넣는 대신 여기 한 번만 적어 두면 어느 스킬에서
 * 눌러도 같은 문장이 나온다.
 *
 * 설명문에서는 `[[keyword-id]]` 또는 `[[keyword-id|보여 줄 말]]`로 표시한다.
 */
export interface KeywordDef {
  id: string;
  /** 강조되어 보이는 기본 표기. 문법에서 별칭을 주면 그쪽이 우선한다. */
  term: string;
  /** 상태이상인지 강화인지처럼 한눈에 성격을 알리는 짧은 분류. */
  kind: "디버프" | "버프" | "상태" | "규칙";
  description: string;
}

export const KEYWORDS: readonly KeywordDef[] = [
  {
    id: "burn",
    term: "화상",
    kind: "디버프",
    description: "매 초 공격력의 4%만큼 고정 피해를 입는다. 겹쳐 걸면 지속 시간만 늘어난다.",
  },
  {
    id: "guard",
    term: "방어 태세",
    kind: "버프",
    description: "받는 물리 피해가 줄어든다. 같은 종류의 감소 효과와는 곱해서 적용한다.",
  },
  {
    id: "ferocity",
    term: "야성",
    kind: "규칙",
    description: "전투 중 쌓이는 원종의 본능이다. 100이 되면 통제 불능이 되어 궁극기 대신 진압으로 눌러야 한다. 유대 레벨이 높을수록 천천히 쌓인다.",
  },
];

/** 저장된 id를 검증하면서 정의를 얻는다. 없는 키워드는 링크로 만들지 않는다. */
export function findKeyword(id: string): KeywordDef | undefined {
  return KEYWORDS.find((keyword) => keyword.id === id);
}

/** 설명문 한 조각. 링크인 조각만 keyword를 갖는다. */
export interface KeywordSegment {
  text: string;
  keyword?: KeywordDef;
}

/**
 * `[[id|표기]]` 문법을 조각 배열로 가른다.
 *
 * UI가 문자열을 직접 파싱하면 화면마다 규칙이 갈라지므로, 자르는 일은 여기서만 한다.
 * 사전에 없는 id는 링크로 만들지 않고 표기만 남긴다 — 오타 하나로 설명이 사라지지 않게.
 */
export function parseKeywordText(text: string): KeywordSegment[] {
  const segments: KeywordSegment[] = [];
  const pattern = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let cursor = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    const keyword = findKeyword(match[1]);
    segments.push({ text: match[2] ?? keyword?.term ?? match[1], keyword });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
