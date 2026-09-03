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
    description: "전투 중 쌓이는 원종의 본능이다. 가득 차면 폭주해 피해가 크게 오르고, 그 상태에서도 궁극기를 쓸 수 있다. 유대 레벨이 높을수록 빨리 쌓이며, 폭주는 시간이 지나면 스스로 가라앉는다.",
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
    id: "overpaint", term: "덧칠", kind: "디버프",
    description: "겹쳐 칠할수록 그 적이 **받는 모든 피해**가 커진다. 스스로는 피해를 주지 않고 파티 전체의 타격을 키우며, 다시 칠하면 유지 시간이 처음부터 다시 흐른다.",
  },
  {
    id: "tailwind", term: "순풍", kind: "버프",
    description: "정해진 시간 동안 공격 속도와 이동 속도가 각각 20% 오른다. 같은 순풍을 다시 받으면 남은 시간이 더 긴 쪽으로 갱신된다.",
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
  {
    id: "ap", term: "주문력", kind: "규칙",
    description: "마법 스킬과 일부 회복 스킬의 실제 수치를 정하는 능력치다.",
  },
  // 스피나처럼 하나의 스킬에 여러 전투 규칙이 얽힌 경우에도 짧은 본문에서 세부 규칙을 다시 열어 볼 수 있게 한다.
  {
    id: "basic-attack", term: "기본 공격", kind: "규칙",
    description: "게이지를 소비하지 않고 공격 주기마다 사용하는 공격이다. 적중할 때마다 발동하는 효과의 기준이 된다.",
  },
  {
    id: "attack-speed", term: "공격 속도", kind: "규칙",
    description: "기본 공격 사이의 간격을 정하는 수치다. 높을수록 더 자주 공격하며, 일부 스킬은 현재 수치를 피해로 바꾼다.",
  },
  {
    id: "stealth", term: "은신", kind: "버프",
    description: "지속되는 동안 적의 단일 대상 선택에서 제외된다. 시간이 끝나면 다시 대상으로 선택될 수 있다.",
  },
  {
    id: "transfer", term: "전이", kind: "규칙",
    description: "처음 계산한 순수 피해가 아니라 치명타·방어·보호막·받는 피해 경감·무효화와 과잉 피해 제한을 모두 거친 뒤 주 대상이 실제로 잃은 최종 HP 피해를 기준으로 일부를 다른 대상에게 옮긴다.",
  },
  {
    id: "pack-hunt", term: "무리 사냥", kind: "버프",
    description: "아군 중 전투 시작 공격력이 가장 높은 렐릭의 현재 표적을 함께 노린다. 공격력이 같으면 편성 순서가 앞선 렐릭을 따른다.",
  },
  // 순간이동은 이동 애니메이션처럼 보이더라도 경로·속도·시간 계산을 거치지 않는 좌표 변경 규칙이다.
  {
    id: "teleport", term: "순간이동", kind: "규칙",
    description: "이동 경로를 거치지 않고 즉시 목표 지점으로 위치를 변경한다. 이동 속도나 이동 시간의 영향을 받지 않는다.",
  },
  {
    id: "combo", term: "연격", kind: "규칙",
    description: "한 번의 기본 공격 행동이 여러 번 적중한다. 각 타격은 적중 효과와 타격 직후 회복을 각각 발동한다.",
  },
  {
    id: "missing-hp", term: "잃은 체력", kind: "규칙",
    description: "최대 체력에서 현재 체력을 뺀 값이다. 잃은 체력 비례 회복은 각 적중 직후의 값을 다시 계산한다.",
  },
  {
    id: "physical-damage", term: "물리 피해", kind: "규칙",
    description: "공격력 또는 명시된 능력치로 계산하고 대상의 방어력으로 감소하는 피해다.",
  },
  {
    id: "magical-damage", term: "마법 피해", kind: "규칙",
    description: "주문력 또는 명시된 능력치로 계산하고 대상의 저항력으로 감소하는 피해다.",
  },
  {
    id: "crowd-control", term: "군중제어", kind: "규칙",
    description: "기절·경직처럼 대상의 행동을 막는 효과를 통틀어 부르는 말이다.",
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
