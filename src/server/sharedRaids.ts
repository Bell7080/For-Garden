import type { RaidInstanceState, Session } from "../state/session";
import { RAID_DIFFICULTY } from "../data/raid";
import { raidSeasonKey, raidWorldBossId } from "../core/raid";
import type { RaidContributionEntryDto } from "../api/contracts";

export interface SharedRaidRecord {
  instance: RaidInstanceState;
  revision: string;
  damage: number;
  entries: RaidContributionEntryDto[];
}
export interface SharedRaidContext {
  playerId: string;
  records: SharedRaidRecord[];
}
export interface SharedRaidChange {
  instance: RaidInstanceState;
  expectedRevision: string | null;
  damageDelta: number;
  appliedDelta: number;
  attemptsDelta: number;
  totalHp: number;
}
export function worldRaidDefinitions(now: Date): RaidInstanceState[] {
  return [new Date(now.getTime() - 86400000), now].map((date) => {
    const day = raidSeasonKey(date),
      opened = Date.parse(`${day}T00:00:00.000Z`);
    return {
      id: `world-${day}`,
      kind: "world",
      bossRelicId: raidWorldBossId(day),
      difficulty: "rampage",
      openedAt: new Date(opened).toISOString(),
      endsAt: new Date(opened + 86400000).toISOString(),
      summonedByMe: false,
      myDamage: 0,
      attemptsUsed: 0,
      settled: false,
    };
  });
}
export function raidChanges(
  context: SharedRaidContext,
  state: Session,
): SharedRaidChange[] {
  const old = new Map(context.records.map((row) => [row.instance.id, row]));
  return state.raid.instances.flatMap((instance) => {
    const previous = old.get(instance.id),
      before = previous?.instance;
    if (!previous && !instance.summonedByMe) return [];
    const damageDelta = instance.myDamage - (before?.myDamage ?? 0),
      appliedDelta =
        (instance.appliedDamage ?? instance.myDamage) -
        (before?.appliedDamage ?? before?.myDamage ?? 0),
      attemptsDelta = instance.attemptsUsed - (before?.attemptsUsed ?? 0);
    if (
      previous &&
      damageDelta === 0 &&
      appliedDelta === 0 &&
      attemptsDelta === 0 &&
      instance.settled === before!.settled
    )
      return [];
    return [
      {
        instance,
        expectedRevision: previous?.revision ?? null,
        damageDelta,
        appliedDelta,
        attemptsDelta,
        totalHp: RAID_DIFFICULTY[instance.difficulty].totalHp,
      },
    ];
  });
}
