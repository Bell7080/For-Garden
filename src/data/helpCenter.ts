/**
 * 도움말 — 게임 고유 용어 사전과 지난 안내 다시 보기의 차례표.
 *
 * **용어의 표기는 `src/i18n/glossary.ts`가 언어별로 못 박은 이름을 그대로 쓴다.** 이 표는 무엇을 어떤 순서로
 * 세우는지만 갖고, 이름·설명 문장은 `help.term.<id>.name/body` 키가 갖는다. 전투 규칙어(출혈·기절 등)는 스킬
 * 쪽지의 태그가 이미 말하므로 여기 두지 않는다 — 이 사전은 화면·재화·성장 조작처럼 처음 보면 낯선 시스템 이름이다.
 *
 * 다시 보기는 **이미 본 안내만 열린다.** 아직 들어가 보지 않은 콘텐츠의 안내는 이름만 서고 가라앉는다 — 처음
 * 들어가는 순간 그 안내가 저절로 뜨므로 미리 읽을 이유가 없고, 열리지 않은 콘텐츠를 먼저 풀어 놓지 않는다.
 */
export const HELP_TERM_IDS = [
  "relic", "research", "excavation", "archaeology", "feeding", "fragment", "breakthrough", "resonance",
  "bond", "favorite", "rune", "runecraft", "ultimate", "frenzy", "stamina", "researcherLevel",
  "fossil", "mileage", "expedition", "interaction", "formation", "combatPower",
] as const;

export type HelpTermId = (typeof HELP_TERM_IDS)[number];

/** 첫 플레이 다시 보기의 쪽 수 — `help.basics.<n>.heading/body` 키가 이만큼 있다. */
export const HELP_BASICS_PAGE_COUNT = 4;
