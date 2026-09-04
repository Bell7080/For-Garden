import { describe, expect, it } from "vitest";
import ts from "typescript";
import PREPARE_ICONS from "../../scripts/prepare_icons.py?raw";
import { RELICS } from "../../src/data/relics";
import { KEYWORDS } from "../../src/data/keywords";
import type { Skill } from "../../src/core/types";
import { ELEMENT_TINT, ROLE_TINT, SKILL_ART_ASSETS, SKILL_ART_SLOTS, skillArtFor, skillArtKey, skillArtTint } from "../../src/ui/skillArt";
import { allyHealPowerKeyword, attackSpeedCompositeDamageKeyword, canPreviewSkillDamage, damageHealingLabel, damageKeyword, ferocityTraitDescription, passiveDescription, overpaintDetonationDamageKeyword, passiveShieldKeyword, recoveryLabel, skillDescription, skillKeywordLayoutOptions, statusEffectLabel, targetingLabel } from "../../src/ui/skillPresentation";
import type { SkillInfoViewModel } from "../../src/ui/SkillPopup";

/** 구워 둔 스킬 일러스트. 코드가 가리키는 파일이 실제로 있는지 확인한다. */
const ART_FILES = import.meta.glob("../../public/sprites/skills/*/*.webp");

/** 주석과 설계 문서가 아닌 실행 가능한 소스 문자열만 검사하도록 TypeScript 구문 트리를 읽는다. */
const SOURCE_FILES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** `("파일.png", (0xEF, 0x5B, 0x45))` 꼴에서 웹 경로와 색을 뽑는다. */
function scriptColors(): Record<string, number> {
  const table: Record<string, number> = {};
  for (const [, , name, r, g, b] of PREPARE_ICONS.matchAll(/"sprites\/(\w+)\/(\w+)\.webp":\s*\("[^"]+",\s*\(0x([0-9A-F]{2}),\s*0x([0-9A-F]{2}),\s*0x([0-9A-F]{2})\)\)/g)) {
    table[name] = (parseInt(r, 16) << 16) | (parseInt(g, 16) << 8) | parseInt(b, 16);
  }
  return table;
}

describe("스킬 일러스트 필터", () => {
  it("의 속성·직군 색은 구워 둔 아이콘의 색과 같다", () => {
    const baked = scriptColors();
    for (const [element, color] of Object.entries(ELEMENT_TINT)) expect(baked[element]).toBe(color);
    for (const [role, color] of Object.entries(ROLE_TINT)) expect(baked[role]).toBe(color);
  });

  it("는 어떤 조합이든 탁하지 않은 밝은 파스텔을 만든다", () => {
    for (const def of RELICS) {
      const tint = skillArtTint(def.element, def.role);
      const channels = [(tint >> 16) & 0xff, (tint >> 8) & 0xff, tint & 0xff];
      // 가장 밝은 채널은 늘 꽉 차고(밝기 고정), 가장 어두운 채널도 충분히 밝다(진하기 고정).
      expect(Math.max(...channels)).toBe(255);
      expect(Math.min(...channels)).toBe(168);
    }
  });

  it("는 속성이 같아도 직군이 다르면 다른 색이 된다", () => {
    expect(skillArtTint("grass", "assassin")).not.toBe(skillArtTint("grass", "support"));
  });
});

describe("스킬 일러스트 파일", () => {
  it("은 코드가 가리키는 키마다 실제 WebP가 있다", () => {
    expect(SKILL_ART_ASSETS.length).toBeGreaterThan(0);
    for (const [, path] of SKILL_ART_ASSETS) {
      expect(Object.keys(ART_FILES)).toContain(`../../public${path}`);
    }
  });

  it("은 7·8번 원화를 붙인 스테라·티아도 전용 일러스트를 갖는다", () => {
    // 목록에 id를 더하지 않으면 그림 파일만 저장소에 남고 화면은 공용 아이콘으로 남는다.
    for (const relicId of ["stella", "tia"]) {
      for (const slot of SKILL_ART_SLOTS) {
        expect(skillArtFor(relicId, slot), `${relicId} ${slot}`).toBe(skillArtKey(relicId, slot));
      }
    }
  });

  it("은 렐릭 하나에 네 칸을 모두 채운다", () => {
    const relics = new Set(SKILL_ART_ASSETS.map(([key]) => key));
    for (const def of RELICS) {
      const art = skillArtFor(def.id, "passive");
      if (!art) continue;
      for (const slot of SKILL_ART_SLOTS) expect(relics.has(skillArtKey(def.id, slot))).toBe(true);
    }
  });
});

describe("토리카 스킬 표시 계약", () => {
  it("은 구조화된 5초·7%·전체 적·2초 값을 실제 표시 문구로 만든다", () => {
    // UI가 ID별 예외 없이 같은 정적 데이터를 읽을 수 있도록 모든 궁극기의 계약을 검사한다.
    // 순수 회복 궁극기는 적 대상 네 종류와 분리된 전장 전체 아군 계약을 사용하고,
    // 아무도 때리지 않고 자리만 잡는 궁극기(델로피)는 자신만 가리키는 계약을 쓴다.
    for (const def of RELICS) expect(["single", "nearbyEnemies", "battlefieldEnemies", "battlefieldAllies", "self", "targetedCircle", "chargeLine"]).toContain(def.ultimate.targeting);
    const torika = RELICS.find((def) => def.id === "anky")!;
    expect(torika.ultimate).toMatchObject({
      targeting: "nearbyEnemies",
      radius: 220,
      statusEffects: [{ kind: "stun", seconds: 2 }],
    });
    expect(torika.passive).toMatchObject({ value: 7, durationSeconds: 5 });
    expect(`${torika.passive.durationSeconds}초 동안 ${recoveryLabel(torika.passive.value)}`).toBe("5초 동안 매초 최대 체력의 7% 회복");
    expect(targetingLabel(torika.ultimate.targeting)).toBe("자신의 주위 모든 적");
    expect(statusEffectLabel(torika.ultimate.statusEffects?.[0])).toBe("[[stun|기절]] 2초");
    expect(ferocityTraitDescription(torika.ferocityTrait, { attack: torika.stats.atk, defense: torika.stats.def })).toBe("공격 속도가 20% 증가한다. 기본 공격이 대상 주위의 모든 적에게 적중해 [[damage-value|19]]만큼 추가 물리 피해를 입히고 [[stagger|경직]]시킨다.");
    // 설명의 환산 피해도 현재 방어력을 다시 읽으므로 레벨·룬으로 능력치가 변하면 같이 변한다.
    expect(ferocityTraitDescription(torika.ferocityTrait, { attack: torika.stats.atk, defense: torika.stats.def * 2 })).toContain("[[damage-value|38]]");
    // 공격 스킬에는 설명 원문 자체를 두지 않는다 — 문장은 구조화 필드에서만 나온다.
    expect(torika.ultimate.desc).toBeUndefined();
    // 전투 엔진의 반경(px) 같은 개발 좌표는 문장에 새지 않고 대상 범위 문구로만 나온다.
    expect(skillDescription(torika.ultimate)).not.toContain("220");
    expect(skillDescription(torika.ultimate)).toContain("자신의 주위 모든 적에게");
  });
  it("은 일반 공격과 궁극기의 피해 출처를 공용 상세 정의로 만든다", () => {
    expect(damageKeyword({ kind: "scaling", amount: 128, power: 100, stat: "공격력", label: "피해량" })).toMatchObject({
      id: "damage-value",
      term: "128",
      description: "현재 공격력에서 100%를 받아 계산한 피해 수치다.",
    });
  });

  it("은 폭주 본문에도 동적 피해 키워드 사전을 전달한다", () => {
    // 실제 팝업 계약을 최소 구성해 본문 레이아웃에서 피해 수치 링크가 빠지는 회귀를 막는다.
    const damage = damageKeyword({ kind: "scaling", amount: 19, power: 15, stat: "방어력", label: "피해량" })!;
    const skill: SkillInfoViewModel = {
      name: "다들 그만해!", kindLabel: "폭주", iconAssetId: "skill-icon-buff",
      effectType: "buff", description: "[[damage-value|19]]만큼 추가 피해", contextualKeywords: [damage],
    };
    expect(skillKeywordLayoutOptions(skill, { width: 760, size: 28 }).contextualKeywords).toEqual([damage]);
  });
});

describe("폰토스 스킬 표시 계약", () => {
  it("은 구조화된 AP 계수·전장 전체 대상·5초 기절을 공용 문구로 자동 표시한다", () => {
    const pontos = RELICS.find((def) => def.id === "pontos")!;
    // 팝업 조립부가 사용하는 세 순수 경계를 검사해 캐릭터 ID 전용 문구가 필요 없음을 고정한다.
    expect(damageKeyword({ kind: "scaling", amount: 480, power: pontos.ultimate.power!, stat: "주문력", label: "피해량" })?.description)
      .toBe("현재 주문력에서 500%를 받아 계산한 피해 수치다.");
    expect(targetingLabel(pontos.ultimate.targeting)).toBe("전장의 모든 적");
    expect(statusEffectLabel(pontos.ultimate.statusEffects?.[0])).toBe("[[stun|기절]] 5초");
  });
});

describe("렉시아 스킬 표시 계약", () => {
  it("은 폭주·패시브·출혈·궁극기 회복을 현재 데이터에서 문장화한다", () => {
    const rex = RELICS.find((def) => def.id === "rex")!;
    expect(ferocityTraitDescription(rex.ferocityTrait)).toBe("치명타 확률과 모든 피해 흡혈이 각각 25%, 25% 증가한다.");
    expect(passiveDescription(rex.passive)).toBe("전투 시작 시, 공격 속도·공격력·치명타 확률·치명타 피해가 모두 25% 오른다.");
    expect(statusEffectLabel(rex.basic.statusEffects?.[0])).toBe("[[bleed|출혈]] 3초 · 매초 최대 체력 2%");
    expect(targetingLabel(rex.ultimate.targeting)).toBe("적 한 명");
    expect(damageHealingLabel(rex.ultimate.damageHealingPercent)).toBe("실제 피해의 50% 회복");
  });
});

describe("메테 스킬 표시 계약", () => {
  it("은 순수 회복형 궁극기의 피해 미리보기를 만들지 않는다(궁극기 팝업 회귀 방지)", () => {
    const mette = RELICS.find((def) => def.id === "mette")!;
    // damageType/power가 없는 궁극기에 previewSkillDamage를 시도하면 예외가 나 정보창
    // 스킬 팝업이 통째로 열리지 않았다 — 이 판별이 그 앞단 가드다.
    expect(canPreviewSkillDamage(mette.ultimate, "궁극기")).toBe(false);
    expect(canPreviewSkillDamage(mette.basic, "일반 공격")).toBe(true);
    expect(canPreviewSkillDamage(mette.basic, "패시브")).toBe(false);
  });

  it("은 폭주·패시브의 % 수치를 실제 능력치로 환산한 태그로 만든다", () => {
    const mette = RELICS.find((def) => def.id === "mette")!;
    expect(ferocityTraitDescription(mette.ferocityTrait, { attack: 200, defense: 0 })).toBe(
      "폭주 중 아군 기본 공격 적중마다 [[damage-value|100]]의 피해량을 가진 [[mette-staccato|스타카토]]가 추가로 발동한다.",
    );
    expect(passiveShieldKeyword(mette.passive, 200)).toMatchObject({ id: "shield-value", term: "400" });
    expect(passiveDescription(mette.passive, 200)).toBe(
      "생존 중 아군 [[attack-speed|공격 속도]]를 20% 높인다. 아군이 [[crowd-control|군중제어]]에 걸리면 즉시 정화하고 [[shield-value|400]] 보호막을 부여한다.",
    );
  });

  it("의 기본 공격은 0.1초를 중복해서 적지 않고 경직 태그 하나로 표시한다", () => {
    const mette = RELICS.find((def) => def.id === "mette")!;
    // 경직은 키워드 설명이 "약 0.1초"를 말하므로 본문에서 시간을 다시 적지 않는다.
    expect(skillDescription(mette.basic)).not.toContain("0.1초");
    expect(skillDescription(mette.basic)).toContain("[[stagger|경직]]시킨다");
    // 마법 피해지만 공격력에서 나오는 스킬이라 되돌아가는 표기도 공격력을 말한다.
    expect(skillDescription(mette.basic)).toBe("적 한 명에게 공격력의 100% [[magical-damage|마법 피해]]를 주고 [[stagger|경직]]시킨다.");
  });

  it("의 궁극기는 피해가 없는 회복 계약에서 문장을 만든다", () => {
    const mette = RELICS.find((def) => def.id === "mette")!;
    expect(skillDescription(mette.ultimate)).toBe("모든 생존 아군이 각자 [[missing-hp|잃은 체력]]의 15%를 회복한다.");
  });
});

describe("도디 스킬 표시 계약", () => {
  it("은 궁극기의 아군 회복 %를 실제 주문력 수치로 환산한 태그로 만든다", () => {
    const dodo = RELICS.find((def) => def.id === "dodo")!;
    expect(allyHealPowerKeyword(dodo.ultimate.allyHealingPower!, 150)).toMatchObject({ id: "heal-value", term: "300" });
    expect(skillDescription(dodo.ultimate, { ap: 150, damage: 400 })).toBe(
      "지정한 원 안의 모든 적에게 [[damage-value|400]]의 [[magical-damage|마법 피해]]를 주고, "
      + "모든 생존 아군의 체력을 [[heal-value|300]]만큼 회복한다.",
    );
  });

  it("의 야성 발현은 배속 환산 괄호 없이 상승률만 말한다", () => {
    const dodo = RELICS.find((def) => def.id === "dodo")!;
    expect(ferocityTraitDescription(dodo.ferocityTrait)).toBe("공격 속도가 100% 증가한다.");
  });

  it("의 일반 공격은 묘사 대신 대상·피해·회복 비율을 말한다", () => {
    const dodo = RELICS.find((def) => def.id === "dodo")!;
    // 부리로 쪼는 묘사는 전투 결과를 바꾸지 않으므로 화면에 남기지 않는다.
    expect(skillDescription(dodo.basic)).not.toContain("부리");
    expect(skillDescription(dodo.basic, { damage: 120 })).toBe(
      "적 한 명에게 [[damage-value|120]]의 [[magical-damage|마법 피해]]를 주고, 입힌 피해의 "
      + `${dodo.basic.lowestHpAllyHealingFromDamagePercent}%만큼 현재 체력이 가장 낮은 생존 아군을 회복한다.`,
    );
    // 능력치를 모르면(도감만 보는 경우) 위력 %로 되돌아가되, 어느 능력치에서 나오는 배율인지
    // 함께 말한다 — 마법 피해는 주문력에서 나온다.
    expect(skillDescription(dodo.basic)).toContain(`주문력의 ${dodo.basic.power}%`);
  });
});

describe("렉시아 스킬 표시 계약", () => {
  it("의 궁극기는 포효 묘사 대신 대상·피해·회복 비율을 말한다", () => {
    const rex = RELICS.find((def) => def.id === "rex")!;
    expect(skillDescription(rex.ultimate)).not.toContain("포효");
    expect(skillDescription(rex.ultimate, { damage: 400 })).toBe(
      "적 한 명에게 [[damage-value|400]]의 [[physical-damage|물리 피해]]를 주고, 입힌 피해의 "
      + `${rex.ultimate.damageHealingPercent}%만큼 체력을 회복한다.`,
    );
  });
});

describe("폰토스 스킬 표시 계약", () => {
  it("의 패시브는 복리 누적률과 체력별 내구력 경계를 모두 명시한다", () => {
    const pontos = RELICS.find((def) => def.id === "pontos")!;
    expect(passiveDescription(pontos.passive)).toBe(
      "완전히 경과한 매초 기본 [[ap|주문력]]의 2%가 복리로 누적된다. 현재 체력이 최대 체력의 100%에서 50%로 낮아질수록 받는 모든 피해 감소가 50%에서 99%까지 선형으로 증가하며, 그 이하에서는 최대치로 제한된다. 최종 받는 피해가 10 이하인 공격은 무효화한다.",
    );
  });
});

describe("티아 스킬 표시 계약", () => {
  const tia = () => RELICS.find((def) => def.id === "tia")!;

  it("은 두 공격 모두 주문력에서 나오는 마법 피해다", () => {
    const def = tia();
    // 물 전사지만 피해는 주먹이 아니라 물살에서 나온다 — 계수·대상 계약을 데이터로 고정한다.
    // 표식은 한 번에 한 명만 달 수 있으므로 기본 공격은 한 명을 겨눈다.
    expect(def.basic).toMatchObject({ damageType: "magical", scalingStat: "ap", targeting: "single" });
    expect(def.ultimate).toMatchObject({ damageType: "magical", scalingStat: "ap", targeting: "nearbyEnemies" });
    expect(def.basic.radius).toBeUndefined();
    expect(def.ultimate.radius).toBeGreaterThan(0);
    // 능력치를 모르는 자리에서도 어느 능력치에서 나오는 배율인지 말한다.
    expect(skillDescription(def.basic)).toBe(`적 한 명에게 주문력의 ${def.basic.power}% [[magical-damage|마법 피해]]를 준다.`);
  });

  it("의 궁극기는 대상·피해·경직을 한 문장으로 말한다", () => {
    const def = tia();
    expect(skillDescription(def.ultimate, { damage: 300 })).toBe(
      "자신의 주위 모든 적에게 [[damage-value|300]]의 [[magical-damage|마법 피해]]를 주고 [[stagger|경직]]시킨다.",
    );
  });

  it("의 폭주와 패시브는 표식을 옮겨 다니는 쪽으로 읽힌다", () => {
    const def = tia();
    // 두 스킬이 한 덩어리다 — 폭주가 표적을 계속 바꾸고, 바뀐 표적마다 표식이 옮겨가며 터진다.
    expect(def.ferocityTrait).toMatchObject({ effectId: "ichthyoDive", moveSpeedPercent: 100 });
    expect(ferocityTraitDescription(def.ferocityTrait)).toBe(
      "이동 속도가 100% 증가하고, [[basic-attack|기본 공격]] 이후 표적을 다른 적으로 바꾼다.",
    );
    expect(def.passive.kind).toBe("shimmerMark");
    // 추가 피해 계수는 데이터에서 나오고 어느 능력치에서 나오는지도 함께 말한다.
    expect(passiveDescription(def.passive)).toBe(
      `적을 타격하면 반짝이는 표식을 남긴다. 표식이 없는 적을 타격하면 표식이 그 적에게 옮겨가며 [[ap|주문력]]의 ${def.passive.value}% [[magical-damage|마법 피해]]를 추가로 입힌다.`,
    );
  });
});

describe("스테라 스킬 표시 계약", () => {
  const stella = () => RELICS.find((def) => def.id === "stella")!;

  it("의 기본 공격은 피해 뒤에 아군 충전을 제 문장으로 말한다", () => {
    const def = stella();
    expect(def.basic).toMatchObject({ damageType: "physical", targeting: "single", power: 50, allyEnergyGain: 5 });
    // 주어가 시전자에서 아군으로 바뀌는 절이라 "주고"로 잇지 않고 문장을 끊는다.
    expect(skillDescription(def.basic, { damage: 54 })).toBe(
      "적 한 명에게 [[damage-value|54]]의 [[physical-damage|물리 피해]]를 준다. 모든 생존 아군의 궁극기 게이지가 5 오른다.",
    );
  });

  it("의 궁극기는 피해가 아니라 순풍과 그 시간, 자기 몫의 회복만 말한다", () => {
    const def = stella();
    const buff = def.ultimate.teamBuff!;
    expect(def.ultimate).toMatchObject({
      targeting: "battlefieldAllies",
      teamBuff: { kind: "tailwind", attackSpeedPercent: 20, moveSpeedPercent: 20, maxHpRegenPercentPerSecond: 2 },
    });
    // 순풍이 무엇인지는 키워드가 말한다 — 본문이 공속·이속을 다시 적으면 같은 말을 두 번 한다.
    // 지속 회복만은 순풍 태그가 말하지 않는 이 궁극기의 몫이라 본문이 직접 적는다.
    expect(skillDescription(def.ultimate)).toBe(
      `모든 생존 아군에게 ${buff.seconds}초 동안 [[tailwind|순풍]]을 부여한다. [[tailwind|순풍]]이 지속되는 동안 매초 최대 체력의 ${buff.maxHpRegenPercentPerSecond}%를 회복시킨다.`,
    );
  });

  it("의 순풍 수치는 키워드 설명이 말하는 값과 같다", () => {
    // 키워드가 "각각 20%"라고 적어 두므로, 데이터를 조정하면 그 문장도 함께 고쳐야 한다.
    const tailwind = KEYWORDS.find(({ id }) => id === "tailwind")!;
    for (const relic of RELICS) {
      const buff = relic.ultimate.teamBuff;
      if (buff?.kind !== "tailwind") continue;
      expect(tailwind.description, relic.name).toContain(`각각 ${buff.attackSpeedPercent}%`);
      expect(buff.moveSpeedPercent).toBe(buff.attackSpeedPercent);
      // 지속 회복은 키워드가 말하지 않는다 — 순풍을 건 스킬만의 몫이기 때문이다.
      expect(tailwind.description).not.toContain("회복");
    }
  });

  it("의 폭주와 패시브는 아군을 밀어 주는 쪽으로 읽힌다", () => {
    const def = stella();
    expect(def.ferocityTrait).toMatchObject({ effectId: "tailwindRally", teamFerocityGain: 5, teamEnergyGain: 5 });
    expect(ferocityTraitDescription(def.ferocityTrait)).toBe(
      "모든 아군이 공격할 때마다 오르는 [[ferocity|야성]] 게이지와 궁극기 게이지가 각각 5, 5씩 늘어난다.",
    );
    expect(def.passive.kind).toBe("lowHpVanish");
    expect(passiveDescription(def.passive)).toBe(
      `전투당 한 번, 체력이 절반 이하가 되면 ${def.passive.durationSeconds}초 동안 [[stealth|은신]]해 표적에서 벗어난다.`,
    );
  });
});

describe("델로피 스킬 표시 계약", () => {
  const delopi = RELICS.find((def) => def.id === "delopi")!;

  it("은 위력을 나눠 가진 두 능력치를 라벨과 본문이 같은 값으로 말한다", () => {
    // 한쪽 축만 적으면 실제 피해의 절반이 어디서 왔는지 설명되지 않는다.
    const preview = { kind: "scaling", amount: 114, power: 50, stat: "공격력", secondary: { power: 50, stat: "주문력" }, label: "피해량" } as const;
    expect(damageKeyword(preview)?.description).toBe("현재 공격력의 50%와 주문력의 50%를 더해 계산한 피해 수치다.");
    // 능력치를 아는 자리는 태그 하나로, 모르는 자리(도감)는 두 축을 모두 말하는 %로 되돌아간다.
    expect(skillDescription(delopi.basic, { damage: 114 })).toBe("적 한 명에게 [[damage-value|114]]의 [[physical-damage|물리 피해]]를 주고 3초 동안 [[poison|중독]]시킨다.");
    expect(skillDescription(delopi.basic)).toContain("공격력의 50%와 주문력의 50%를 더한");
  });

  it("은 중독의 시간만 본문이 적고 매초 수치는 태그에 맡긴다", () => {
    // 출혈과 같은 이유다 — 시간은 스킬마다 다르고, 매초 계수는 쓰는 개체가 하나뿐이라 태그가 가진다.
    expect(statusEffectLabel(delopi.basic.statusEffects?.[0])).toBe("[[poison|중독]] 3초");
    const poison = KEYWORDS.find((keyword) => keyword.id === "poison")!;
    expect(poison.description).toContain("공격력 15%와 주문력 15%");
    expect(skillDescription(delopi.basic, { damage: 114 })).not.toContain("15%");
  });

  it("은 때리지 않는 궁극기를 위력 없이 자리 잡는 문장으로 만든다", () => {
    // 피해 수치를 적지 않는다 — 그 한 방은 이어질 트릭 카드의 몫이라 두 곳이 갈리면 안 된다.
    expect(delopi.ultimate.power).toBeUndefined();
    expect(targetingLabel(delopi.ultimate.targeting)).toBe("자신");
    expect(canPreviewSkillDamage(delopi.ultimate, "궁극기")).toBe(false);
    const text = skillDescription(delopi.ultimate);
    expect(text).toBe("3초 동안 [[stealth|은신]]하고 체력이 가장 낮은 적에게 [[teleport|순간이동]]한다. 이후 처음 적중하는 [[basic-attack|기본 공격]]이 확정 치명타가 되고 방어력을 무시하는 [[fixed-damage|고정 피해]]로 들어간다.");
    expect(text).not.toContain("damage-value");
  });

  it("은 패시브의 치명타 확률과 피해를 서로 다른 값으로 나열한다", () => {
    expect(passiveDescription(delopi.passive)).toBe("전투를 시작할 때 7초 동안 [[stealth|은신]] 상태로 진입한다. 치명타 확률이 5%, 치명타 피해가 25% 오른다.");
  });

  it("은 폭주가 바르는 쪽과 터뜨리는 쪽을 모두 말한다", () => {
    const text = ferocityTraitDescription(delopi.ferocityTrait);
    expect(text).toContain("공격 속도가 30% 증가한다.");
    expect(text).toContain("[[liquidate|청산]]");
    // 번갈아 한다고 적지 않는다 — 실제 규칙은 "지금 걸려 있나"만 보고 고른다.
    expect(text).not.toContain("번갈아");
  });
});

describe("스킬 설명문 양식 계약", () => {
  /** 새 개체가 늘어도 같은 양식으로 읽히는지 목록 전체를 한 번에 검사한다. */
  const attackSkills = RELICS.flatMap((relic) => [
    { relic, slot: "기본", skill: relic.basic as Skill },
    { relic, slot: "궁극", skill: relic.ultimate as Skill },
  ]).filter(({ skill }) => skill.damageType !== undefined);

  it.each(attackSkills.map(({ relic, slot, skill }) => [`${relic.name} ${slot} ${skill.name}`, skill] as const))(
    "%s은 대상 → 피해 → 부가 효과 순서로 읽힌다",
    (_label, skill) => {
      // 공격 속도까지 함께 쓰는 스킬(스피나 궁극기)은 두 축을 합쳐 계산하므로 능력치를 함께 준다.
      const text = skillDescription(skill, { damage: 123, ap: 150, atk: { atk: 120, attackSpeed: 100 } });
      // 대상이 먼저다. 무엇을 때리는지 모른 채 수치부터 읽게 하지 않는다.
      expect(text).toMatch(/^(적 한 명|자신의 주위 모든 적|전장의 모든 적|지정한 원 안의 모든 적|\[\[charge\|돌진\]\]해 뚫고 지나간 길의 모든 적)에게 /);
      // 그다음이 피해다. 실제 수치를 알 수 있으면 조회 가능한 태그로 보여 준다.
      expect(text).toContain("[[damage-value|");
      expect(text).toMatch(/\[\[(physical|magical)-damage\|(물리|마법) 피해\]\]를 (준다|주고)/);
      expect(text.endsWith(".")).toBe(true);
    },
  );

  it("은 공격·정형 회복 스킬의 설명 원문을 데이터에 남기지 않는다", () => {
    // 문장은 구조화 필드 하나에서만 나온다. 원문을 함께 두면 수치를 조정한 뒤 옛 문장이 남는다.
    for (const relic of RELICS) {
      expect(relic.basic.desc, `${relic.name} 기본 공격`).toBeUndefined();
      expect(relic.ultimate.desc, `${relic.name} 궁극기`).toBeUndefined();
    }
  });

  it("은 전투 결과를 바꾸지 않는 묘사문을 화면 문장에 남기지 않는다", () => {
    // 한 번씩 실제로 있었던 묘사문들이다. 되살아나면 이 목록에 걸린다.
    const flavour = ["포효", "부리", "물어", "할퀸다", "내리꽂", "몰아친다", "짓누른다", "퍼뜨린다", "일으킨다", "휩쓰는"];
    for (const relic of RELICS) {
      for (const skill of [relic.basic, relic.ultimate] as Skill[]) {
        const text = skillDescription(skill, { damage: 123, ap: 150, atk: { atk: 120, attackSpeed: 100 } });
        for (const word of flavour) expect(text, `${relic.name} · ${skill.name}`).not.toContain(word);
      }
    }
  });
});

describe("사용자 노출 퍼센트 표시 계약", () => {
  it("은 실행 가능한 소스 문자열에 개발자 단위 표기를 남기지 않는다", () => {
    for (const [path, source] of Object.entries(SOURCE_FILES)) {
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
      // 문자열과 템플릿 조각만 순회해 소스 주석은 의도적으로 회귀 검사 대상에서 제외한다.
      const visit = (node: ts.Node): void => {
        if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
          expect(node.text, `${path}의 사용자 노출 가능 문자열`).not.toContain("%p");
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
    }
  });
});

describe("스피나 스킬 표시 계약", () => {
  it("은 네 슬롯의 이름·요약·구조화 수치를 정적 정의와 함께 유지한다", () => {
    const spino = RELICS.find((def) => def.id === "spino")!;
    expect(spino.ferocityTrait).toMatchObject({ name: "잠행", durationSeconds: 3, leapTarget: "lowestHpEnemy", landingDistance: 172 });
    // 잠행의 내부 도약 ID와 별개로 플레이어 설명은 실제 규칙인 순간이동 키워드를 제공한다.
    expect(ferocityTraitDescription(spino.ferocityTrait)).toContain("[[teleport|순간이동]]");
    expect(ferocityTraitDescription(spino.ferocityTrait)).toContain("3초 동안 [[stealth|은신]]한다");
    expect(spino.passive).toMatchObject({ name: "전투의 환희", kind: "basicHitAttackSpeedStack", value: 3 });
    expect(passiveDescription(spino.passive)).toContain("[[attack-speed|공격 속도]]가 3 증가");
    // 태생 치명타는 전 개체 공통이라, 암살자의 치명타형 정체성을 패시브가 문장으로 말한다.
    expect(passiveDescription(spino.passive)).toContain(`치명타 확률이 ${spino.passive.criticalChancePercent}% 오른다`);
    expect(spino.basic).toMatchObject({ name: "악어턱 물어뜯기", power: 80, combo: { chancePercent: 40, hitCount: 2, missingHpHealingPercentPerHit: 5 } });
    expect(skillDescription(spino.basic, { damage: 100 })).toBe(
      "적 한 명에게 [[damage-value|100]]의 [[physical-damage|물리 피해]]를 주고, 40% 확률로 [[combo|연격]]하여 총 2회 적중한다. "
      + "매 적중 뒤 [[missing-hp|잃은 체력]]의 5%를 회복한다.",
    );
    expect(spino.ultimate).toMatchObject({ name: "범람의 포식자", power: 200, attackSpeedPower: 150, cost: 200, statusEffects: [{ kind: "stun", seconds: 3 }] });
    // 능력치를 모르면(대상 없이 도감만 보는 경우) 옛 %-표기로 되돌아간다.
    expect(skillDescription(spino.ultimate)).toContain("현재 [[attack-speed|공격 속도]]의 150%");
    // "준다"에 "고"를 그대로 붙이면 인용형 어미("~라고")로 읽히는 어색한 문장이 된다.
    // 어간에 연결어미를 붙인 "주고 기절시킨다"여야 자연스럽다.
    // 대상과 기절 지속 시간도 본문이 함께 말한다 — 기절 키워드는 기절이 무엇인지만 말하고
    // 몇 초인지는 스킬마다 다르다.
    expect(skillDescription(spino.ultimate)).toContain("적 한 명에게");
    expect(skillDescription(spino.ultimate)).toContain("주고 3초 동안 [[stun|기절]]시킨다");
    expect(skillDescription(spino.ultimate)).not.toContain("준다고");
    // 능력치가 있으면 위력·공격 속도 두 축을 하나의 실제 수치 태그로 합쳐 보여 준다 —
    // 다른 스킬들과 같은 "%를 실제 값으로 환산" 규칙을 따른다.
    const composite = skillDescription(spino.ultimate, { atk: { atk: spino.stats.atk, attackSpeed: spino.stats.attackSpeed } });
    expect(composite).toMatch(/적 한 명에게 \[\[damage-value\|\d+\]\]의 \[\[physical-damage\|물리 피해\]\]를 주고 3초 동안 \[\[stun\|기절\]\]시킨다\./);
    expect(composite).not.toContain("%");
    const expectedAmount = Math.round(
      (spino.stats.atk * (spino.ultimate.power! + (spino.stats.attackSpeed * spino.ultimate.attackSpeedPower!) / spino.stats.atk)) / 100,
    );
    expect(composite).toContain(`[[damage-value|${expectedAmount}]]`);
  });
});

describe("루카 스킬 표시 계약", () => {
  it("은 구조화된 네 슬롯을 키워드가 연결된 문장으로 표시한다", () => {
    const luka = RELICS.find((def) => def.id === "luka")!;
    // 루카 자신도 동일 표적 공속 대상이라는 모호한 범위를 폭주 표시 문구에 명시한다.
    expect(ferocityTraitDescription(luka.ferocityTrait)).toContain("자신을 포함해 같은 적");
    expect(ferocityTraitDescription(luka.ferocityTrait)).toContain("[[stealth|은신]]");
    expect(ferocityTraitDescription(luka.ferocityTrait)).toContain("[[attack-speed|공격 속도]]가 25%");
    expect(passiveDescription(luka.passive)).toContain("공격력이 가장 높은 렐릭");
    expect(passiveDescription(luka.passive)).toContain(`치명타 확률이 ${luka.passive.criticalChancePercent}% 오른다`);
    expect(skillDescription(luka.basic)).toContain("매 4번째 실제 [[basic-attack|기본 공격]]");
    expect(skillDescription(luka.basic)).toContain("[[physical-damage|물리 피해]]");
    expect(skillDescription(luka.ultimate)).toContain("최종 HP 피해의 75%");
    expect(skillDescription(luka.ultimate)).toContain("[[transfer|전이]]");
  });
});

describe("공격 속도 복합 궁극기 수치 태그", () => {
  it("위력과 공격 속도 두 축을 하나의 배율로 합쳐 계산한다", () => {
    const keyword = attackSpeedCompositeDamageKeyword({ power: 200, attackSpeedPower: 150 }, 100, 120);
    // compositePower = 200 + 120*150/100 = 380 → amount = 100 * 380 / 100 = 380
    expect(keyword).toMatchObject({ id: "damage-value", term: "380" });
  });

  it("능력치가 없으면 계산하지 않는다", () => {
    expect(attackSpeedCompositeDamageKeyword({ power: 200, attackSpeedPower: 150 })).toBeUndefined();
    expect(attackSpeedCompositeDamageKeyword({ power: 200, attackSpeedPower: 150 }, 100)).toBeUndefined();
  });

  it("공격 속도 축이 없는 스킬에는 반응하지 않는다", () => {
    expect(attackSpeedCompositeDamageKeyword({ power: 200 }, 100, 120)).toBeUndefined();
  });
});

describe("메론 스킬 표시 계약", () => {
  const meron = () => RELICS.find((def) => def.id === "meron")!;

  it("의 기본 공격은 덧칠의 겹 상한과 겹당 값을 본문이 직접 말한다", () => {
    const def = meron();
    // 겹 상한·지속 시간·겹당 증가율은 태그가 말하므로 본문이 되풀이하지 않는다.
    expect(def.basic.statusEffects).toEqual([{ kind: "overpaint", seconds: 10, damageTakenPercent: 6, maxStacks: 4 }]);
    expect(skillDescription(def.basic, { damage: 101 })).toBe(
      "적 한 명에게 [[damage-value|101]]의 [[magical-damage|마법 피해]]를 주고 [[overpaint|덧칠]]을 한 겹 쌓는다.",
    );
  });

  it("의 궁극기는 총 피해가 아니라 겹당 피해로 말한다", () => {
    const def = meron();
    expect(def.ultimate).toMatchObject({ targeting: "battlefieldEnemies", overpaintDetonation: true, power: 60 });
    // "적 전체에 얼마"로 적으면 한 겹 칠한 적과 다섯 겹 칠한 적이 같은 수를 맞는 것처럼 읽힌다.
    expect(skillDescription(def.ultimate, { damage: 172 })).toBe(
      "전장의 모든 적에게 쌓인 [[overpaint|덧칠]]을 터뜨려 한 겹마다 [[damage-value|172]]의 [[magical-damage|마법 피해]]를 주고, 그 덧칠을 지운다.",
    );
    // 능력치를 모르는 도감에서는 어느 능력치에서 나오는 배율인지 함께 말한다.
    expect(skillDescription(def.ultimate)).toContain("주문력의 60%");
    // 다섯 겹을 다 칠해야 렉시아의 단일 대상 궁극기와 같은 300%다 — 전장 전체를 때리는
    // 지원가가 최상위 딜러의 한 방을 넘지 않게 하는 상한이라 함께 고정한다.
    const rex = RELICS.find((relic) => relic.id === "rex")!;
    expect(def.ultimate.power! * 5).toBeLessThanOrEqual(rex.ultimate.power!);
  });

  it("의 패시브와 폭주는 회복 대상과 덧칠의 주인을 분명히 말한다", () => {
    const def = meron();
    // 회복은 팀 힐이 아니라 때린 본인의 몫이다.
    expect(passiveDescription(def.passive, def.stats.atk)).toBe(
      "모든 아군이 [[overpaint|덧칠]]된 적을 맞히면 그 피해의 10%만큼 자신의 체력을 회복한다. 표적의 [[overpaint|덧칠]]이 최대로 쌓이면 다른 적으로 표적을 옮긴다.",
    );
    expect(ferocityTraitDescription(def.ferocityTrait)).toBe(
      "폭주 중 모든 아군의 [[basic-attack|기본 공격]]이 [[overpaint|덧칠]]을 함께 쌓는다.",
    );
  });

  it("의 덧칠 키워드는 실제 전투 계약과 같은 상한·시간·증가율을 말한다", () => {
    const effect = meron().basic.statusEffects!.find((status) => status.kind === "overpaint")!;
    if (effect.kind !== "overpaint") throw new Error("덧칠 효과가 아니다");
    const keyword = KEYWORDS.find((entry) => entry.id === "overpaint")!;
    // 수치를 태그가 말하기로 했으므로, 데이터와 갈리면 플레이어가 읽는 유일한 설명이 틀린다.
    expect(keyword.description).toContain(`${effect.damageTakenPercent}%`);
    expect(keyword.description).toContain(`최대 ${effect.maxStacks}겹`);
    expect(keyword.description).toContain(`${effect.seconds}초`);
  });

  it("의 궁극기 라벨은 겹당 값이 아니라 다 칠했을 때의 최대 피해를 말한다", () => {
    const def = meron();
    const effect = def.basic.statusEffects!.find((status) => status.kind === "overpaint")!;
    if (effect.kind !== "overpaint") throw new Error("덧칠 효과가 아니다");
    const perStack = Math.round(def.stats.ap * def.ultimate.power! / 100);
    const keyword = overpaintDetonationDamageKeyword(perStack, effect.maxStacks)!;
    // 겹당 수치를 다른 스킬과 같은 자리에 세우면 이 궁극기만 혼자 훨씬 약해 보인다.
    expect(keyword.term).toBe(String(perStack * effect.maxStacks));
    expect(keyword.description).toContain(`${effect.maxStacks}겹`);
    // 겹이 없을 수도 있는 값이라 상한을 모르면 라벨을 만들지 않는다.
    expect(overpaintDetonationDamageKeyword(perStack, undefined)).toBeUndefined();
  });
});

describe("파치 스킬 표시 계약", () => {
  const pachi = () => RELICS.find((def) => def.id === "pachi")!;

  it("의 패시브는 상한 하나만 말한다", () => {
    const def = pachi();
    // 아무리 센 공격이든 세 대는 버틴다는 것이 이 패시브의 전부다.
    expect(passiveDescription(def.passive, def.stats.atk)).toBe(
      "한 번에 받는 피해가 최대 체력의 40%를 넘지 않는다.",
    );
  });

  it("의 기본 공격은 네 번째 타격에만 걸린다는 사실을 본문이 말한다", () => {
    const def = pachi();
    expect(def.basic.statusEffectEvery).toBe(4);
    // 뇌진탕의 수치와 치명타 배증은 태그가 말하므로 본문이 되풀이하지 않는다.
    // 기절은 뇌진탕과 같은 타격에 함께 걸리므로 문장을 끊지 않고 이어 붙인다.
    expect(skillDescription(def.basic, { damage: 118 })).toBe(
      "적 한 명에게 [[damage-value|118]]의 [[physical-damage|물리 피해]]를 준다. 매 4번째 공격마다 [[concussion|뇌진탕]]을 입히고 1초 동안 [[stun|기절]]시킨다.",
    );
  });

  it("의 궁극기는 지나간 길을 대상으로 말한다", () => {
    const def = pachi();
    expect(def.ultimate).toMatchObject({ targeting: "chargeLine", power: 200, cost: 250 });
    expect(skillDescription(def.ultimate, { damage: 264 })).toBe(
      "[[charge|돌진]]해 뚫고 지나간 길의 모든 적에게 [[damage-value|264]]의 [[physical-damage|물리 피해]]를 주고 [[concussion|뇌진탕]]을 입히고 2초 동안 [[stun|기절]]시킨다.",
    );
  });

  it("의 폭주는 날아가는 시간도 튕기는 횟수도 적지 않는다", () => {
    const trait = pachi().ferocityTrait;
    if (trait.effectId !== "knockbackSlam") throw new Error("파치의 폭주 특성이 아니다");
    // 둘 다 플레이어의 다음 조작을 바꾸지 않는다 — 날아가는 그림이 곧 그 답이고, 무엇을 못
    // 하는지는 태그가 말한다.
    expect(ferocityTraitDescription(trait)).toBe(
      "[[concussion|뇌진탕]]이 확정 치명타가 되고, 그 적을 [[knockback|날려버린다]]. 날려버린 뒤에는 가장 가까운 적을 표적으로 다시 지정한다.",
    );
  });

  it("의 새 규칙어는 전부 전역 키워드로 정의된다", () => {
    // 본문이 태그로만 가리키므로, 하나라도 빠지면 플레이어가 뜻을 읽을 곳이 없어진다.
    for (const id of ["concussion", "knockback", "charge"]) {
      expect(KEYWORDS.some((keyword) => keyword.id === id), id).toBe(true);
    }
    const effect = pachi().basic.statusEffects!.find((status) => status.kind === "concussion")!;
    if (effect.kind !== "concussion") throw new Error("뇌진탕 효과가 아니다");
    const keyword = KEYWORDS.find((entry) => entry.id === "concussion")!;
    // 수치를 태그가 말하기로 했으므로 데이터와 갈리면 유일한 설명이 틀린다.
    expect(keyword.description).toContain(`최대 체력의 ${effect.maxHpPercent}%`);
    expect(keyword.description).toContain(`치명타 발동 시 ${effect.criticalMaxHpPercent}%`);
  });
});

describe("마키 스킬 표시 계약", () => {
  const maki = () => RELICS.find((def) => def.id === "maki")!;

  it("의 패시브는 재사용 조건 둘을 함께 말한다", () => {
    const def = maki();
    // 처치와 시간 중 하나만 적으면 플레이어가 나머지 하나를 영영 모른다.
    expect(passiveDescription(def.passive, def.stats.atk)).toBe(
      "전투를 시작할 때 현재 체력이 가장 낮은 적을 표적으로 삼고 그 자리로 [[teleport|순간이동]]한다. 적을 처치하면 즉시, 그 밖에는 10초마다 다시 고른다.",
    );
  });

  it("의 기본 공격은 손질과 출혈을 각각 제 문장으로 말한다", () => {
    const def = maki();
    expect(def.basic.statusEffects).toEqual([
      { kind: "butcher", maxStacks: 3, burstPower: 120 },
      { kind: "bleed", seconds: 3, maxHpPercentPerSecond: 2 },
    ]);
    // 겹 상한과 터지는 위력은 태그가 말하므로 본문이 되풀이하지 않는다.
    expect(skillDescription(def.basic, { damage: 209 })).toBe(
      "적 한 명에게 [[damage-value|209]]의 [[physical-damage|물리 피해]]를 주고 [[butcher|손질]]을 한 겹 쌓는다. 3초 동안 [[bleed|출혈]]시켜 매초 최대 체력의 2%를 잃게 한다.",
    );
  });

  it("의 궁극기는 처치했을 때만 돌려받는다는 조건을 말한다", () => {
    const def = maki();
    // 위력·코스트·환급량은 데이터가 갖는다. 본문이 그 값을 그대로 말하는지만 확인한다.
    expect(def.ultimate).toMatchObject({ targeting: "single" });
    expect(skillDescription(def.ultimate, { damage: 760 })).toBe(
      `적 한 명에게 [[damage-value|760]]의 [[physical-damage|물리 피해]]를 준다. 이 공격으로 처치하면 궁극기 게이지를 ${def.ultimate.energyRefundOnKill} 돌려받는다.`,
    );
  });

  it("의 손질 키워드는 실제 전투 계약과 같은 상한·위력을 말한다", () => {
    const effect = maki().basic.statusEffects!.find((status) => status.kind === "butcher")!;
    if (effect.kind !== "butcher") throw new Error("손질 효과가 아니다");
    const keyword = KEYWORDS.find((entry) => entry.id === "butcher")!;
    // 수치를 태그가 말하기로 했으므로 데이터와 갈리면 유일한 설명이 틀린다.
    expect(keyword.description).toContain(`${effect.maxStacks}겹이 쌓이면`);
    expect(keyword.description).toContain(`${effect.burstPower}%`);
    expect(effect.maxStacks).toBe(3);
  });
});
