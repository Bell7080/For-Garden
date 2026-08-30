/** 수식어 희귀도는 저장 문자열이 아니라 정적 표시와 테마 역할을 찾는 안정적인 분류다. */
export type ProfileModifierRarity = "common" | "rare" | "epic" | "legendary";

/** 획득 조건은 manager가 판정할 수 있는 불변 ID이며 화면 문구나 임의 콜백을 포함하지 않는다. */
export type ProfileModifierAcquisitionConditionId = `mission:${string}` | `research:${"daily" | "weekly"}:${string}`;

/** 저장에는 id만 남고, 변경 가능한 표시 정보는 이 정적 정의에서만 해석한다. */
export interface ProfileModifierDefinition { readonly id: string; readonly displayName: string; readonly rarity: ProfileModifierRarity; readonly acquisitionConditionId: ProfileModifierAcquisitionConditionId; }

/** 운영 중 문구를 바꿔도 저장 호환성이 유지되는 수식어 카탈로그다. */
export const PROFILE_MODIFIERS: readonly ProfileModifierDefinition[] = [
  { id: "field-pioneer", displayName: "현장 개척자", rarity: "rare", acquisitionConditionId: "mission:daily-battle" },
  { id: "steady-researcher", displayName: "꾸준한 연구자", rarity: "common", acquisitionConditionId: "mission:daily-research" },
  { id: "deep-record", displayName: "심층 기록자", rarity: "epic", acquisitionConditionId: "research:weekly:60" },
  { id: "garden-legend", displayName: "정원의 전설", rarity: "legendary", acquisitionConditionId: "research:weekly:120" },
] as const;

/** 손상되거나 삭제된 ID를 표시명으로 추측하지 않도록 안전하게 정의를 찾는다. */
export function findProfileModifier(id: string): ProfileModifierDefinition | undefined { return PROFILE_MODIFIERS.find((definition) => definition.id === id); }
