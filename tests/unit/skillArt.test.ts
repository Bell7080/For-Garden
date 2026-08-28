import { describe, expect, it } from "vitest";
import ts from "typescript";
import PREPARE_ICONS from "../../scripts/prepare_icons.py?raw";
import { RELICS } from "../../src/data/relics";
import { ELEMENT_TINT, ROLE_TINT, SKILL_ART_ASSETS, SKILL_ART_SLOTS, skillArtFor, skillArtKey, skillArtTint } from "../../src/ui/skillArt";
import { damageHealingLabel, damageKeyword, ferocityTraitDescription, passiveDescription, recoveryLabel, skillKeywordLayoutOptions, statusEffectLabel, targetingLabel } from "../../src/ui/skillPresentation";
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
    for (const def of RELICS) expect(["single", "nearbyEnemies", "battlefieldEnemies"]).toContain(def.ultimate.targeting);
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
    expect(ferocityTraitDescription(torika.ferocityTrait, torika.stats.def)).toBe("공격 속도가 20% 증가한다. 기본 공격이 대상 주위의 모든 적에게 적중해 [[damage-value|19]]만큼 추가 물리 피해를 입히고 [[stagger|경직]]시킨다.");
    // 설명의 환산 피해도 현재 방어력을 다시 읽으므로 레벨·룬으로 능력치가 변하면 같이 변한다.
    expect(ferocityTraitDescription(torika.ferocityTrait, torika.stats.def * 2)).toContain("[[damage-value|38]]");
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
    expect(passiveDescription(rex.passive)).toContain("각각 25%, 25%, 25%, 25%");
    expect(statusEffectLabel(rex.basic.statusEffects?.[0])).toBe("[[bleed|출혈]] 3초 · 매초 최대 체력 2%");
    expect(targetingLabel(rex.ultimate.targeting)).toBe("적 한 명");
    expect(damageHealingLabel(rex.ultimate.damageHealingPercent)).toBe("실제 피해의 50% 회복");
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
    expect(ferocityTraitDescription(spino.ferocityTrait)).toContain("3초 동안 단일 대상으로 지정되지 않는다");
    expect(spino.passive).toMatchObject({ name: "전투의 환희", kind: "basicHitAttackSpeedStack", value: 3 });
    expect(passiveDescription(spino.passive)).toContain("공격 속도가 3 증가");
    expect(spino.basic).toMatchObject({ name: "악어턱 물어뜯기", power: 80, combo: { chancePercent: 40, hitCount: 2, missingHpHealingPercentPerHit: 10 } });
    expect(spino.ultimate).toMatchObject({ name: "범람의 포식자", power: 200, attackSpeedPower: 150, cost: 300, statusEffects: [{ kind: "stun", seconds: 3 }] });
    expect(spino.ultimate.desc).toContain("현재 공격 속도의 150%");
  });
});
