import { t } from "../i18n";
import { ProfileModifierManager } from "../managers/ProfileModifierManager";
import type { Session } from "../state/session";
import { getRelic } from "../data/relics";
import { RelicProgressionManager } from "../managers/RelicProgressionManager";
import type { FriendProfile } from "../data/friends";
import { ancientHighestCleared } from "../core/ancientStrata";
import { ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { profileFace, publicDuelScore } from "../state/playerProfile";
import { breakthroughGrade } from "../core/relicProgression";
import { highestClearedStage } from "../core/stageProgress";
import { STAGES, storyStages } from "../data/stages";
import { storyClearRecords } from "../core/storyClearRecord";

/** 공개 필드는 이 화이트리스트에서만 만든다. 지갑·저장 본문·토큰·전체 편성은 공개하지 않는다. */
export function publicProfile(
  state: Session,
  playerId: string,
  now: Date,
): FriendProfile {
  const relic = getRelic(state.favorite);
  const progress = state.relicProgress[relic.id];
  const ancientFloor = ancientHighestCleared(state.cleared, ANCIENT_STRATA_MAX_FLOOR);
  const stage = highestClearedStage(STAGES, state.cleared);
  const duelScore = publicDuelScore(state.duel, now);
  const skinId = state.equippedRelicSkinIds[relic.id];
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
      ...(skinId ? { equippedSkinId: skinId } : {}),
      level: progress?.level ?? 1,
      // 공개 값은 표식에 서는 등급(I~V)이다 — 돌파 단계(0~4)를 그대로 실으면 친구 카드가 한 등급 낮게 선다.
      breakthroughGrade: breakthroughGrade(progress?.breakthrough ?? 0),
      stats: new RelicProgressionManager(state).getFinalStats(relic.id),
      skillIds: [relic.basic.id, relic.passive.id, relic.ultimate.id],
    },
    // 친구 카드의 기록 칸과 고대 지층 지도(친구를 그 층 노드 옆에 세운다)가 읽는다. 없는 기록은 키를 생략한다.
    competitiveStats: {
      ...(stage ? { highestStage: { stageId: stage.id, displayValue: `${stage.id} ${stage.name}` } } : {}),
      // 난이도마다 어디까지 깼는지 — 5~7장이 늘어도 줄 수는 난이도 셋이다. 열리지 않은 난이도는 `open: false`로 말한다.
      storyClears: storyClearRecords(storyStages, state.cleared),
      ...(state.expedition.allTimeBestScore > 0 ? { expeditionScore: Math.floor(state.expedition.allTimeBestScore) } : {}),
      ...(ancientFloor > 0 ? { ancientFloor } : {}),
      ...(duelScore !== undefined ? { duelScore } : {}),
    },
  };
}
