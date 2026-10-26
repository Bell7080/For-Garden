import { t } from "../i18n";
import { ProfileModifierManager } from "../managers/ProfileModifierManager";
import type { Session } from "../state/session";
import { getRelic } from "../data/relics";
import { RelicProgressionManager } from "../managers/RelicProgressionManager";
import type { FriendProfile } from "../data/friends";
import { ancientHighestCleared } from "../core/ancientStrata";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { profileFace } from "../state/playerProfile";

/** 공개 필드는 이 화이트리스트에서만 만든다. 지갑·저장 본문·토큰·전체 편성은 공개하지 않는다. */
export function publicProfile(
  state: Session,
  playerId: string,
  now: Date,
): FriendProfile {
  const relic = getRelic(state.favorite);
  const progress = state.relicProgress[relic.id];
  const ancientFloor = ancientHighestCleared(state.cleared, ANCIENT_STRATA_MAX_FLOOR);
  return {
    id: playerId,
    uid: state.playerCard.uid,
    frameId: state.playerCard.frameId,
    avatarRelicId: profileFace(state).avatarRelicId,
    displayName: state.playerCard.nickname || t("profile.defaultName"),
    status: state.playerCard.bio || "",
    level: state.playerResearch.level,
    lastActiveAt: now.getTime(),
    equippedModifiers: new ProfileModifierManager(state)
      .equipped()
      .map(({ id, displayName, rarity }) => ({ id, displayName, rarity })),
    favoriteRelic: {
      relicId: relic.id,
      level: progress?.level ?? 1,
      breakthroughGrade: progress?.breakthrough ?? 0,
      stats: new RelicProgressionManager(state).getFinalStats(relic.id),
      skillIds: [relic.basic.id, relic.passive.id, relic.ultimate.id],
    },
    // 고대 지층 지도가 친구를 그 층 노드 옆에 세운다. 깬 층이 없으면 키를 생략한다.
    competitiveStats: ancientFloor > 0 ? { ancientFloor } : {},
  };
}
