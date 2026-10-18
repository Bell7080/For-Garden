import { t } from "../i18n";
import type { Session } from "../state/session";
import { playerProfileDisplay } from "../state/playerProfile";
import type { GuildActor, GuildMemberCard } from "./guildContracts";

/** 저장된 진행에서 길드 호출자를 만든다. 서버는 JWT의 사용자 id와 이 진행만 쓰고 클라이언트의 말을 쓰지 않는다. */
export function guildActorFrom(state: Session, userId: string): GuildActor {
  const card = state.playerCard;
  return {
    userId,
    name: card.nickname || t("profile.defaultName"),
    level: state.playerResearch.level,
    avatarRelicId: card.avatarRelicId || state.favorite,
    frameId: card.frameId,
    card: guildMemberCardFrom(state),
  };
}

/** 길드원이 서로 보는 공개 카드 — 자기 프로필 카드와 같은 값에서 굳힌다. */
export function guildMemberCardFrom(state: Session): GuildMemberCard {
  const profile = playerProfileDisplay(state);
  const favorite = profile.competitiveStats.favoriteRelic;
  return {
    uid: state.playerCard.uid.slice(0, 32),
    bio: state.playerCard.bio.slice(0, 80),
    favorite: favorite ? {
      relicId: favorite.relicId, level: favorite.level, power: favorite.power,
      breakthroughGrade: favorite.breakthroughGrade,
      skinId: state.equippedRelicSkinIds[favorite.relicId] ?? null,
    } : null,
    highestStageId: profile.competitiveStats.highestStage?.stageId ?? null,
    expeditionBest: Math.max(0, Math.floor(state.expedition.allTimeBestScore)),
  };
}
