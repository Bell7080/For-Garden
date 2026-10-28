import { BOSS_STEP_MS, bossBattleRandom } from "./bossSimulation";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import type { ExpeditionRelicSnapshot } from "./expeditionSnapshot";
import { GUILD_GUARD, GUILD_GUARD_ARENA, guildGuardHordeSpec, guildGuardSlotSpot, type GuildGuardRoster } from "./guildGuard";
import { partyRuneTraitEffects } from "./runeTraitEffects";
import { createSkirmish, stepSkirmish, type SkirmishState } from "./skirmish";
import type { RelicDef } from "./types";

/**
 * 수호전 한 판을 세우고 끝까지 굴리는 **한 벌의 함수**. 화면(`BattleScene`)과 서버 재현(`submitGuildGuard`)이
 * 같은 편성·시드에서 같은 판을 얻으려면 판을 세우는 길이 하나여야 한다 — 자리·줄·자동 궁극기를 두 곳이 따로 적으면
 * 보여 준 점수와 기록된 점수가 갈린다.
 *
 * 수호전은 손이 들지 않는다(궁극기 자동). 그래서 결과는 입장할 때 굳힌 편성·시드가 다 정하고, 서버는 클라이언트의
 * 말을 하나도 받지 않고 다시 굴려 점수를 확정한다.
 */

/** 입장이 굳힌 한 자리 — 빈 칸은 `null`. 자리 번호가 곧 앞줄(0~2)·뒷줄(3~5)이다. */
export interface GuildGuardSlotUnit { relicId: string; snapshot: ExpeditionRelicSnapshot }
export type GuildGuardLineup = readonly (GuildGuardSlotUnit | null)[];

/** 한 판의 결과. 점수가 순위·코인을 정하고 나머지는 결과판이 보여 준다. */
export interface GuildGuardOutcome {
  score: number;
  kills: number;
  eliteKills: number;
  /** 들어온 웨이브 수(마지막 웨이브 번호). */
  waves: number;
  seconds: number;
  /** `victory`는 제한 시간까지 버틴 판, `defeat`는 전멸·돌파 허용선 도달이다. 점수는 둘 다 그대로 남는다. */
  phase: "victory" | "defeat";
}

export function createGuildGuardSkirmish(lineup: GuildGuardLineup, defs: (id: string) => RelicDef, roster: GuildGuardRoster): SkirmishState {
  if (lineup.length !== GUILD_GUARD.slots) throw new RangeError("수호전 편성은 여섯 칸입니다.");
  const filled = lineup.flatMap((unit, slot) => (unit ? [{ unit, slot }] : []));
  if (filled.length === 0) throw new RangeError("수호전 편성이 비었습니다.");
  const players = filled.map(({ unit }) => ({ ...defs(unit.relicId), stats: { ...unit.snapshot.stats } }));
  const spots = filled.map(({ slot }) => guildGuardSlotSpot(slot));
  const traits: ExpeditionAugmentEffect[] = partyRuneTraitEffects(filled.map(({ unit }) => ({ relicId: unit.relicId, runes: unit.snapshot.runes })));
  const state = createSkirmish(
    players, [], GUILD_GUARD_ARENA,
    Object.fromEntries(filled.map(({ unit }) => [unit.relicId, unit.snapshot.bondLevel])),
    Object.fromEntries(filled.map(({ unit }) => [unit.relicId, unit.snapshot.breakthrough])),
    {
      horde: guildGuardHordeSpec(roster),
      timeLimitSeconds: GUILD_GUARD.timeLimitSeconds,
      automaticUltimates: true,
      playerPositions: spots.map(({ x, y }) => ({ x, y })),
      augmentEffects: traits,
    },
  );
  // 뒷줄은 앞줄보다 깊이 나가지 않는다 — 자리마다 쫓아갈 수 있는 윗선이 다르다.
  filled.forEach((_, index) => {
    const fighter = state.fighters.find(({ id }) => id === `player-${index}`);
    if (fighter) fighter.leashTop = spots[index].leashTop;
  });
  return state;
}

/** 시드에서 판을 끝까지 굴린다. 화면과 같은 고정 걸음(`BOSS_STEP_MS`)이라 같은 시드면 같은 점수다. */
export function replayGuildGuard(lineup: GuildGuardLineup, defs: (id: string) => RelicDef, roster: GuildGuardRoster, seed: string): GuildGuardOutcome {
  const state = createGuildGuardSkirmish(lineup, defs, roster);
  const rng = bossBattleRandom(seed);
  const limit = Math.ceil((GUILD_GUARD.timeLimitSeconds + 5) * 1_000 / BOSS_STEP_MS);
  let waves = 0;
  for (let step = 0; step < limit && state.phase === "fight"; step += 1) {
    for (const event of stepSkirmish(state, BOSS_STEP_MS / 1_000, rng)) if (event.kind === "hordeWave") waves = event.wave;
  }
  return guildGuardOutcome(state, waves);
}

export function guildGuardOutcome(state: SkirmishState, waves: number): GuildGuardOutcome {
  const horde = state.horde;
  return {
    score: Math.max(0, Math.round(horde?.score ?? 0)),
    kills: horde?.kills ?? 0,
    eliteKills: horde?.eliteKills ?? 0,
    waves,
    seconds: Math.round(state.elapsed * 10) / 10,
    phase: state.phase === "victory" ? "victory" : "defeat",
  };
}

/**
 * 한 판의 길드 코인 — 기본 5에 점수 150마다 1, 한 판 20에서 멈춘다(하루 두 판이라 하루 40이 끝).
 * 2026-10-27 응태 승인 범위(한 판 5~20).
 */
export const GUILD_GUARD_COIN = { base: 5, perScore: 150, cap: 20 } as const;
export const guildGuardCoin = (score: number): number =>
  Math.min(GUILD_GUARD_COIN.cap, GUILD_GUARD_COIN.base + Math.floor(Math.max(0, score) / GUILD_GUARD_COIN.perScore));
