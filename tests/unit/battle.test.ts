import { describe, expect, it } from "vitest";
import {
  canSwap,
  computeDamage,
  createBattle,
  enemyTurn,
  frontUnit,
  isCriticalHit,
  playerAct,
  rearUnits,
  teamDefeated,
} from "../../src/core/battle";
import { getRelic } from "../../src/data/relics";
import { getStage } from "../../src/data/stages";

function newBattle(party = ["anky", "rex", "dodo"], stageId = "1-1") {
  const stage = getStage(stageId);
  return createBattle(party.map(getRelic), stage.enemies.map(getRelic));
}

describe("진형", () => {
  it("은 전방 1명 · 후방 2명으로 시작한다", () => {
    const state = newBattle();
    expect(frontUnit(state.player).def.id).toBe("anky");
    expect(rearUnits(state.player).map((u) => u.def.id)).toEqual([
      "rex",
      "dodo",
    ]);
    expect(state.enemy.units).toHaveLength(3);
  });
});

describe("스왑", () => {
  it("은 전방과 후방을 맞바꾸고 한 턴을 소모한다", () => {
    const state = newBattle();
    expect(playerAct(state, { kind: "swap", memberIndex: 1 })).toBe(true);

    expect(frontUnit(state.player).def.id).toBe("rex");
    expect(rearUnits(state.player).map((u) => u.def.id)).toEqual([
      "anky",
      "dodo",
    ]);
    // 행동을 썼으므로 곧바로 적 차례다.
    expect(state.phase).toBe("enemy");
  });

  it("한 다음 턴에는 다시 스왑할 수 없다", () => {
    const state = newBattle();
    playerAct(state, { kind: "swap", memberIndex: 1 });
    enemyTurn(state);

    expect(state.phase).toBe("player");
    expect(canSwap(state.player, 2)).toBe(false);
    expect(playerAct(state, { kind: "swap", memberIndex: 2 })).toBe(false);

    // 한 턴을 흘려보내면 다시 스왑할 수 있다.
    playerAct(state, { kind: "basic" });
    enemyTurn(state);
    expect(canSwap(state.player, 2)).toBe(true);
  });

  it("직후의 공격은 swapMomentum 패시브로 더 아프다", () => {
    const withSwap = newBattle();
    playerAct(withSwap, { kind: "swap", memberIndex: 1 }); // 렉스를 전방으로
    enemyTurn(withSwap);
    const enemyHpBefore = frontUnit(withSwap.enemy).hp;
    playerAct(withSwap, { kind: "basic" });
    const swappedDamage = enemyHpBefore - frontUnit(withSwap.enemy).hp;

    // 렉스를 처음부터 전방에 둔 경우와 비교한다.
    const plain = newBattle(["rex", "anky", "dodo"]);
    const plainBefore = frontUnit(plain.enemy).hp;
    playerAct(plain, { kind: "basic" });
    const plainDamage = plainBefore - frontUnit(plain.enemy).hp;

    expect(swappedDamage).toBeGreaterThan(plainDamage);
  });

  it("은 이미 전방인 유닛에게는 쓸 수 없다", () => {
    const state = newBattle();
    expect(canSwap(state.player, 0)).toBe(false);
    expect(playerAct(state, { kind: "swap", memberIndex: 0 })).toBe(false);
    expect(state.phase).toBe("player");
  });
});

describe("궁극기", () => {
  it("는 게이지가 다 차야 쓸 수 있다", () => {
    const state = newBattle();
    expect(playerAct(state, { kind: "ultimate" })).toBe(false);

    frontUnit(state.player).energy = 100;
    const before = frontUnit(state.enemy).hp;
    expect(playerAct(state, { kind: "ultimate" })).toBe(true);
    expect(frontUnit(state.enemy).hp).toBeLessThan(before);
    expect(frontUnit(state.player).energy).toBe(0);
  });
});

describe("확장 능력치 전투 규칙", () => {
  it("캐릭터별 ferocity만큼 궁극기 게이지를 획득한다", () => {
    const rexState = newBattle(["rex", "anky", "dodo"]);
    const ankyState = newBattle(["anky", "rex", "dodo"]);
    playerAct(rexState, { kind: "basic" });
    playerAct(ankyState, { kind: "basic" });

    expect(frontUnit(rexState.player).energy).toBe(
      getRelic("rex").stats.ferocity,
    );
    expect(frontUnit(ankyState.player).energy).toBe(
      getRelic("anky").stats.ferocity,
    );
    expect(frontUnit(rexState.player).energy).not.toBe(
      frontUnit(ankyState.player).energy,
    );
  });

  it("물리 피해에는 방어력만 적용한다", () => {
    const attacker = frontUnit(newBattle(["rex", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["mammoth", "rex", "dodo"]).player);
    const damage = computeDamage(
      attacker,
      defender,
      { power: 100, damageType: "physical", isCritical: false },
      false,
    );

    expect(damage).toBe(
      Math.round(
        (attacker.def.stats.atk * 100) / (100 + defender.def.stats.def),
      ),
    );
  });

  it("마법 피해에는 저항력만 적용한다", () => {
    const attacker = frontUnit(newBattle(["quetz", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["mammoth", "rex", "dodo"]).player);
    const damage = computeDamage(
      attacker,
      defender,
      { power: 100, damageType: "magical", isCritical: false },
      false,
    );

    expect(damage).toBe(
      Math.round(
        (attacker.def.stats.ap * 100) / (100 + defender.def.stats.res),
      ),
    );
  });

  it("주입된 판정값으로 치명타 확률과 피해 배율을 결정적으로 적용한다", () => {
    const attacker = frontUnit(newBattle(["rex", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["mammoth", "rex", "dodo"]).player);
    const normal = computeDamage(
      attacker,
      defender,
      { power: 100, damageType: "physical", isCritical: false },
      false,
    );
    const critical = computeDamage(
      attacker,
      defender,
      {
        power: 100,
        damageType: "physical",
        isCritical: isCriticalHit(attacker.def.stats.critChance, 0),
      },
      false,
    );

    expect(isCriticalHit(attacker.def.stats.critChance, 0.99)).toBe(false);
    expect(critical).toBeGreaterThan(normal);
    expect(critical).toBe(
      Math.round(
        (attacker.def.stats.atk * (attacker.def.stats.critDamage / 100) * 100) /
          (100 + defender.def.stats.def),
      ),
    );
  });
});

describe("패시브", () => {
  it("frontGuard는 전방에 있을 때만 피해를 줄인다", () => {
    const tank = newBattle(["anky", "rex", "dodo"]);
    const squishy = newBattle(["dodo", "rex", "anky"]);

    playerAct(tank, { kind: "basic" });
    const tankBefore = frontUnit(tank.player).hp;
    enemyTurn(tank);
    const tankTaken = tankBefore - frontUnit(tank.player).hp;

    playerAct(squishy, { kind: "basic" });
    const squishyBefore = frontUnit(squishy.player).hp;
    enemyTurn(squishy);
    const squishyTaken = squishyBefore - frontUnit(squishy.player).hp;

    expect(tankTaken).toBeLessThan(squishyTaken);
  });

  it("rearMend는 후방에 있는 동안 매 턴 전방을 회복시킨다", () => {
    const state = newBattle(["anky", "rex", "dodo"]); // 도도가 후방
    const front = frontUnit(state.player);
    front.hp = 500;

    playerAct(state, { kind: "basic" });
    const afterEnemy = front.hp;
    enemyTurn(state); // 적 공격 뒤 턴이 넘어가며 회복이 들어간다

    // 적 피해와 회복이 함께 반영되므로, 회복분만큼 덜 깎였는지로 확인한다.
    const withoutMend = newBattle(["anky", "rex", "smilo"]);
    const plainFront = frontUnit(withoutMend.player);
    plainFront.hp = 500;
    playerAct(withoutMend, { kind: "basic" });
    const plainAfter = plainFront.hp;
    enemyTurn(withoutMend);

    expect(front.hp - afterEnemy).toBeGreaterThan(plainFront.hp - plainAfter);
  });
});

describe("전투 진행", () => {
  it("전방이 쓰러지면 후방이 자동으로 앞에 선다", () => {
    const state = newBattle();
    const enemyFront = frontUnit(state.enemy);
    enemyFront.hp = 1;

    playerAct(state, { kind: "basic" });

    expect(enemyFront.hp).toBe(0);
    expect(frontUnit(state.enemy).hp).toBeGreaterThan(0);
    expect(frontUnit(state.enemy)).not.toBe(enemyFront);
  });

  it("적 3명이 모두 쓰러지면 승리로 끝난다", () => {
    const state = newBattle();
    for (const unit of state.enemy.units) unit.hp = 1;

    playerAct(state, { kind: "basic" });
    expect(state.phase).toBe("enemy");
    playerAct(state, { kind: "basic" }); // 아직 적 차례라 막힌다
    enemyTurn(state);
    playerAct(state, { kind: "basic" });
    enemyTurn(state);
    playerAct(state, { kind: "basic" });

    expect(teamDefeated(state.enemy)).toBe(true);
    expect(state.phase).toBe("victory");
  });

  it("승패가 갈리면 더 이상 행동할 수 없다", () => {
    const state = newBattle();
    for (const unit of state.enemy.units) unit.hp = 0;
    state.enemy.units[0].hp = 1;
    playerAct(state, { kind: "basic" });

    expect(state.phase).toBe("victory");
    expect(playerAct(state, { kind: "basic" })).toBe(false);
  });

  it("적 차례가 아니면 enemyTurn은 아무것도 하지 않는다", () => {
    const state = newBattle();
    const snapshot = frontUnit(state.player).hp;
    enemyTurn(state); // 지금은 플레이어 차례
    expect(frontUnit(state.player).hp).toBe(snapshot);
    expect(state.turn).toBe(1);
  });
});
