import type { BattleSceneInputDto } from "./expeditionBattle";
import { createSkirmish } from "./skirmish";
import type { RelicDef } from "./types";
import type { Arena } from "./skirmish";

export interface CombatPrepare {
  /** 양쪽 코어 자동 궁극기를 지원하는 클라이언트만 새 PvP 규칙을 요청한다. */
  automaticUltimates?: true;
  input: BattleSceneInputDto;
  stageId?: string;
}
export interface CombatSetup {
  players: RelicDef[];
  enemies: RelicDef[];
  arena: Arena;
  bonds: Record<string, number>;
  breakthroughs: Record<string, number>;
  options: Parameters<typeof createSkirmish>[5];
}
export interface CombatLease {
  id: string;
  seed: string;
  setup: CombatSetup;
  expiresAt: string;
}
/** 코어의 런타임 함수는 JSON에 싣지 않고 같은 설정으로 양쪽에서 다시 만든다. */
export function combatState(
  lease: CombatLease,
): ReturnType<typeof createSkirmish> {
  const s = lease.setup;
  return createSkirmish(
    s.players,
    s.enemies,
    s.arena,
    s.bonds,
    s.breakthroughs,
    s.options,
  );
}
export interface CombatProof {
  id: string;
  actions: { tick: number; actorId: string }[];
  ticks: number;
  abandoned?: boolean;
}
export interface CombatVerdict {
  victory: boolean;
  relicHp: number[];
  elapsedMs: number;
}
export interface CombatTicket {
  kind: "stage" | "cake" | "bounty" | "duel";
  duel?: { opponent: import("./duelNpcPool").DuelNpc; setup: CombatSetup };
  target: string;
  requestId: string;
}
export interface CombatRecord {
  lease: CombatLease;
  input: CombatPrepare;
  issuedAt: string;
  verdict?: CombatVerdict;
}
export interface CombatJournal {
  bossIssuedAt?: Record<string, string>;
  tickets: Record<string, CombatTicket>;
  records: Record<string, CombatRecord>;
}
export const emptyCombatJournal = (): CombatJournal => ({
  tickets: {},
  records: {},
});
export const COMBAT_STEP_MS = 20;
export const MAX_COMBAT_TICKS = 18000;
export const MAX_COMBAT_ACTIONS = 512;
