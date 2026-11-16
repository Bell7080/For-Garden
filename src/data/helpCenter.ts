/**
 * 도움말 — 게임 고유 용어 사전과 지난 안내 다시 보기의 차례표.
 *
 * **용어의 표기는 `src/i18n/glossary.ts`가 언어별로 못 박은 이름을 그대로 쓴다.** 이 표는 무엇을 어떤 순서로
 * 세우는지만 갖고, 이름·설명 문장은 `help.term.<id>.name/body` 키가 갖는다. 전투 규칙어(출혈·기절 등)는 스킬
 * 쪽지의 태그가 이미 말하므로 여기 두지 않는다 — 이 사전은 화면·재화·성장 조작처럼 처음 보면 낯선 시스템 이름이다.
 *
 * 용어는 **갈래(수집·연구 · 성장 · 룬 · 전투 · 콘텐츠)로 묶어** 세우고, 줄은 이름만 선 채 접혀 있다가 누르면 설명이
 * 펼쳐진다 — 스물두 개의 설명이 한꺼번에 펼쳐져 있으면 찾는 이름이 문단 사이에 묻힌다.
 *
 * 다시 보기는 **이미 본 안내만 열린다.** 아직 들어가 보지 않은 콘텐츠의 안내는 이름만 서고 가라앉는다 — 처음
 * 들어가는 순간 그 안내가 저절로 뜨므로 미리 읽을 이유가 없고, 열리지 않은 콘텐츠를 먼저 풀어 놓지 않는다.
 */
export const HELP_TERM_GROUPS = [
  { id: "collect", terms: ["relic", "research", "fossil", "mileage", "fragment"] },
  { id: "growth", terms: ["feeding", "breakthrough", "resonance", "bond", "favorite", "researcherLevel", "combatPower"] },
  { id: "rune", terms: ["rune", "runecraft"] },
  { id: "battle", terms: ["formation", "ultimate", "frenzy", "stamina"] },
  { id: "content", terms: ["excavation", "archaeology", "expedition", "interaction"] },
] as const;

export type HelpTermGroupId = (typeof HELP_TERM_GROUPS)[number]["id"];

/** 갈래 순서대로 편 용어 전부. */
export const HELP_TERM_IDS = HELP_TERM_GROUPS.flatMap((group) => group.terms);

export type HelpTermId = (typeof HELP_TERM_GROUPS)[number]["terms"][number];

/** 첫 플레이 다시 보기의 쪽 수 — `help.basics.<n>.heading/body` 키가 이만큼 있다. */
export const HELP_BASICS_PAGE_COUNT = 4;
