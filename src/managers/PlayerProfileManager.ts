import type { PublicProfileModifier } from "../state/playerProfile";
import type { ProfileModifierSelectionDto } from "../api/contracts";
import type { AsyncArenaProfileApi } from "../api/asyncArenaContracts";
import type { Session } from "../state/session";
import { playerProfileDisplay, type PlayerProfileDisplay } from "../state/playerProfile";

/** 좁은 모바일 헤더에서 시각적 위계를 유지하기 위한 공개 장착 상한이다. */
export const MAX_EQUIPPED_PROFILE_MODIFIERS = 3;

/**
 * 서버/API 영수증의 획득 목록을 단일 기준으로 삼아 장착 수식어를 검증한다.
 * 알 수 없는 ID, 미획득 ID, 중복 ID는 노출하지 않으며 변조된 선택이 UI까지 전파되지 않게 한다.
 */
export function validateEquippedProfileModifiers(
  catalog: readonly PublicProfileModifier[],
  selection: ProfileModifierSelectionDto,
): PublicProfileModifier[] {
  const definitions = new Map(catalog.filter((item) => item.id.trim() && item.displayName.trim()).map((item) => [item.id, item]));
  const earned = new Set(selection.earnedModifierIds.filter((id) => definitions.has(id)));
  const seen = new Set<string>();
  const result: PublicProfileModifier[] = [];
  for (const id of selection.equippedModifierIds) {
    // 장착 순서는 사용자의 선택이므로 유지하되, 공개 가능한 고유 획득 항목만 상한까지 복사한다.
    if (!earned.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...definitions.get(id)! });
    if (result.length === MAX_EQUIPPED_PROFILE_MODIFIERS) break;
  }
  return result;
}

/** 서버 확정 티어를 로컬 진행과 합쳐 공개 프로필을 만드는 유일한 manager/API 경계다. */
export async function loadPlayerProfileDisplay(state: Session, arenaApi: AsyncArenaProfileApi): Promise<PlayerProfileDisplay> {
  const arena = await arenaApi.getAsyncArenaServerState();
  const tierId = arena?.seasonTierId?.trim();
  // 서버 데이터가 없거나 빈 ID면 항목을 통째로 생략한다. 표시명도 서버 확정 ID를 그대로 쓴다.
  return playerProfileDisplay(state, [], tierId ? { tierId, displayName: tierId } : undefined);
}
