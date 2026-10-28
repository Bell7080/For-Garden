import { battleArena } from "./battleArena";
import { deathClockClosesBySeconds } from "./battleClock";
import { BOSS_STEP_MS, bossBattleRandom } from "./bossSimulation";
import type { GuildGuardSlotUnit } from "./guildGuardBattle";
import { GUILD_WAR_DECK_SIZE } from "./guildWarMap";
import { partyRuneTraitEffects } from "./runeTraitEffects";
import { createSkirmish, isPartyFighter, stepSkirmish, type CreateSkirmishOptions, type SkirmishState } from "./skirmish";
import type { RelicDef } from "./types";

/**
 * 길드전 공격 한 판 — 공격덱 셋과 상대 칸의 방어덱 셋이 맞서는 3대3 자동 전투. 화면(`BattleScene`)과 서버 재현
 * (`submitGuildWarAttack`)이 **이 한 벌의 함수**로 판을 세운다. 결투장과 같은 전장·같은 몸집이고 궁극기는 양쪽 모두 자동이라,
 * 결과는 입장이 굳힌 두 편성과 시드가 다 정한다 — 서버는 클라이언트의 승패를 받지 않고 다시 굴려 확정한다.
 *
 * 두 편 모두 굳힌 스냅샷(레벨·돌파·유대·룬·능력치)으로 선다. 방어덱은 정비일에 게시한 그 순간의 모습이다.
 */

export type GuildWarLineup = readonly GuildGuardSlotUnit[];

export interface GuildWarBattleOutcome {
  won: boolean;
  /** 쓰러뜨린 방어 렐릭 수(0~3). 진 판에서도 결과판이 보여 준다. */
  defendersDown: number;
  seconds: number;
}

function assertLineup(lineup: GuildWarLineup, side: "attack" | "defense"): void {
  if (lineup.length !== GUILD_WAR_DECK_SIZE) throw new RangeError(`guild war ${side} lineup must have ${GUILD_WAR_DECK_SIZE} relics`);
}

export function createGuildWarSkirmish(attack: GuildWarLineup, defense: GuildWarLineup, defs: (id: string) => RelicDef): SkirmishState {
  assertLineup(attack, "attack");
  assertLineup(defense, "defense");
  const players = attack.map(({ relicId, snapshot }) => ({ ...defs(relicId), stats: { ...snapshot.stats } }));
  const enemies = defense.map(({ relicId, snapshot }) => ({ ...defs(relicId), stats: { ...snapshot.stats } }));
  const options: CreateSkirmishOptions = {
    automaticUltimates: true,
    augmentEffects: partyRuneTraitEffects(attack.map(({ relicId, snapshot }) => ({ relicId, runes: snapshot.runes }))),
    enemyAugmentEffects: partyRuneTraitEffects(defense.map(({ relicId, snapshot }) => ({ relicId, runes: snapshot.runes }))),
    enemyBondLevels: defense.map(({ snapshot }) => snapshot.bondLevel),
    enemyBreakthroughs: defense.map(({ snapshot }) => snapshot.breakthrough),
    enemyBodyScale: 1,
  };
  return createSkirmish(
    players, enemies, battleArena("guildWar"),
    Object.fromEntries(attack.map(({ relicId, snapshot }) => [relicId, snapshot.bondLevel])),
    Object.fromEntries(attack.map(({ relicId, snapshot }) => [relicId, snapshot.breakthrough])),
    options,
  );
}

export function guildWarBattleOutcome(state: SkirmishState): GuildWarBattleOutcome {
  return {
    won: state.phase === "victory",
    defendersDown: state.fighters.filter((fighter) => fighter.side === "enemy" && isPartyFighter(fighter) && fighter.hp <= 0).length,
    seconds: Math.round(state.elapsed * 10) / 10,
  };
}

/** 시드에서 판을 끝까지 굴린다. 화면과 같은 고정 걸음이라 같은 시드면 같은 결과다. 데스 카운트가 판을 닫는다. */
export function replayGuildWar(attack: GuildWarLineup, defense: GuildWarLineup, defs: (id: string) => RelicDef, seed: string): GuildWarBattleOutcome {
  const state = createGuildWarSkirmish(attack, defense, defs);
  const rng = bossBattleRandom(seed);
  const limit = Math.ceil((deathClockClosesBySeconds() + 10) * 1_000 / BOSS_STEP_MS);
  for (let step = 0; step < limit && state.phase === "fight"; step += 1) stepSkirmish(state, BOSS_STEP_MS / 1_000, rng);
  return guildWarBattleOutcome(state);
}
