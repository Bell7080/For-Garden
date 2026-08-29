import { describe, expect, it } from "vitest";
import ts from "typescript";
import PREPARE_ICONS from "../../scripts/prepare_icons.py?raw";
import { RELICS } from "../../src/data/relics";
import { ELEMENT_TINT, ROLE_TINT, SKILL_ART_ASSETS, SKILL_ART_SLOTS, skillArtFor, skillArtKey, skillArtTint } from "../../src/ui/skillArt";
import { allyHealPowerKeyword, canPreviewSkillDamage, damageHealingLabel, damageKeyword, ferocityTraitDescription, passiveDescription, passiveShieldKeyword, recoveryLabel, skillDescription, skillKeywordLayoutOptions, statusEffectLabel, targetingLabel } from "../../src/ui/skillPresentation";
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
    // 순수 회복 궁극기는 적 대상 네 종류와 분리된 전장 전체 아군 계약을 사용한다.
    for (const def of RELICS) expect(["single", "nearbyEnemies", "battlefieldEnemies", "battlefieldAllies", "targetedCircle"]).toContain(def.ultimate.targeting);
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
    // 설명 원문에는 구조화된 수치나 개발 좌표를 복제하지 않아 값이 갈라질 여지를 없앤다.
    expect(torika.ultimate.desc).not.toMatch(/220px|2초/);
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
    expect(mette.basic.desc).not.toContain("0.1초");
    expect(mette.basic.desc).toContain("[[stagger|경직]]");
  });
});

describe("도디 스킬 표시 계약", () => {
  it("은 궁극기의 아군 회복 %를 실제 주문력 수치로 환산한 태그로 만든다", () => {
    const dodo = RELICS.find((def) => def.id === "dodo")!;
    expect(allyHealPowerKeyword(dodo.ultimate.allyHealingPower!, 150)).toMatchObject({ id: "heal-value", term: "300" });
    expect(skillDescription(dodo.ultimate, 150)).toBe(
      "지정한 넓은 범위의 모든 적에게 [[magical-damage|마법 피해]]를 주고, 모든 생존 아군의 체력을 [[heal-value|300]]만큼 회복한다.",
    );
  });

  it("의 야성 발현은 배속 환산 괄호 없이 상승률만 말한다", () => {
    const dodo = RELICS.find((def) => def.id === "dodo")!;
    expect(ferocityTraitDescription(dodo.ferocityTrait)).toBe("공격 속도가 100% 증가한다.");
  });
});

describe("폰투스 스킬 표시 계약", () => {
  it("의 패시브는 매초 상승분을 수치로 명시한다(막연한 '상승'만 말하지 않는다)", () => {
    const pontus = RELICS.find((def) => def.id === "pontus")!;
    expect(passiveDescription(pontus.passive)).toBe(
      "매초 [[ap|주문력]]이 12 상승하고, [[missing-hp|잃은 체력]]에 비례해 받는 모든 피해가 최대 40% 감소한다.",
    );
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
    expect(ferocityTraitDescription(spino.ferocityTrait)).toContain("3초 동안 [[stealth|은신]]한다");
    expect(spino.passive).toMatchObject({ name: "전투의 환희", kind: "basicHitAttackSpeedStack", value: 3 });
    expect(passiveDescription(spino.passive)).toContain("[[attack-speed|공격 속도]]가 3 증가");
    expect(spino.basic).toMatchObject({ name: "악어턱 물어뜯기", power: 80, combo: { chancePercent: 40, hitCount: 2, missingHpHealingPercentPerHit: 10 } });
    expect(skillDescription(spino.basic)).toContain("40% 확률로 [[combo|연격]]하여 총 2회 적중");
    expect(skillDescription(spino.basic)).toContain("[[missing-hp|잃은 체력]]의 10%를 회복");
    expect(spino.ultimate).toMatchObject({ name: "범람의 포식자", power: 200, attackSpeedPower: 150, cost: 300, statusEffects: [{ kind: "stun", seconds: 3 }] });
    expect(skillDescription(spino.ultimate)).toContain("현재 [[attack-speed|공격 속도]]의 150%");
    expect(skillDescription(spino.ultimate)).toContain("[[stun|기절]]시킨다");
  });
});
