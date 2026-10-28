import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { GUILD_WAR_MIN_MEMBERS, GUILD_WAR_START_SCORE, guildWarPhase } from "../core/guildWar";
import { guildGuardElement } from "../core/guildPages";
import { guildWarDayNumber } from "../core/guildWar";
import type { Element } from "../core/types";
import { session } from "../state/session";
import { localGuildBackend } from "./FakeGuildServer";
import { guildActorFrom } from "./guildActor";
import { setGuildSandbox } from "./guildApi";
import { guildQaClockShift, setGuildQaDayShift } from "./guildQaClock";

/**
 * QA 전용 길드 시험 도구. 표본 길드·길드원은 `FakeGuildServer`가 갖고, 여기서는 그 위에서
 * 길드 준비·시계 이동처럼 **디버그 도구가 바로 부르는 일**만 한다. 일반 빌드에서는 모든 함수가 아무것도 하지 않는다.
 */
const DAY_MS = 86_400_000;

/** 길드 화면이 서버 시각에 더하는 QA 이동량(ms). 길드전 정비일·전투일과 수호전 속성을 바꿔 보는 데 쓴다. */
export { guildQaClockShift };

export type GuildQaPhase = "prep" | "battle";
/** 지금 UTC 날짜 번호에서 원하는 국면이 되도록 하루 단위로 시계를 민다. */
export function guildQaForcePhase(phase: GuildQaPhase, now: number = Date.now()): void {
  if (!QA_TOOLS_ENABLED) return;
  setGuildQaDayShift(guildWarPhase(guildWarDayNumber(now)) === phase ? 0 : 1);
}
/** 수호전 보스 속성이 원하는 값이 되도록 시계를 민다(하루씩, 최대 다섯 날). */
export function guildQaForceGuardElement(element: Element, now: number = Date.now()): void {
  if (!QA_TOOLS_ENABLED) return;
  for (let shift = 0; shift < 5; shift += 1) {
    if (guildGuardElement(now + shift * DAY_MS) === element) { setGuildQaDayShift(shift); return; }
  }
}
export const guildQaResetClock = (): void => { setGuildQaDayShift(0); };

export interface GuildQaPrepared { guildId: string; name: string; members: number; created: boolean }

/**
 * 길드 시험 준비 — 길드 샌드박스를 켜고, 길드가 없으면 길드장으로 새로 만들고, 길드전 참가 최소 인원까지 표본 길드원으로 채운다.
 * 이미 표본 길드에 들어 있어도 그 길드를 그대로 쓴다. 젬·레벨 조건은 보지 않는다.
 */
export function guildQaPrepare(): GuildQaPrepared | null {
  if (!QA_TOOLS_ENABLED) return null;
  setGuildSandbox(true);
  const actor = guildActorFrom(session, "local-player");
  const before = localGuildBackend.qaGuildOf(actor.userId);
  const guildId = localGuildBackend.qaEnsureGuild(actor, { shape: "shield", shapeColor: "violet", icon: "sword", iconColor: "amber" });
  localGuildBackend.qaFillMembers(guildId, GUILD_WAR_MIN_MEMBERS + 4);
  const row = localGuildBackend.qaGuilds().find((g) => g.id === guildId)!;
  if (row.warScore === null) localGuildBackend.qaSetScores(guildId, { warScore: GUILD_WAR_START_SCORE, guardScore: 0 });
  return { guildId, name: row.name, members: row.memberCount, created: before !== guildId };
}
