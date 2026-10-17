import { t } from "../i18n";
import type { Session } from "../state/session";
import type { GuildActor } from "./guildContracts";

/** 저장된 진행에서 길드 호출자를 만든다. 서버는 JWT의 사용자 id와 이 진행만 쓰고 클라이언트의 말을 쓰지 않는다. */
export function guildActorFrom(state: Session, userId: string): GuildActor {
  const card = state.playerCard;
  return {
    userId,
    name: card.nickname || t("profile.defaultName"),
    level: state.playerResearch.level,
    avatarRelicId: card.avatarRelicId || state.favorite,
    frameId: card.frameId,
  };
}
