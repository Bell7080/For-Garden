import { PROFILE_MODIFIERS, findProfileModifier, type ProfileModifierDefinition, type ProfileModifierRarity } from "../data/profileModifiers";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type Session } from "../state/session";

/** 좁은 공개 프로필 헤더가 허용하는 장착 수이며 manager와 UI가 같은 제한을 공유한다. */
export const MAX_EQUIPPED_PROFILE_MODIFIERS = 3;
/** API 보상 영수증 중 수식어 조건 판정에 필요한 ID만 받는다. */
export interface ModifierRewardReceipt { claimedIds: readonly string[]; claimedResearchStageIds: readonly string[]; }
/** 희귀도를 임의 색 문자열이 아닌 theme 의미 역할로 변환한다. */
export const PROFILE_MODIFIER_RARITY_ROLE: Readonly<Record<ProfileModifierRarity, "neutral" | "research" | "expedition" | "prestige">> = { common: "neutral", rare: "research", epic: "expedition", legendary: "prestige" };

/** 획득 판정, 장착 검증, 저장 확정을 독점해 씬이 Session 배열을 직접 변경하지 않게 한다. */
export class ProfileModifierManager {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}
  /** 정적 정의에 남아 있는 고유 ID만 카탈로그 순서로 공개한다. */
  earned(): ProfileModifierDefinition[] { const ids = new Set(this.state.earnedProfileModifierIds); return PROFILE_MODIFIERS.filter(({ id }) => ids.has(id)); }
  /** 미획득·삭제·중복 ID를 제거하고 사용자 장착 순서를 상한까지 유지한다. */
  equipped(): ProfileModifierDefinition[] {
    const earned = new Set(this.earned().map(({ id }) => id)); const seen = new Set<string>();
    return this.state.equippedProfileModifierIds.flatMap((id) => { const definition = findProfileModifier(id); if (!definition || !earned.has(id) || seen.has(id) || seen.size >= MAX_EQUIPPED_PROFILE_MODIFIERS) return []; seen.add(id); return [definition]; });
  }
  /** 선택 전체를 검증한 뒤 저장하며 실패 시 메모리도 이전 상태로 되돌린다. */
  equip(ids: readonly string[]): void {
    const earned = new Set(this.earned().map(({ id }) => id)); const unique = [...new Set(ids)];
    if (unique.length > MAX_EQUIPPED_PROFILE_MODIFIERS || unique.some((id) => !earned.has(id))) throw new Error("획득하지 않은 수식어이거나 장착 상한을 넘었습니다.");
    const previous = this.state.equippedProfileModifierIds; this.state.equippedProfileModifierIds = unique;
    try { this.saves.save(this.state); } catch (error) { this.state.equippedProfileModifierIds = previous; throw error; }
  }
  /** 보상 조건과 일치한 획득 ID를 보상 스냅샷에 합쳐 호출자의 단일 persist에 포함한다. */
  static applyRewardReceipt(state: Session, receipt: ModifierRewardReceipt): Session {
    const conditions = new Set([...receipt.claimedIds.map((id) => `mission:${id}`), ...receipt.claimedResearchStageIds.map((id) => `research:${id}`)]);
    const earned = new Set(state.earnedProfileModifierIds);
    PROFILE_MODIFIERS.forEach((definition) => { if (conditions.has(definition.acquisitionConditionId)) earned.add(definition.id); });
    return { ...state, earnedProfileModifierIds: PROFILE_MODIFIERS.filter(({ id }) => earned.has(id)).map(({ id }) => id) };
  }
}
/** 앱 전역 UI가 공유하는 manager 인스턴스다. */
export const profileModifierManager = new ProfileModifierManager();
