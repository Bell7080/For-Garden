import type { PublicProfileModifier } from "../state/playerProfile";
import type { ProfileModifierSelectionDto } from "../api/contracts";
import { arenaAvailable, arenaStanding, cachedArenaScore, arenaStandingKnown } from "../api/arenaApi";
import { arenaPublicStanding } from "../core/arenaStanding";
import type { Session } from "../state/session";
import { playerProfileDisplay, type PlayerProfileDisplay } from "../state/playerProfile";
import { ProfileModifierManager, profileModifierManager, MAX_EQUIPPED_PROFILE_MODIFIERS } from "./ProfileModifierManager";
import { session } from "../state/session";

/** 좁은 모바일 헤더에서 시각적 위계를 유지하기 위한 공개 장착 상한이다. */
export { MAX_EQUIPPED_PROFILE_MODIFIERS } from "./ProfileModifierManager";

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

/** 내 아레나 RP를 어디서 읽는가. 테스트는 가짜를 넘긴다. */
export interface ArenaProfileSource { arenaScore(): Promise<number | null> }

/** 프로필 카드가 아레나 응답을 기다리는 상한 — 넘으면 「미배치」로 먼저 연다. */
const ARENA_PROFILE_WAIT_MS = 1500;

/**
 * 아레나에 다녀왔으면 그때 받은 RP를 곧바로 쓰고, 아직이면 내 자리만 한 번 묻는다(방 잠금 없는 읽기).
 * 서버 계정이 없거나 한 판도 하지 않았으면 null — 카드가 「미배치」로 선다.
 */
export const liveArenaProfileSource: ArenaProfileSource = {
  async arenaScore() {
    if (arenaStandingKnown()) return cachedArenaScore();
    if (!arenaAvailable()) return null;
    const standing = await Promise.race([
      arenaStanding(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ARENA_PROFILE_WAIT_MS)),
    ]);
    return standing && standing.wins + standing.losses > 0 ? standing.score : null;
  },
};

/** 서버 확정 아레나 RP를 로컬 진행과 합쳐 공개 프로필을 만드는 유일한 manager/API 경계다. */
export async function loadPlayerProfileDisplay(state: Session, source: ArenaProfileSource = liveArenaProfileSource): Promise<PlayerProfileDisplay> {
  const score = await source.arenaScore().catch(() => null);
  // 공개 표시에는 manager가 검증하고 정적 정의로 해석한 장착 항목만 포함하며 전체 획득 목록은 넘기지 않는다.
  const equipped = state === session ? profileModifierManager.equipped() : new ProfileModifierManager(state).equipped();
  return playerProfileDisplay(state, equipped, arenaPublicStanding(score));
}
