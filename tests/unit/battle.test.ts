import { describe, expect, it } from "vitest";
import {
  amplifyFerocityGain,
  canSwap,
  canUseUltimate,
  computeDamage,
  createBattle,
  enemyTurn,
  frontUnit,
  isCriticalHit,
  playerAct,
  previewSkillDamage,
  rearUnits,
  teamDefeated,
  ULTIMATE_ENERGY_MAX,
  FEROCITY_RULES,
} from "../../src/core/battle";
import { getRelic } from "../../src/data/relics";
import { getStage } from "../../src/data/stages";
import { elementMultiplier } from "../../src/core/element";

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
    // 스밀라가 swapMomentum 패시브를 가진 쪽이다.
    const withSwap = newBattle(["anky", "smilo", "dodo"]);
    playerAct(withSwap, { kind: "swap", memberIndex: 1 }); // 스밀라를 전방으로
    enemyTurn(withSwap);
    const enemyHpBefore = frontUnit(withSwap.enemy).hp;
    playerAct(withSwap, { kind: "basic" });
    const swappedDamage = enemyHpBefore - frontUnit(withSwap.enemy).hp;

    // 스밀라를 처음부터 전방에 둔 경우와 비교한다.
    const plain = newBattle(["smilo", "anky", "dodo"]);
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

  it("100 미만 비용은 공용 상한에서 비용만 소비한다", () => {
    const state = newBattle();
    const unit = frontUnit(state.player);
    // 테스트 전용 복제 정의로 운영 데이터를 바꾸지 않고 저비용 정책을 검증한다.
    unit.def = { ...unit.def, ultimate: { ...unit.def.ultimate, cost: 80 } };
    unit.energy = ULTIMATE_ENERGY_MAX;

    expect(canUseUltimate(unit)).toBe(true);
    expect(playerAct(state, { kind: "ultimate" })).toBe(true);
    expect(unit.energy).toBe(ULTIMATE_ENERGY_MAX - 80);
  });

  it("100 초과 비용은 비용 도달 전에는 막고 도달하면 정확히 소비한다", () => {
    const state = newBattle();
    const unit = frontUnit(state.player);
    // 공용 상한 안의 고비용 궁극기도 과거의 100 표시값과 무관하게 판정한다.
    unit.def = { ...unit.def, ultimate: { ...unit.def.ultimate, cost: 120 } };
    unit.energy = 119;
    expect(canUseUltimate(unit)).toBe(false);
    expect(playerAct(state, { kind: "ultimate" })).toBe(false);

    unit.energy = ULTIMATE_ENERGY_MAX;
    expect(playerAct(state, { kind: "ultimate" })).toBe(true);
    expect(unit.energy).toBe(ULTIMATE_ENERGY_MAX - 120);
  });
});

describe("확장 능력치 전투 규칙", () => {
  it("대상 유무에 따라 도감 배율과 방어 반영 예상 피해를 구분한다", () => {
    const attacker = frontUnit(newBattle(["rex", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["spino", "rex", "dodo"]).player);

    // 도감에는 존재하지 않는 방어력을 가정하지 않고 어떤 능력치의 배율인지 명시한다.
    expect(previewSkillDamage(attacker, attacker.def.ultimate)).toEqual({
      kind: "scaling", power: 240, stat: "공격력", label: "기준 배율",
    });
    // 전투 미리보기는 실제 대상의 방어력과 전방 패시브까지 기존 계산기로 반영한다.
    const preview = previewSkillDamage(attacker, attacker.def.ultimate, defender, true);
    expect(preview.kind).toBe("damage");
    if (preview.kind === "damage") {
      expect(preview.amount).toBe(computeDamage(attacker, defender, {
        ...attacker.def.ultimate, isCritical: false,
      }, true));
    }
  });

  it("캐릭터별 energyGain만큼 궁극기 게이지를 획득한다", () => {
    const rexState = newBattle(["rex", "anky", "dodo"]);
    const ankyState = newBattle(["anky", "rex", "dodo"]);
    playerAct(rexState, { kind: "basic" });
    playerAct(ankyState, { kind: "basic" });

    expect(frontUnit(rexState.player).energy).toBe(
      getRelic("rex").stats.energyGain,
    );
    expect(frontUnit(ankyState.player).energy).toBe(
      getRelic("anky").stats.energyGain,
    );
    expect(frontUnit(rexState.player).energy).not.toBe(
      frontUnit(ankyState.player).energy,
    );
  });

  it("물리 피해에는 방어력만 적용한다", () => {
    const attacker = frontUnit(newBattle(["rex", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["spino", "rex", "dodo"]).player);
    const damage = computeDamage(
      attacker,
      defender,
      { power: 100, damageType: "physical", isCritical: false },
      false,
    );

    expect(damage).toBe(
      Math.round(
        ((attacker.def.stats.atk * 100) / (100 + defender.def.stats.def))
          * elementMultiplier(attacker.def.element, defender.def.element),
      ),
    );
  });

  it("마법 피해에는 저항력만 적용한다", () => {
    const attacker = frontUnit(newBattle(["quetz", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["spino", "rex", "dodo"]).player);
    const damage = computeDamage(
      attacker,
      defender,
      { power: 100, damageType: "magical", isCritical: false },
      false,
    );

    expect(damage).toBe(
      Math.round(
        ((attacker.def.stats.ap * 100) / (100 + defender.def.stats.res))
          * elementMultiplier(attacker.def.element, defender.def.element),
      ),
    );
  });

  it("주입된 판정값으로 치명타 확률과 피해 배율을 결정적으로 적용한다", () => {
    const attacker = frontUnit(newBattle(["rex", "anky", "dodo"]).player);
    const defender = frontUnit(newBattle(["spino", "rex", "dodo"]).player);
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
        ((attacker.def.stats.atk * (attacker.def.stats.critDamage / 100) * 100) /
          (100 + defender.def.stats.def))
          * elementMultiplier(attacker.def.element, defender.def.element),
      ),
    );
  });
});

describe("야성", () => {
  it("유대 레벨이 높을수록 더 빨리 차오르며 상한 밖 값도 안전하게 다룬다", () => {
    expect(amplifyFerocityGain(20, 0)).toBe(20);
    expect(amplifyFerocityGain(20, 4)).toBe(24);
    expect(amplifyFerocityGain(20, 20)).toBe(30);
  });

  it("50/80/100 경계에서만 공격자의 피해 보너스가 오르고 맞는 쪽은 손해를 보지 않는다", () => {
    const state = newBattle(["rex", "anky", "dodo"]);
    const attacker = frontUnit(state.player);
    const target = frontUnit(state.enemy);
    const input = { power: 100, damageType: "physical" as const, isCritical: false };
    attacker.ferocity = 49;
    target.ferocity = 49;
    const calm = computeDamage(attacker, target, input, false);
    attacker.ferocity = 50;
    const empowered = computeDamage(attacker, target, input, false);
    attacker.ferocity = 100;
    const opened = computeDamage(attacker, target, input, false);

    expect(empowered).toBeGreaterThan(calm);
    expect(opened).toBeGreaterThan(empowered);

    // 야성은 피버라 맞는 쪽의 방어가 깎이지 않는다. 대상 야성은 피해에 영향이 없다.
    target.ferocity = 100;
    expect(computeDamage(attacker, target, input, false)).toBe(opened);
  });

  it("기본 공격은 공격자와 피격자의 야성을 올리고 임계 진입을 기록한다", () => {
    const state = newBattle();
    const attacker = frontUnit(state.player);
    const target = frontUnit(state.enemy);
    attacker.ferocity = 49;
    target.ferocity = 49;
    playerAct(state, { kind: "basic" });
    expect(attacker.ferocity).toBe(49 + FEROCITY_RULES.basicGain);
    expect(target.ferocity).toBe(49 + FEROCITY_RULES.hitGain);
    expect(state.log.filter((line) => line.includes("야성 50 진입"))).toHaveLength(2);
  });

  it("궁극기 사용도 야성을 올리고, 야성이 가득 차도 궁극기를 막지 않는다", () => {
    const state = newBattle();
    const unit = frontUnit(state.player);
    unit.energy = ULTIMATE_ENERGY_MAX;
    expect(playerAct(state, { kind: "ultimate" })).toBe(true);
    expect(unit.ferocity).toBe(FEROCITY_RULES.ultimateGain);

    // 야성은 피버라 개방 상태에서도 궁극기를 쓸 수 있다.
    const opened = newBattle();
    frontUnit(opened.player).energy = ULTIMATE_ENERGY_MAX;
    frontUnit(opened.player).ferocity = 100;
    expect(canUseUltimate(frontUnit(opened.player))).toBe(true);
  });

  it("교대는 들어오는 유닛의 야성을 감소시키고 통제 회복을 기록한다", () => {
    const state = newBattle();
    state.player.units[1].ferocity = 60;
    playerAct(state, { kind: "swap", memberIndex: 1 });
    expect(frontUnit(state.player).ferocity).toBe(35);
    expect(state.log.some((line) => line.includes("통제 회복"))).toBe(true);
  });

  it("100에서도 궁극기로 적만 공격하고 아군 오인 공격이나 기절을 만들지 않는다", () => {
    const state = newBattle();
    const attacker = frontUnit(state.player);
    const ally = state.player.units[1];
    const enemy = frontUnit(state.enemy);
    attacker.ferocity = 100;
    attacker.energy = ULTIMATE_ENERGY_MAX;
    const allyHp = ally.hp;
    const enemyHp = enemy.hp;

    expect(playerAct(state, { kind: "ultimate" })).toBe(true);
    // 폭주는 보상 상태이므로 입력한 궁극기가 적에게 정상 적중하고 아군은 안전하다.
    expect(enemy.hp).toBeLessThan(enemyHp);
    expect(ally.hp).toBe(allyHp);
    expect(state.log.some((line) => line.includes("오인 공격") || line.includes("기절"))).toBe(false);
  });

  it("새 전투 생성은 이전 전투 종료 상태의 야성을 전부 초기화한다", () => {
    const ended = newBattle();
    ended.player.units.forEach((unit) => { unit.ferocity = 100; unit.hp = 0; });
    const restarted = newBattle();
    expect(restarted.player.units.map((unit) => unit.ferocity)).toEqual([0, 0, 0]);
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
