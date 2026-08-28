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
    description: "전투 중 쌓이는 원종의 본능이다. 가득 차면 폭주해 피해가 크게 오르고, 그 상태에서도 궁극기를 쓸 수 있다. 유대 레벨이 높을수록 빨리 쌓인다. 관제탑은 필요할 때 진압으로 게이지를 비워 되돌릴 수 있다.",
  },
  {
    id: "bleed",
    term: "출혈",
    kind: "디버프",
    description: "3초 동안 매 초 최대 체력의 2%만큼 고정 피해를 입는다. 방어력으로 줄일 수 없다.",
  },
  {
    id: "stagger", term: "경직", kind: "디버프",
    description: "약 0.1초 동안 행동을 멈춘다. 짧지만 진행 중인 시전을 끊을 수 있다.",
  },
  {
    id: "regeneration", term: "지속 회복", kind: "버프",
    description: "정해진 시간 동안 일정한 간격으로 체력을 회복한다.",
  },
  {
    id: "stun", term: "기절", kind: "디버프",
    description: "지속되는 동안 이동하거나 공격하거나 스킬을 사용할 수 없다.",
  },
  {
    id: "hp", term: "체력", kind: "규칙",
    description: "전투에서 버틸 수 있는 생명력이다. 모두 소진되면 전투할 수 없다.",
  },
  {
    id: "atk", term: "공격력", kind: "규칙",
    description: "기본 공격과 일부 스킬의 실제 피해량을 정하는 수치다.",
  },
  {
    id: "def", term: "방어력", kind: "규칙",
    description: "받는 물리 피해를 줄이고 일부 방어형 스킬의 실제 피해량을 정한다.",
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
export function parseKeywordText(text: string, contextualKeywords: readonly KeywordDef[] = []): KeywordSegment[] {
  const segments: KeywordSegment[] = [];
  const pattern = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
  let cursor = 0;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index) });
    // 피해 수치처럼 스킬마다 설명이 달라지는 용어는 호출 화면이 넘긴 정의를 먼저 사용한다.
    const keyword = contextualKeywords.find((candidate) => candidate.id === match[1]) ?? findKeyword(match[1]);
    segments.push({ text: match[2] ?? keyword?.term ?? match[1], keyword });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
