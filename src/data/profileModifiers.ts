import { registerDataText } from "../i18n";
/** 수식어 희귀도는 저장 문자열이 아니라 정적 표시와 테마 역할을 찾는 안정적인 분류다. */
export type ProfileModifierRarity = "common" | "rare" | "epic" | "legendary";

/** 획득 조건은 manager가 판정할 수 있는 불변 ID이며 화면 문구나 임의 콜백을 포함하지 않는다. */
export type ProfileModifierAcquisitionConditionId = `mission:${string}` | `research:${"daily" | "weekly"}:${string}` | `achievement:${string}`;

/** 저장에는 id만 남고, 변경 가능한 표시 정보는 이 정적 정의에서만 해석한다. */
export interface ProfileModifierDefinition { readonly id: string; readonly displayName: string; readonly rarity: ProfileModifierRarity; readonly acquisitionConditionId: ProfileModifierAcquisitionConditionId; }

/** 운영 중 문구를 바꿔도 저장 호환성이 유지되는 수식어 카탈로그다. */
export const PROFILE_MODIFIERS: readonly ProfileModifierDefinition[] = [
  { id: "field-pioneer", displayName: "현장 개척자", rarity: "rare", acquisitionConditionId: "mission:daily-battle" },
  { id: "steady-researcher", displayName: "꾸준한 연구자", rarity: "common", acquisitionConditionId: "mission:daily-research" },
  { id: "deep-record", displayName: "심층 기록자", rarity: "epic", acquisitionConditionId: "research:weekly:60" },
  { id: "garden-legend", displayName: "정원의 전설", rarity: "legendary", acquisitionConditionId: "research:weekly:120" },
  /*
   * 업적의 마지막 단계를 받는 순간 열리는 수식어(`data/achievements.ts`의 `modifierId`). 희귀도는 그 줄을
   * 끝내는 데 드는 시간을 말한다 — 1억 골드·결투 300승·원정 20만 점처럼 오래 걸리는 줄만 전설이다.
   */
  { id: "millionaire", displayName: "백만장자", rarity: "legendary", acquisitionConditionId: "achievement:wealth" },
  { id: "specimen-curator", displayName: "표본 관리인", rarity: "epic", acquisitionConditionId: "achievement:collector" },
  { id: "limit-breaker", displayName: "한계를 넘은 자", rarity: "epic", acquisitionConditionId: "achievement:limit-break" },
  { id: "kind-researcher", displayName: "다정한 연구원", rarity: "rare", acquisitionConditionId: "achievement:bond" },
  { id: "chief-researcher", displayName: "수석 연구원", rarity: "epic", acquisitionConditionId: "achievement:research-level" },
  { id: "veteran", displayName: "백전노장", rarity: "epic", acquisitionConditionId: "achievement:victories" },
  { id: "front-breaker", displayName: "전선 돌파자", rarity: "rare", acquisitionConditionId: "achievement:frontline" },
  { id: "arena-ruler", displayName: "결투장의 지배자", rarity: "legendary", acquisitionConditionId: "achievement:duelist" },
  { id: "raid-captain", displayName: "토벌대장", rarity: "rare", acquisitionConditionId: "achievement:raider" },
  { id: "deep-salvager", displayName: "심해 인양가", rarity: "legendary", acquisitionConditionId: "achievement:salvager" },
  { id: "fossil-appraiser", displayName: "화석 감정사", rarity: "epic", acquisitionConditionId: "achievement:fossil-lab" },
  { id: "city-envoy", displayName: "도시의 사절", rarity: "rare", acquisitionConditionId: "achievement:dispatch" },
  { id: "story-collector", displayName: "이야기 수집가", rarity: "rare", acquisitionConditionId: "achievement:storyteller" },
  { id: "cheesecake-artisan", displayName: "치즈케이크 장인", rarity: "rare", acquisitionConditionId: "achievement:feeding" },
  { id: "tireless", displayName: "지칠 줄 모르는", rarity: "epic", acquisitionConditionId: "achievement:stamina" },
  { id: "diligent-researcher", displayName: "성실한 연구원", rarity: "epic", acquisitionConditionId: "achievement:diligence" },
  { id: "challenger", displayName: "정점의 도전자", rarity: "legendary", acquisitionConditionId: "achievement:duel-tier" },
  { id: "stratum-explorer", displayName: "지층 탐사가", rarity: "rare", acquisitionConditionId: "achievement:archaeologist" },
  { id: "walking-codex", displayName: "걸어 다니는 도감", rarity: "legendary", acquisitionConditionId: "achievement:codex-complete" },
] as const;

/** 손상되거나 삭제된 ID를 표시명으로 추측하지 않도록 안전하게 정의를 찾는다. */
export function findProfileModifier(id: string): ProfileModifierDefinition | undefined { return PROFILE_MODIFIERS.find((definition) => definition.id === id); }

/** 프로필 수식어를 언어별로 덮어쓸 수 있게 등록한다. */
for (const modifier of PROFILE_MODIFIERS) {
  registerDataText(modifier, "displayName", `modifier.${modifier.id}.name`);
}
