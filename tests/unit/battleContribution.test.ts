import { describe, expect, it } from "vitest";
import {
  accumulateDamageContribution, addContribution, contributionSnapshot, contributionValue, createBattleContributions,
} from "../../src/core/battleContribution";

/** 서버 재생 입력과 같은 작은 피해 사건을 만들어 정책별 기대값만 드러낸다. */
function damage(overrides: Partial<Parameters<typeof accumulateDamageContribution>[1]> = {}) {
  return {
    attackerId: "player-0", targetId: "enemy-0", attackDetail: "attackPower" as const,
    defenseDetail: "armor" as const, preMitigation: 100, postMitigation: 70,
    hpBefore: 1_000, shieldBefore: 0, hpDamage: 70, shieldAbsorbed: 0, ...overrides,
  };
}

describe("전투 기여도 순수 누적 정책", () => {
  it("단일 공격은 경감·과잉 피해 뒤 실제 HP 감소만 공격력 색상에 기록한다", () => {
    const values = createBattleContributions(["player-0", "enemy-0"]);
    accumulateDamageContribution(values, damage({ hpBefore: 40, hpDamage: 70 }));
    expect(values["player-0"].attack).toEqual({ attackPower: 40, abilityPower: 0 });
  });

  it("광역 공격은 대상별 실제 피해를, 궁극기는 주문력 색상을 각각 더한다", () => {
    const values = createBattleContributions(["player-0", "enemy-0", "enemy-1"]);
    accumulateDamageContribution(values, damage());
    accumulateDamageContribution(values, damage({ targetId: "enemy-1", attackDetail: "abilityPower", hpDamage: 50 }));
    expect(values["player-0"].attack).toEqual({ attackPower: 70, abilityPower: 50 });
  });

  it("방어력·저항력 경감과 10 이하 완전 무효를 서로 다른 칸에 한 번만 기록한다", () => {
    const values = createBattleContributions(["player-0", "enemy-0"]);
    accumulateDamageContribution(values, damage());
    accumulateDamageContribution(values, damage({ defenseDetail: "resistance", preMitigation: 9, postMitigation: 0, hpDamage: 0 }));
    expect(values["enemy-0"].defense).toEqual({ armor: 30, resistance: 9, shield: 0 });
  });

  it("보호막 흡수는 피해 대상이 아니라 제공자에게, 자가 보호막은 본인에게 귀속한다", () => {
    const values = createBattleContributions(["player-0", "enemy-0", "enemy-1"]);
    accumulateDamageContribution(values, damage({ shieldBefore: 30, hpDamage: 40, shieldAbsorbed: 30, shieldProviderId: "enemy-1" }));
    accumulateDamageContribution(values, damage({ shieldBefore: 10, hpDamage: 60, shieldAbsorbed: 10, shieldProviderId: "enemy-0" }));
    expect(values["enemy-1"].defense.shield).toBe(30);
    expect(values["enemy-0"].defense.shield).toBe(10);
  });

  it("자가·아군 회복은 실제 증가량만 시전자에게 기록하고 과잉·차단 0은 제외한다", () => {
    const values = createBattleContributions(["player-0", "player-1"]);
    addContribution(values, "player-0", "healing", 25); // 흡혈/자가 재생의 실제 증가량.
    addContribution(values, "player-0", "healing", 40); // player-1에게 준 아군 회복의 실제 증가량.
    addContribution(values, "player-0", "healing", 0); // 최대 HP 과잉 회복.
    addContribution(values, "player-0", "healing", 0); // 폰토스 폭주로 취소된 회복.
    expect(values["player-0"].healing).toBe(65);
  });

  it("추가타와 출혈처럼 공격자 귀속이 분명한 피해는 더하고 환경 피해는 제외한다", () => {
    const values = createBattleContributions(["player-0", "enemy-0"]);
    accumulateDamageContribution(values, damage({ hpDamage: 20 })); // 추가타.
    accumulateDamageContribution(values, damage({ hpDamage: 15, preMitigation: 15, postMitigation: 15 })); // 출혈.
    accumulateDamageContribution(values, damage({ attackerId: "environment", hpDamage: 50 }));
    expect(values["player-0"].attack.attackPower).toBe(35);
  });

  it("스냅샷은 복사본이며 동률을 편성 순서로 고정하고 전체 합계 비율을 계산한다", () => {
    const values = createBattleContributions(["a", "b"]);
    addContribution(values, "a", "healing", 10); addContribution(values, "b", "healing", 10);
    const rows = contributionSnapshot(values, [
      { id: "b", formationOrder: 1, name: "B", portraitId: "same" },
      { id: "a", formationOrder: 0, name: "A", portraitId: "same" },
    ], "healing");
    expect(rows.map(({ fighterId }) => fighterId)).toEqual(["a", "b"]);
    expect(rows.map(({ ratio }) => ratio)).toEqual([0.5, 0.5]);
    rows[0].attack.attackPower = 999;
    expect(contributionValue(values, "a")?.attack.attackPower).toBe(0);
  });
});
