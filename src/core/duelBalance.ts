import { createSkirmish, fireUltimate, isFighterAlive, isPartyFighter, stepSkirmish, type Arena } from "./skirmish";
import type { RelicDef } from "./types";

/**
 * 개체 대 개체 검수.
 *
 * 관문 난이도(`stageDifficulty.ts`)는 **편성 셋이 관문 하나를 넘는가**를 묻지만, 새 개체를
 * 넣을 때 먼저 알아야 하는 것은 **그 하나가 다른 하나보다 센가**다. 편성 상성과 관문 레벨이
 * 섞이면 개체 자신의 세기가 그 안에 묻히므로, 여기서는 둘만 맨몸으로 세운다.
 *
 * Phaser를 모르고 난수를 주입받는다 — 같은 seed는 늘 같은 결과를 낸다.
 */

/** 1대1은 서로 달려가 붙기만 하면 되므로 관문보다 좁은 판을 쓴다. */
export const DUEL_ARENA: Arena = { left: 120, right: 960, top: 320, bottom: 1_500 };

/** 이 시간을 넘기면 무승부다. 서로 못 죽이는 조합을 무한히 돌리지 않는다. */
export const DUEL_LIMIT_SECONDS = 45;

/** 20Hz는 코어 내부의 작은 적분과 함께 충분히 안정적이며 대량 검수를 빠르게 끝낸다. */
const DUEL_STEP_SECONDS = 1 / 20;

export interface DuelRun {
  seed: number;
  /** 왼쪽(player 편)이 이겼는지. 무승부는 null이다. */
  winner: "left" | "right" | null;
  durationSeconds: number;
  /** 끝난 순간 각 편 편성원의 남은 체력 비율이다. 귀속 소환수는 세지 않는다. */
  leftHpRatio: number;
  rightHpRatio: number;
}

export interface DuelRecord {
  relicId: string;
  name: string;
  rarity: RelicDef["rarity"];
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** 무승부를 반 승으로 세지 않는다 — 못 죽이는 조합은 이긴 것이 아니다. */
  winRate: number;
  /** 이긴 판만의 평균 소요 시간(초). 얼마나 빨리 끝내는가를 승률과 따로 본다. */
  averageWinSeconds: number;
  /** 모든 판에서 자기 편이 남긴 평균 체력 비율. 얼마나 덜 맞고 이기는가다. */
  averageHpRatio: number;
}

/** 같은 seed가 늘 같은 순서를 내도록 고정한 선형 합동 난수다. */
function createDuelRng(seed: number): () => number {
  let state = (seed * 2_654_435_761) >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** 편성원(귀속 소환수 제외)의 남은 체력 비율 평균이다. */
function partyHpRatio(fighters: ReturnType<typeof createSkirmish>["fighters"], side: "player" | "enemy"): number {
  const party = fighters.filter((fighter) => fighter.side === side && isPartyFighter(fighter));
  if (party.length === 0) return 0;
  return party.reduce((sum, fighter) => sum + Math.max(0, fighter.hp) / fighter.maxHp, 0) / party.length;
}

/**
 * 한 판. 양쪽 모두 준비되는 즉시 궁극기를 쓴다.
 *
 * 자동 발동으로 고정하는 이유는 **개체가 가진 것만** 재기 위해서다 — 아끼는 판단은 사람이
 * 하는 몫이라 여기에 섞으면 같은 개체가 검수자의 손버릇에 따라 다른 세기로 나온다.
 */
export function simulateDuel(left: RelicDef, right: RelicDef, seed: number): DuelRun {
  const rng = createDuelRng(seed);
  const state = createSkirmish([left], [right], DUEL_ARENA);
  while (state.phase === "fight" && state.elapsed < DUEL_LIMIT_SECONDS) {
    stepSkirmish(state, DUEL_STEP_SECONDS, rng);
    if (state.phase !== "fight") break;
    // 적 쪽 자동 궁극기는 코어가 이미 굴리므로 여기서는 아군 편만 눌러 준다.
    for (const fighter of state.fighters) {
      if (fighter.side !== "player" || !isFighterAlive(fighter) || fighter.energy < fighter.def.ultimate.cost) continue;
      fireUltimate(state, fighter.id, rng);
      if (state.phase !== "fight") break;
    }
  }
  return {
    seed,
    winner: state.phase === "victory" ? "left" : state.phase === "defeat" ? "right" : null,
    durationSeconds: state.elapsed,
    leftHpRatio: partyHpRatio(state.fighters, "player"),
    rightHpRatio: partyHpRatio(state.fighters, "enemy"),
  };
}

/**
 * 두 개체를 **양쪽 자리에서 모두** 붙인다.
 *
 * 시작 좌표와 자동 궁극기 처리가 편마다 달라 한쪽 자리에서만 재면 그 차이가 개체의 세기로
 * 읽힌다. 자리를 바꿔 같은 seed로 한 번 더 붙이면 그 몫이 상쇄된다.
 */
export function duelPair(left: RelicDef, right: RelicDef, seeds: readonly number[]): DuelRun[] {
  return seeds.flatMap((seed) => {
    const forward = simulateDuel(left, right, seed);
    const reverse = simulateDuel(right, left, seed);
    // 자리를 바꾼 판은 왼쪽 기준으로 되돌려 기록해, 표를 읽는 쪽이 늘 같은 뜻으로 본다.
    return [forward, {
      seed,
      winner: reverse.winner === null ? null : reverse.winner === "left" ? "right" as const : "left" as const,
      durationSeconds: reverse.durationSeconds,
      leftHpRatio: reverse.rightHpRatio,
      rightHpRatio: reverse.leftHpRatio,
    }];
  });
}

/** 표 한 줄을 쌓아 가는 가변 누적기다. 완성된 줄만 밖으로 나간다. */
interface DuelTally {
  wins: number; losses: number; draws: number; winSeconds: number[]; hpRatios: number[];
}

/**
 * 주어진 개체들을 서로 한 번씩 붙여 승률 표를 만든다.
 *
 * 자기 자신과는 붙이지 않는다 — 완전한 거울 대결은 늘 자리 차이만 재게 된다.
 */
export function duelLeaderboard(relics: readonly RelicDef[], seeds: readonly number[]): DuelRecord[] {
  const tally = new Map<string, DuelTally>(relics.map((relic) => [relic.id, { wins: 0, losses: 0, draws: 0, winSeconds: [], hpRatios: [] }]));
  for (const [index, left] of relics.entries()) {
    for (const right of relics.slice(index + 1)) {
      for (const run of duelPair(left, right, seeds)) {
        const leftTally = tally.get(left.id)!;
        const rightTally = tally.get(right.id)!;
        leftTally.hpRatios.push(run.leftHpRatio);
        rightTally.hpRatios.push(run.rightHpRatio);
        if (run.winner === null) { leftTally.draws += 1; rightTally.draws += 1; continue; }
        const winner = run.winner === "left" ? leftTally : rightTally;
        const loser = run.winner === "left" ? rightTally : leftTally;
        winner.wins += 1;
        winner.winSeconds.push(run.durationSeconds);
        loser.losses += 1;
      }
    }
  }
  return relics.map((relic) => {
    const row = tally.get(relic.id)!;
    const matches = row.wins + row.losses + row.draws;
    return {
      relicId: relic.id, name: relic.name, rarity: relic.rarity,
      matches, wins: row.wins, losses: row.losses, draws: row.draws,
      winRate: matches === 0 ? 0 : row.wins / matches,
      averageWinSeconds: row.winSeconds.length === 0 ? 0 : row.winSeconds.reduce((sum, value) => sum + value, 0) / row.winSeconds.length,
      averageHpRatio: row.hpRatios.length === 0 ? 0 : row.hpRatios.reduce((sum, value) => sum + value, 0) / row.hpRatios.length,
    };
  }).sort((first, second) => second.winRate - first.winRate || second.averageHpRatio - first.averageHpRatio);
}

/** 한 개체가 나머지 전부를 상대로 어디에 서는지만 따로 재는 좁은 검수다. */
export function duelAgainstField(subject: RelicDef, field: readonly RelicDef[], seeds: readonly number[]): DuelRecord {
  const opponents = field.filter((relic) => relic.id !== subject.id);
  return duelLeaderboard([subject, ...opponents], seeds).find((row) => row.relicId === subject.id)!;
}
