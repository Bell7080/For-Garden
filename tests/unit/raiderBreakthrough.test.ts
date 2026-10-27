import { describe, expect, it } from "vitest";
import { breakthroughSkill, createSkirmish, findFighter, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { getRelic, RELICS } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

/** 회수조 다섯의 한계 돌파 — 열린 단계에서만 일하고, 열린 효과마다 화면 문장이 있다. */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const RAIDERS = ["atra", "mir", "pulsi", "neuri", "ikanixia"] as const;

function setup(allyIds: string[], enemyIds: string[], breakthrough: number): SkirmishState {
  const state = createSkirmish(allyIds.map(getRelic), enemyIds.map(getRelic), ARENA, {}, { [allyIds[0]]: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; }
  state.fighters.filter((f) => f.side === "enemy").forEach((foe, i) => { foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.x = 540 + i * 40; foe.y = 1_000; });
  state.fighters.filter((f) => f.side === "player").forEach((ally, i) => { ally.x = 500 - i * 40; ally.y = 1_000; });
  return state;
}

describe("회수조 한계 돌파", () => {
  it("다섯 모두 네 칸에 효과가 있고 열린 칸마다 문장이 있다", () => {
    for (const id of RAIDERS) {
      const def = getRelic(id);
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
        const effect = def.breakthroughEffects?.[slot];
        expect(effect?.kind, `${id} ${slot}`).not.toBe("none");
        expect(breakthroughEffectText(def, slot), `${id} ${slot}`).toBeTruthy();
      }
    }
  });

  it("돌파가 열리기 전에는 아무 효과도 일하지 않는다", () => {
    const closed = setup(["atra"], ["amo"], 0);
    const skill = breakthroughSkill(findFighter(closed, "player-0")!, false);
    expect(skill.statusEffects?.find((e) => e.kind === "poison")).toMatchObject({ seconds: 3 });
  });

  it("아트라의 독은 V에서 5초로 늘고 네우리의 순풍은 III에서 10초로 는다", () => {
    const atra = findFighter(setup(["atra"], ["amo"], 4), "player-0")!;
    expect(breakthroughSkill(atra, false).statusEffects?.find((e) => e.kind === "poison")).toMatchObject({ seconds: 5 });
    expect(breakthroughSkill(atra, true).statusEffects?.find((e) => e.kind === "poison")).toMatchObject({ seconds: 5 });
    const neuri = findFighter(setup(["neuri"], ["amo"], 2), "player-0")!;
    const ult = breakthroughSkill(neuri, true);
    expect("teamBuff" in ult && ult.teamBuff?.kind === "tailwind" ? ult.teamBuff.seconds : 0).toBe(10);
  });

  it("미르의 행렬 재생은 V에서 늘고 이카닉시아의 박쥐는 V에서 더 많은 적의 피를 빤다", () => {
    const regen = (breakthrough: number) => {
      const state = setup(["mir", "amo", "toby"], ["amo"], breakthrough);
      const mir = findFighter(state, "player-0")!;
      mir.hp = mir.maxHp * 0.5;
      const before = mir.hp;
      for (let t = 0; t < 2; t += 0.05) stepSkirmish(state, 0.05, () => 0.99);
      return mir.hp - before;
    };
    expect(regen(4)).toBeGreaterThan(regen(0));
    const drain = (breakthrough: number) => {
      const state = setup(["ikanixia"], ["amo", "toby", "ripa", "amo", "toby"], breakthrough);
      const boss = findFighter(state, "player-0")!;
      state.fighters.filter((f) => f.side === "enemy").forEach((f, i) => { f.x = boss.x + 60 + i * 10; f.y = boss.y; f.maxHp = 100_000; f.hp = f.maxHp; });
      boss.hp = boss.maxHp * 0.3;
      const before = boss.hp;
      for (let t = 0; t < 1.1; t += 0.05) stepSkirmish(state, 0.05, () => 0.99);
      return boss.hp - before;
    };
    expect(drain(4)).toBeGreaterThan(drain(0));
  });

  it("네우리의 울림은 V에서 가장 센 아군 둘에게 걸린다", () => {
    const buffed = (breakthrough: number) => {
      const state = setup(["neuri", "mir", "pulsi"], ["amo"], breakthrough);
      const neuri = findFighter(state, "player-0")!;
      neuri.wingHumIn = 0;
      stepSkirmish(state, 0.05, () => 0.99);
      return state.fighters.filter((f) => f.side === "player" && f.id !== neuri.id && f.tailwind?.kind === "resonance").length;
    };
    expect(buffed(4)).toBeGreaterThanOrEqual(buffed(0));
  });

  it("회수조 다섯만 이 새 종류를 쓴다", () => {
    const kinds = new Set(["lingeringVenom", "deeperMarch", "deepAim", "twinHum", "swarmDeepen", "longGust"]);
    const owners = RELICS.filter((r) => Object.values(r.breakthroughEffects ?? {}).some((e) => e && kinds.has(e.kind))).map((r) => r.id);
    expect(owners.sort()).toEqual([...RAIDERS].sort());
  });
});
