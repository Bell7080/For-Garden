import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import type { Passive, RelicDef, Role, Skill } from "../../src/core/types";

/**
 * 직군 계약 — `docs/combat-affinities.md`의 「직군 계약」 표를 데이터에 강제한다.
 *
 * **태그가 운용을 말하려면 그 운용을 실제로 할 수 있어야 한다.** 이 검사가 없던 동안 전사
 * 케리스는 수급이 한 줄도 없었고, 탱커 데이는 도발만 걸고 버틸 수단이 없었으며, 암살자
 * 스피나는 평타에 붙은 회복으로 전사보다 잘 버텼다. 셋 다 화면의 태그와 실제 운용이 갈린
 * 자리였고, 사람 눈으로는 개체가 늘 때마다 다시 놓쳤다.
 *
 * **적도 같은 잣대를 쓴다.** 적과 아군이 같은 `RelicDef` 정체성 규칙을 쓴다는 원칙 그대로다.
 * 소환수만 빼는데, 그 셋은 태생 능력치까지 주인에게서 파생하는 몸이라 제 직군으로 서지 않는다.
 */
const AUDITED = RELICS.filter((relic) => relic.summonOnly !== true);

/** 이 개체만 이 요건을 비껴간다는 기록. 값은 **왜 예외인지**이고, 비워 두면 예외가 아니다. */
const EXCEPTIONS: Readonly<Record<string, string>> = {
  // 폰토스는 단일 정예 보스이며 죽지 않는 "스코어 갱신형 월드 보스"다. 도발할 아군도, 돌아갈
  // 전열도 없는 자리라 탱커 태그가 말하는 것은 어그로가 아니라 **버티는 몸** 하나뿐이다.
  "pontos:taunt": "단독 월드 보스라 도발할 전열 자체가 없다",
  // 버티는 몫을 「심해의 압력」이 시간 누적 주문력과 잃은 체력 경감으로 낸다. 새 개체에는
  // 다시 만들지 않는 감쇠라 공용 수급 목록에 올리지 않고 이 한 줄로만 남긴다.
  "pontos:sustain": "심해의 압력이 잃은 체력 경감으로 버티며, 쓰러지지 않는 것이 이 개체의 설계다",
  /*
   * 레이티아 다섯 자매는 **도발하지 않고 막아선다.**
   *
   * 한 무리가 셋에서 다섯이라 자매마다 도발을 들면 앞줄의 표적이 매 초 통째로 갈려, 아군이
   * 누구를 때리는 중인지 읽을 수 없게 된다. 게다가 다섯이 동시에 걸면 마지막 하나만 남아
   * 사실상 한 마리의 도발이다 — 몸으로 통로를 메우는 것이 이 무리가 어그로를 끄는 방법이고,
   * 그것은 수치가 아니라 서 있는 자리가 한다.
   */
  "raitia-grass:taunt": "떼로 서서 통로를 메우는 것이 어그로라, 자매마다 도발을 들면 앞줄 표적이 매 초 갈린다",
  "raitia-water:taunt": "떼로 서서 통로를 메우는 것이 어그로라, 자매마다 도발을 들면 앞줄 표적이 매 초 갈린다",
  "raitia-fire:taunt": "떼로 서서 통로를 메우는 것이 어그로라, 자매마다 도발을 들면 앞줄 표적이 매 초 갈린다",
  "raitia-earth:taunt": "떼로 서서 통로를 메우는 것이 어그로라, 자매마다 도발을 들면 앞줄 표적이 매 초 갈린다",
  "raitia-wind:taunt": "떼로 서서 통로를 메우는 것이 어그로라, 자매마다 도발을 들면 앞줄 표적이 매 초 갈린다",
};

const has = (id: string, requirement: string): boolean => EXCEPTIONS[`${id}:${requirement}`] !== undefined;

/** 그 스킬이 시전자 자신을 수급하는가. 계약이 세는 것은 **실제로 돌아오는 값**뿐이다. */
function skillSustains(skill: Skill): boolean {
  const any = skill as unknown as Record<string, unknown>;
  return any.damageHealingPercent !== undefined
    || any.damageHealingPercentIfFrozen !== undefined
    || any.shieldFromDamagePercent !== undefined
    || any.shieldMaxHpPercent !== undefined
    || any.shieldPercent !== undefined
    || any.selfBulwark !== undefined
    || any.selfGuard !== undefined
    || (Array.isArray(any.steps) && any.steps.some((step: Record<string, unknown>) =>
      step.shieldFromDamagePercent !== undefined || step.shieldMaxHpPercent !== undefined));
}

function passiveSustains(passive: Passive): boolean {
  const kinds = new Set(["emergencyRecovery", "impactCap", "undyingTalisman", "painfulElation", "shellGuard", "sutureStitch", "adagioWeight"]);
  return kinds.has(passive.kind)
    || passive.frenzyLifeStealPercent !== undefined
    || passive.tauntHeal !== undefined
    || passive.lifeStealPoints !== undefined
    || passive.concussionShieldPercent !== undefined;
}

/** 폭주로만 도는 수급. 계약을 **채우지는 않지만** 어기지도 않는다(폭주 점유율 약 3분의 1). */
function ferocitySustains(relic: RelicDef): boolean {
  const trait = relic.ferocityTrait as unknown as Record<string, unknown>;
  return trait.healPercent !== undefined || trait.shieldMaxHpPercent !== undefined
    || trait.missingHpShieldPercent !== undefined || trait.missingHpRegenPercentPerSecond !== undefined
    || trait.allDamageLifeStealPoints !== undefined || trait.healingShieldPercent !== undefined
    || trait.shieldPercentOfDamageTaken !== undefined;
}

function sustains(relic: RelicDef): boolean {
  return relic.stats.lifeSteal > 0 || passiveSustains(relic.passive)
    || skillSustains(relic.basic) || skillSustains(relic.ultimate) || ferocitySustains(relic);
}

function stealths(relic: RelicDef): boolean {
  const trait = relic.ferocityTrait as unknown as Record<string, unknown>;
  const basic = relic.basic as unknown as Record<string, unknown>;
  return relic.passive.openingStealthSeconds !== undefined
    || relic.passive.damageStealthSeconds !== undefined
    || ["lowHpVanish", "openingVanish", "summonCommander", "duoLink"].includes(relic.passive.kind)
    || trait.stealthDurationSeconds !== undefined || trait.effectId === "stealthLeap"
    || (relic.ultimate as unknown as Record<string, unknown>).selfSetup !== undefined
    || (Array.isArray(basic.steps) && basic.steps.some((step: Record<string, unknown>) => step.selfStealthSeconds !== undefined));
}

function blinks(relic: RelicDef): boolean {
  const trait = relic.ferocityTrait as unknown as Record<string, unknown>;
  return ["gourmetHunt", "stalkerBlink"].includes(relic.passive.kind)
    || trait.leapTarget !== undefined
    || (relic.ultimate as unknown as Record<string, unknown>).blinkToLowestDefense !== undefined;
}

function taunts(relic: RelicDef): boolean {
  const json = JSON.stringify([relic.basic, relic.ultimate, relic.ferocityTrait, relic.passive]);
  return json.includes('"taunt"') || json.includes("tauntSeconds") || json.includes("tauntRadius") || json.includes("tauntDurationSeconds");
}

function boostsAllies(relic: RelicDef): boolean {
  const json = JSON.stringify([relic.basic, relic.ultimate, relic.ferocityTrait, relic.passive]);
  return ["teamBuff", "ally", "Ally", "duoHeal", "duoCharge", "team", "healing"].some((key) => json.includes(key));
}

const byRole = (role: Role): RelicDef[] => AUDITED.filter((relic) => relic.role === role);

describe("직군 계약", () => {
  it("전사는 자가 수급을 하나 이상 갖는다", () => {
    for (const relic of byRole("warrior")) {
      expect(sustains(relic) || has(relic.id, "sustain"), `${relic.id}(${relic.name})`).toBe(true);
    }
  });

  /** 은신은 암살자의 수단이다. 전사가 그것까지 가지면 두 태그가 한 개체에 겹친다. */
  it("전사는 은신을 갖지 않는다", () => {
    for (const relic of byRole("warrior")) {
      expect(stealths(relic), `${relic.id}(${relic.name})`).toBe(false);
    }
  });

  it("탱커는 생존기와 도발을 함께 갖는다", () => {
    for (const relic of byRole("tank")) {
      expect(sustains(relic) || has(relic.id, "sustain"), `${relic.id}(${relic.name}) 생존기`).toBe(true);
      expect(taunts(relic) || has(relic.id, "taunt"), `${relic.id}(${relic.name}) 도발`).toBe(true);
    }
  });

  /** 치명타 가산이거나 은신·순간이동이거나 — 접근과 순간 피해 중 하나는 실제로 할 수 있어야 한다. */
  it("암살자는 치명타 가산이나 은신·순간이동을 갖는다", () => {
    for (const relic of byRole("assassin")) {
      const crit = relic.passive.criticalChancePercent !== undefined;
      expect(crit || stealths(relic) || blinks(relic), `${relic.id}(${relic.name})`).toBe(true);
    }
  });

  /**
   * **암살자가 갖지 않는 것은 "상시" 수급이다** — 능력치·패시브·기본 공격에 붙어 매 타격마다
   * 도는 값이다. 스피나의 연격에 달려 있던 잃은 체력 회복이 그것이었고, 그 한 줄로 암살자가
   * 전사보다 잘 버텼다.
   *
   * **궁극기와 폭주는 세지 않는다.** 둘 다 게이지를 채워야 열리는 **한 순간**이라 "낮은
   * 생존력"이라는 전제를 뒤집지 않는다 — 폭주는 전투의 약 3분의 1만 열리고 한 판에 한 번뿐이다
   * (`docs/combat-affinities.md`). 같은 잣대를 전사에도 쓴다: 토비의 유지력이 궁극기에 있어도
   * "하나 이상"은 채운 것으로 본다.
   */
  it("암살자는 능력치·패시브·기본 공격에 상시 수급을 갖지 않는다", () => {
    for (const relic of byRole("assassin")) {
      const always = relic.stats.lifeSteal > 0 || passiveSustains(relic.passive) || skillSustains(relic.basic);
      expect(always, `${relic.id}(${relic.name})`).toBe(false);
    }
  });

  it("지원가는 아군을 강화하거나 회복·보호막을 준다", () => {
    for (const relic of byRole("support")) {
      expect(boostsAllies(relic), `${relic.id}(${relic.name})`).toBe(true);
    }
  });

  /** 예외는 반드시 이유를 적는다. 빈 문자열로 적어 두면 검사를 껐다는 것을 알 수 없다. */
  it("예외표의 모든 항목은 이유를 갖는다", () => {
    for (const [key, reason] of Object.entries(EXCEPTIONS)) {
      expect(reason.length, key).toBeGreaterThan(10);
      expect(AUDITED.some((relic) => relic.id === key.split(":")[0]), key).toBe(true);
    }
  });
});
