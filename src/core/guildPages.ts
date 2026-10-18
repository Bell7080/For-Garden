import type { Element } from "./types";
import { guildWarDayNumber, guildWarPhase, guildWarPhaseEndsAt, type GuildWarPhase } from "./guildWar";

/**
 * 길드 화면의 큰 탭 셋 — **정보 · 길드전 · 수호전**. 정보 안에서만 정보·멤버 작은 탭이 갈린다.
 *
 * 길드전과 수호전은 날짜 하나로 판이 바뀐다(길드전은 이틀 주기의 정비일·전투일, 수호전은 매일 00:00 UTC에 새 판). 그래서
 * 붉은 점은 **그 날짜 번호를 아직 보지 않았는가** 하나로 정한다 — 전투일이 열리면 한 번, 끝나 정비일(결과)이 되면 또 한 번
 * 켜지고, 수호전은 새 판이 열릴 때마다 켜진다. 본 날짜는 기기 설정(`settings.game.guildSeen`)이 기억한다.
 */
export const GUILD_PAGES = ["info", "war", "guard"] as const;
export type GuildPage = (typeof GUILD_PAGES)[number];
export type GuildEventPage = Exclude<GuildPage, "info">;

/** 그 탭의 지금 판을 가리키는 번호. 바뀌면 새 소식이다. */
export const guildPageEventKey = (_page: GuildEventPage, now: number): number => guildWarDayNumber(now);

/** 마지막으로 본 번호와 지금 번호가 다르면 붉은 점을 세운다. */
export const guildPageHasNews = (page: GuildEventPage, seen: number, now: number): boolean => seen !== guildPageEventKey(page, now);

/** 수호전 보스 속성 — 날짜로 다섯 날을 돈다(서버와 화면이 같은 답). */
export const GUILD_GUARD_ELEMENTS: readonly Element[] = ["fire", "water", "grass", "earth", "wind"];
export const guildGuardElement = (now: number): Element => {
  const day = guildWarDayNumber(now);
  return GUILD_GUARD_ELEMENTS[((day % GUILD_GUARD_ELEMENTS.length) + GUILD_GUARD_ELEMENTS.length) % GUILD_GUARD_ELEMENTS.length];
};
/** 오늘 판이 닫히고 다음 판이 열리는 시각. */
export const guildGuardEndsAt = (now: number): number => guildWarPhaseEndsAt(now);

/** 길드전의 지금 단계와 그 단계가 끝나는 시각. */
export function guildWarNow(now: number): { phase: GuildWarPhase; endsAt: number } {
  return { phase: guildWarPhase(guildWarDayNumber(now)), endsAt: guildWarPhaseEndsAt(now) };
}
