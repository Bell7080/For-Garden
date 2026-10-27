import { describe, expect, it } from "vitest";
import { applyEncounterScaling, encounterHpShare, ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { createSkirmish, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { RARITY_STAT_BAND } from "../../src/core/rarityScaling";
import { combatPower } from "../../src/core/combatPower";
import { findKeyword } from "../../src/data/keywords";
import { getRelic } from "../../src/data/relics";
import { CHAPTERS, getStageEnemies, stageEnemyRole } from "../../src/data/stages";

/**
 * 회수조 다섯(이카닉시아·아트라·펄시·네우리·미르). 태그 팝업의 수가 계약과 같은지, 등급 띠 안인지,
 * 마디 방벽이 실제로 되살아나는지, 정예 둘이 같은 정예 자리에서 체력을 나눠 갖는지를 지킨다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const IDS = ["ikanixia", "atra", "pulsi", "neuri", "mir"] as const;

describe("회수조", () => {
  it("다섯은 같은 등급 띠 안에 서고 공멸 소속이다", () => {
    for (const id of IDS) {
      const relic = getRelic(id);
      const band = RARITY_STAT_BAND[relic.rarity];
      expect(combatPower(relic.stats), id).toBeGreaterThanOrEqual(band.min);
      expect(combatPower(relic.stats), id).toBeLessThanOrEqual(band.max);
      expect(relic.enemyOnly, id).toBe(true);
      expect(relic.squad, id).toBe("annihilation");
    }
  });

  it("태그 문장이 패시브 계약의 수와 같다", () => {
    const echo = getRelic("ikanixia").passive.echoLocation!;
    expect(findKeyword("echo")!.description).toContain(`${echo.shieldMaxHpPercent}%`);
    expect(findKeyword("echo")!.description).toContain(`${echo.capMaxHpPercent}%`);
    const barrier = getRelic("atra").passive.segmentBarrier!;
    const text = findKeyword("segment-barrier")!.description;
    for (const value of [`${barrier.segmentMaxHpPercent}%`, `${barrier.segments}개`, `${barrier.restoreSeconds}초`, `${barrier.hitRestoreSeconds}초`]) expect(text).toContain(value);
    const aim = getRelic("pulsi").passive.vitalAim!;
    expect(findKeyword("vital-aim")!.description).toContain(`${aim.damagePercentPerStack}%`);
    expect(findKeyword("vital-aim")!.description).toContain(`${aim.maxStacks}겹`);
    const march = getRelic("mir").passive.workerMarch!;
    const marchText = findKeyword("worker-march")!.description;
    expect(marchText).toContain(`${march.attackPercentPerAlly}%`);
    expect(marchText).toContain(`${march.maxAllies}`);
  });

  it("마디 방벽은 깎인 뒤 시간이 지나면 되살아나고 상한을 넘지 않는다", () => {
    const state = createSkirmish([getRelic("atra")], [getRelic("amo")], ARENA);
    const atra = state.fighters.find((fighter) => fighter.def.id === "atra")!;
    for (const fighter of state.fighters) { fighter.attackCooldown = Number.POSITIVE_INFINITY; fighter.retargetIn = Number.POSITIVE_INFINITY; }
    stepSkirmish(state, 0.05);
    const full = atra.shield.amount;
    expect(full).toBeGreaterThan(0);
    atra.shield.amount = 0;
    for (let t = 0; t < 7; t += 0.05) stepSkirmish(state, 0.05);
    expect(atra.shield.amount).toBeGreaterThan(0);
    for (let t = 0; t < 40; t += 0.05) stepSkirmish(state, 0.05);
    expect(atra.shield.amount).toBeLessThanOrEqual(full + 1e-6);
  });
});

describe("정예 둘", () => {
  it("정예의 체력 몫은 서 있는 수로 나뉘고 하나일 때는 표 그대로다", () => {
    const spec = ENCOUNTER_ROLE.elite;
    expect(encounterHpShare("elite", 1)).toBe(spec.hpMultiplier);
    expect(encounterHpShare("elite", 2)).toBe(spec.hpMultiplier / 2);
    expect(encounterHpShare("normal", 2)).toBe(ENCOUNTER_ROLE.normal.hpMultiplier);
    const base = getRelic("amo").stats;
    expect(applyEncounterScaling(base, 20, "elite", 2).hp).toBe(Math.round(applyEncounterScaling(base, 20, "elite", 1).hp / 2));
  });

  it("2-7·2-9는 정예 둘이고 3-5는 아트라, 3-10은 이카닉시아 혼자다", () => {
    const stage = (id: string) => {
      const found = CHAPTERS.flatMap((chapter) => chapter.stages).find((entry) => entry.id === id);
      if (!found || found.kind !== "battle") throw new Error(id);
      return found;
    };
    for (const id of ["2-7", "2-9"]) {
      expect(stage(id).enemies, id).toHaveLength(2);
      expect(stageEnemyRole(stage(id)), id).toBe("elite");
      expect(getStageEnemies(stage(id)).every((enemy) => enemy.encounterRole === "elite"), id).toBe(true);
    }
    expect(stage("3-5").enemies.map(({ relicId }) => relicId)).toEqual(["atra"]);
    expect(stage("3-10").enemies.map(({ relicId }) => relicId)).toEqual(["ikanixia"]);
    expect(stage("3-9").enemies.map(({ relicId }) => relicId)).toEqual(["atra", "pulsi", "neuri"]);
  });
});
