import { DUEL_NPC_NAMES } from "../data/duelNpcs";
import { PLAYABLE_RELICS } from "../data/relics";
import { combatPower } from "./combatPower";
import { duelBlindOrder, duelGrownStats, duelNpcLevel } from "./duelArena";
import { expeditionRewardRandom } from "./expeditionRewards";
import { requiredBreakthroughForLevel } from "./levelDesign";
import { arrangeByRole } from "./partyAffinity";
import type { RelicDef, Stats } from "./types";

/**
 * 결투장 표본 상대 — 실제 이용자 풀이 생기기 전까지 결투장을 채우는 방어덱 묶음.
 *
 * **시즌 ID 하나에서 전부 나온다.** 같은 시즌이면 언제 열어도 같은 사람이 같은 편성으로 서고,
 * 저장에는 상대 ID만 남는다(`DuelState.candidateIds`). 표본은 이용자처럼 레벨·돌파까지만 자라고
 * 룬은 없다. 실제 서버로 옮기면 이 모듈은 다른 사람이 올린 방어덱 스냅샷 조회로 바뀐다.
 */

export interface DuelNpcUnit {
  relicId: string;
  level: number;
  breakthrough: number;
  stats: Stats;
  power: number;
}

export interface DuelNpc {
  id: string;
  displayName: string;
  score: number;
  favoriteRelicId: string;
  /** 서는 순서(왼쪽·가운데·오른쪽). 자동 편성과 같은 직군 배치다. */
  units: DuelNpcUnit[];
  /** 가려지는 순서(전투력 높은 것부터). */
  blindOrder: string[];
}

export const DUEL_NPC_COUNT = 240;
/** 표본 점수의 위쪽 끝. 챌린저 바닥(2,800)을 넘는 사람이 몇은 있어야 위가 비어 보이지 않는다. */
const DUEL_NPC_TOP_SCORE = 3_200;

const cache = new Map<string, DuelNpc[]>();

export function duelNpcPool(seasonId: string): DuelNpc[] {
  const cached = cache.get(seasonId);
  if (cached) return cached;
  const random = expeditionRewardRandom(`duel-npc:${seasonId}`);
  const pool = Array.from({ length: DUEL_NPC_COUNT }, (_, index) => buildNpc(index, random));
  cache.set(seasonId, pool);
  return pool;
}

export function findDuelNpc(seasonId: string, id: string): DuelNpc | undefined {
  return duelNpcPool(seasonId).find((npc) => npc.id === id);
}

function buildNpc(index: number, random: () => number): DuelNpc {
  // 아래쪽이 두껍다 — 티어가 오를수록 사람이 줄어드는 사다리.
  const score = Math.round(DUEL_NPC_TOP_SCORE * Math.pow(random(), 1.6));
  const level = duelNpcLevel(score);
  const breakthrough = requiredBreakthroughForLevel(level);
  const picked = pickTeam(random);
  const units = arrangeByRole(picked).map((def) => {
    const stats = duelGrownStats(def, level, breakthrough);
    return { relicId: def.id, level, breakthrough, stats, power: combatPower(stats) };
  });
  const name = DUEL_NPC_NAMES[index % DUEL_NPC_NAMES.length];
  const house = Math.floor(index / DUEL_NPC_NAMES.length) + 1;
  return {
    id: `duel-npc-${index}`,
    displayName: house === 1 ? name : `${name} ${house}`,
    score,
    favoriteRelicId: units[Math.floor(random() * units.length)].relicId,
    units,
    blindOrder: duelBlindOrder(units.map(({ relicId, power }) => ({ relicId, power }))),
  };
}

/** 세 명을 겹치지 않게 고른다. 앞을 막을 개체(탱커·전사)가 하나는 들어간다. */
function pickTeam(random: () => number): RelicDef[] {
  const front = PLAYABLE_RELICS.filter(({ role }) => role === "tank" || role === "warrior");
  const first = front[Math.floor(random() * front.length)];
  const rest = PLAYABLE_RELICS.filter(({ id }) => id !== first.id);
  const second = rest.splice(Math.floor(random() * rest.length), 1)[0];
  const third = rest[Math.floor(random() * rest.length)];
  return [first, second, third];
}
