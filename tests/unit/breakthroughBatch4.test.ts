import { describe, expect, it } from "vitest";
import { createSkirmish, findFighter, fireUltimate, gainFerocity, resolveReceivedDamage, stepSkirmish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { ferocityMaxOf } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const NEVER = () => 0.99;

/** 아군 첫째에게만 돌파 단계를 준다. 모두 움직이지 않게 묶어 두고 시험이 건 것만 움직이게 한다. */
function setup(allyIds: string[], enemyIds: string[], breakthrough: number): SkirmishState {
  const state = createSkirmish(allyIds.map(getRelic), enemyIds.map(getRelic), ARENA, {}, { [allyIds[0]]: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; fighter.stealthFor = 0; }
  state.fighters.filter((fighter) => fighter.side === "enemy").forEach((foe, index) => { foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.x = 540 + index * 60; foe.y = 1_000; });
  state.fighters.filter((fighter) => fighter.side === "player").forEach((ally, index) => { ally.x = 500 - index * 40; ally.y = 1_000; });
  return state;
}

/** 한 번 때리게 한다: 대상을 정하고 쿨다운을 비운 뒤 한 틱만 돈다. */
function swing(state: SkirmishState, attackerId: string, targetId: string, rng: () => number = NEVER): SkirmishEvent[] {
  const attacker = findFighter(state, attackerId)!;
  attacker.targetId = targetId; attacker.attackCooldown = 0;
  return stepSkirmish(state, 0.05, rng);
}

const mark = (state: SkirmishState, targetId: string, sourceId: string) => { findFighter(state, targetId)!.shimmer = { sourceId }; };
const enterFever = (state: SkirmishState, id: string) => { const fighter = findFighter(state, id)!; fighter.ferocityFever = true; fighter.ferocity = ferocityMaxOf(fighter.def); };
const paint = (stacks: number) => ({ remaining: 10, total: 10, stacks, percentPerStack: 6, maxStacks: 4 });
const amounts = (events: SkirmishEvent[], filter: (event: Extract<SkirmishEvent, { kind: "attack" }>) => boolean) =>
  events.flatMap((event) => event.kind === "attack" && filter(event) ? [event.amount] : []);

describe("티아 한계 돌파", () => {
  it("는 표식이 붙어 있는 동안 그 적이 받는 피해가 12% 늘어난다(별 II)", () => {
    const taken = (breakthrough: number) => {
      const state = setup(["tia"], ["amo"], breakthrough);
      swing(state, "player-0", "enemy-0");
      const foe = findFighter(state, "enemy-0")!;
      return { mark: foe.shimmer, hit: resolveReceivedDamage(foe, 1_000).applied };
    };
    expect(taken(1).mark?.takenPercent).toBe(12);
    expect(taken(1).hit).toBe(1_120);
    expect(taken(0).mark?.takenPercent).toBeUndefined();
    expect(taken(0).hit).toBe(1_000);
  });

  it("는 표식이 지워지면 늘어난 피해도 함께 사라진다", () => {
    const state = setup(["tia"], ["amo"], 1);
    const foe = findFighter(state, "enemy-0")!;
    swing(state, "player-0", "enemy-0");
    expect(foe.shimmer).not.toBeNull();
    swing(state, "player-0", "enemy-0");
    expect(foe.shimmer).toBeNull();
    expect(resolveReceivedDamage(foe, 1_000).applied).toBe(1_000);
  });

  it("는 표식이 터질 때마다 궁극기 게이지를 15 얻는다(별 III)", () => {
    const gained = (breakthrough: number) => {
      const state = setup(["tia"], ["amo"], breakthrough);
      mark(state, "enemy-0", "player-0");
      const tia = findFighter(state, "player-0")!;
      tia.energy = 0;
      swing(state, "player-0", "enemy-0");
      return tia.energy;
    };
    expect(gained(2) - gained(1)).toBeCloseTo(15, 5);
  });

  it("는 폭주 중 표식 폭발의 추가 피해가 두 배가 된다(별 IV)", () => {
    const splash = (breakthrough: number, fever: boolean) => {
      const state = setup(["tia"], ["amo", "toby"], breakthrough);
      mark(state, "enemy-0", "player-0");
      if (fever) enterFever(state, "player-0");
      const events = swing(state, "player-0", "enemy-0");
      const other = findFighter(state, "enemy-1")!;
      return amounts(events, (event) => event.skill === "shimmer" && event.targetId === other.id).reduce((a, b) => a + b, 0);
    };
    expect(splash(2, true)).toBeGreaterThan(0);
    expect(splash(3, true)).toBeGreaterThan(splash(2, true) * 1.7);
    // 폭주가 아니면 배수는 돌지 않는다.
    expect(splash(3, false)).toBeCloseTo(splash(2, false), 5);
  });

  it("는 표식이 붙은 적이 자신을 때리면 그 표식이 곧바로 터진다(별 V)", () => {
    const burst = (breakthrough: number) => {
      const state = setup(["tia"], ["toby"], breakthrough);
      mark(state, "enemy-0", "player-0");
      const foe = findFighter(state, "enemy-0")!;
      foe.attackCooldown = 0; foe.targetId = "player-0"; foe.x = 520;
      stepSkirmish(state, 0.05, NEVER);
      return { cleared: foe.shimmer === null, hp: foe.hp };
    };
    expect(burst(4).cleared).toBe(true);
    expect(burst(3).cleared).toBe(false);
  });

  it("는 표식이 없는 적이 때려도 새 표식을 남기지 않는다(별 V)", () => {
    const state = setup(["tia"], ["toby"], 4);
    const foe = findFighter(state, "enemy-0")!;
    foe.attackCooldown = 0; foe.targetId = "player-0"; foe.x = 520;
    stepSkirmish(state, 0.05, NEVER);
    expect(foe.shimmer).toBeNull();
  });
});

describe("메론 한계 돌파", () => {
  const meronBattle = (breakthrough: number) => setup(["meron"], ["amo", "toby"], breakthrough);
  const threeFoes = (breakthrough: number) => setup(["meron"], ["amo", "toby", "torika"], breakthrough);

  it("은 덧칠이 최대 겹인 적을 때리면 근처 적에게 덧칠이 한 겹 번진다(별 II)", () => {
    const spread = (breakthrough: number) => {
      const state = meronBattle(breakthrough);
      findFighter(state, "enemy-0")!.overpaint = paint(4);
      swing(state, "player-0", "enemy-0");
      return findFighter(state, "enemy-1")!.overpaint?.stacks ?? 0;
    };
    expect(spread(1)).toBe(1);
    expect(spread(0)).toBe(0);
  });

  it("은 궁극기가 터뜨린 덧칠 겹의 절반을 주변 적에게 남긴다(별 III)", () => {
    const left = (breakthrough: number) => {
      const state = meronBattle(breakthrough);
      findFighter(state, "enemy-0")!.overpaint = paint(4);
      const meron = findFighter(state, "player-0")!;
      meron.energy = 200;
      fireUltimate(state, meron.id, NEVER);
      return findFighter(state, "enemy-1")!.overpaint?.stacks ?? 0;
    };
    expect(left(2)).toBe(2);
    expect(left(1)).toBe(0);
  });

  it("은 폭주 중 기본 공격이 가까운 적에게 두 번 옮겨 가 최대 세 명에게 덧칠을 건다(별 IV)", () => {
    const painted = (breakthrough: number, fever: boolean) => {
      const state = threeFoes(breakthrough);
      if (fever) enterFever(state, "player-0");
      swing(state, "player-0", "enemy-0");
      return state.fighters.filter((f) => f.side === "enemy" && (f.overpaint?.stacks ?? 0) > 0).length;
    };
    expect(painted(3, true)).toBe(3);
    expect(painted(3, false)).toBe(1);
    expect(painted(2, true)).toBe(1);
  });

  it("옮겨 가는 덧칠은 피해가 없고 최대 겹을 늘리지 않는다", () => {
    const state = threeFoes(3);
    enterFever(state, "player-0");
    swing(state, "player-0", "enemy-0");
    const second = findFighter(state, "enemy-1")!;
    expect(second.hp).toBe(second.maxHp);
    expect(second.overpaint?.stacks).toBe(1);
    expect(second.overpaint?.maxStacks).toBe(4);
  });

  it("은 덧칠이 최대 겹인 적에게만 치명타 확률이 25% 오른다(별 V)", () => {
    const critical = (breakthrough: number, stacks: number) => {
      const state = meronBattle(breakthrough);
      findFighter(state, "enemy-0")!.overpaint = paint(stacks);
      // 굴림 0.2는 확률이 20을 넘어야 치명타다 — 기본 10으로는 넘지 못하고 35면 넘는다.
      const events = swing(state, "player-0", "enemy-0", () => 0.2);
      return events.some((event) => event.kind === "attack" && event.attackerId === "player-0" && event.skill === "basic" && event.critical);
    };
    expect(critical(4, 4)).toBe(true);
    expect(critical(4, 3)).toBe(false);
    expect(critical(3, 4)).toBe(false);
  });
});

describe("테리사 한계 돌파", () => {
  const terisaBattle = (breakthrough: number) => setup(["terisa", "torika", "dodo"], ["amo"], breakthrough);
  const shields = (events: SkirmishEvent[], fighterId: string) => events.flatMap((event) => event.kind === "shieldGranted" && event.fighterId === fighterId ? [event.amount] : []);

  it("는 가봉이 아군에게 옮기는 비율이 75%에서 90%로 오른다(별 II)", () => {
    const granted = (breakthrough: number) => {
      const state = terisaBattle(breakthrough);
      findFighter(state, "player-1")!.hp = 1;
      findFighter(state, "player-0")!.bt.sutureIn = 0;
      return shields(swing(state, "player-0", "enemy-0"), "player-1").reduce((a, b) => a + b, 0);
    };
    expect(granted(0)).toBeGreaterThan(0);
    expect(granted(1) / granted(0)).toBeCloseTo(90 / 75, 1);
  });

  it("는 가봉의 자기 몫이 아군 몫보다 작다", () => {
    const state = terisaBattle(0);
    findFighter(state, "player-1")!.hp = 1;
    findFighter(state, "player-0")!.bt.sutureIn = 0;
    const events = swing(state, "player-0", "enemy-0");
    const ally = shields(events, "player-1").reduce((a, b) => a + b, 0);
    const self = shields(events, "player-0").reduce((a, b) => a + b, 0);
    expect(self).toBeGreaterThan(0);
    expect(self / ally).toBeCloseTo(35 / 75, 1);
  });

  it("는 성의의 막을 머릿수로 나누지 않고 아군마다 통째로 두른다(별 III)", () => {
    const ult = (breakthrough: number) => {
      const state = terisaBattle(breakthrough);
      const terisa = findFighter(state, "player-0")!;
      terisa.energy = terisa.def.ultimate.cost;
      const events = fireUltimate(state, terisa.id);
      return { ally: shields(events, "player-1").reduce((a, b) => a + b, 0), self: shields(events, "player-0").reduce((a, b) => a + b, 0) };
    };
    const closed = ult(1);
    const open = ult(2);
    expect(closed.ally).toBeGreaterThan(0);
    // 아군 둘 + 자신 절반 = 2.5몫으로 나누던 것을 나누지 않는다.
    expect(open.ally / closed.ally).toBeGreaterThan(2.3);
    expect(open.ally / closed.ally).toBeLessThan(2.7);
    // 자기 몫은 다른 아군의 절반이다.
    expect(closed.self / closed.ally).toBeCloseTo(0.5, 1);
    expect(breakthroughEffectText(getRelic("terisa"), "ultimate")).toContain("통째로");
  });

  it("는 폭주에 드는 순간 자신을 뺀 모든 아군에게 최대 체력 15% 막을 두른다(별 IV)", () => {
    const entry = (breakthrough: number) => {
      const state = terisaBattle(breakthrough);
      const terisa = findFighter(state, "player-0")!;
      terisa.ferocity = ferocityMaxOf(terisa.def) - 1;
      const events: SkirmishEvent[] = [];
      gainFerocity(terisa, 10_000, state, events);
      expect(terisa.ferocityFever).toBe(true);
      return state.fighters.filter((fighter) => fighter.side === "player").map((fighter) => ({ fighter, amount: shields(events, fighter.id).reduce((a, b) => a + b, 0) }));
    };
    for (const { fighter, amount } of entry(3)) {
      if (fighter.id === "player-0") expect(amount).toBe(0);
      else expect(Math.abs(amount - Math.round(fighter.maxHp * 0.15))).toBeLessThanOrEqual(1);
    }
    for (const { amount } of entry(2)) expect(amount).toBe(0);
  });

  it("는 테리사의 막을 두른 아군이 주는 피해가 15% 늘어난다(별 V)", () => {
    const damage = (breakthrough: number, providerId: string | null) => {
      const state = terisaBattle(breakthrough);
      const torika = findFighter(state, "player-1")!;
      torika.shield = { amount: 500, providerId: providerId ?? torika.id };
      const events = swing(state, "player-1", "enemy-0");
      return amounts(events, (event) => event.attackerId === torika.id && event.skill === "basic")[0];
    };
    expect(damage(4, "player-0") / damage(3, "player-0")).toBeGreaterThan(1.1);
    expect(damage(4, "player-0") / damage(3, "player-0")).toBeLessThan(1.2);
    // 다른 이가 두른 막은 해당 없다.
    expect(damage(4, null)).toBe(damage(3, null));
  });

  it("는 별 V에서 가봉 주기가 4초에서 3초로 줄어든다", () => {
    expect(findFighter(terisaBattle(3), "player-0")!.bt.sutureIn).toBe(4);
    expect(findFighter(terisaBattle(4), "player-0")!.bt.sutureIn).toBe(3);
    expect(breakthroughEffectText(getRelic("terisa"), "passive")).toContain("3초");
  });
});

describe("4차 돌파 문구", () => {
  it("는 세 개체의 정의한 슬롯마다 문장을 만들고 자리 표시가 남지 않는다", () => {
    for (const id of ["tia", "meron", "terisa"]) {
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
        const text = breakthroughEffectText(getRelic(id), slot);
        expect(text, `${id} ${slot}`).toBeDefined();
        expect(text, `${id} ${slot}`).not.toMatch(/\{[a-zA-Z!]+\}/);
      }
    }
    expect(breakthroughEffectText(getRelic("tia"), "basic")).toContain("12%");
    expect(breakthroughEffectText(getRelic("terisa"), "basic")).toContain("90%");
    expect(breakthroughEffectText(getRelic("meron"), "passive")).toContain("25%");
  });
});
