import { describe, expect, it } from "vitest";
import PREPARE_ICONS from "../../scripts/prepare_icons.py?raw";
import { RELICS } from "../../src/data/relics";
import { ELEMENT_TINT, ROLE_TINT, SKILL_ART_ASSETS, SKILL_ART_SLOTS, skillArtFor, skillArtKey, skillArtTint } from "../../src/ui/skillArt";
import { ferocityTraitDescription, recoveryLabel, statusEffectLabel, targetingLabel } from "../../src/ui/skillPresentation";

/** 구워 둔 스킬 일러스트. 코드가 가리키는 파일이 실제로 있는지 확인한다. */
const ART_FILES = import.meta.glob("../../public/sprites/skills/*/*.webp");

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
    expect(ferocityTraitDescription(torika.ferocityTrait, torika.stats.def)).toBe("공격 속도가 20% 증가한다. 기본 공격이 대상 주위의 모든 적에게 적중해 방어력의 15%([[def|19]])만큼 추가 물리 피해를 입히고 [[stagger|경직]]시킨다.");
    // 설명의 환산 피해도 현재 방어력을 다시 읽으므로 레벨·룬으로 능력치가 변하면 같이 변한다.
    expect(ferocityTraitDescription(torika.ferocityTrait, torika.stats.def * 2)).toContain("[[def|38]]");
    // 설명 원문에는 구조화된 수치나 개발 좌표를 복제하지 않아 값이 갈라질 여지를 없앤다.
    expect(torika.ultimate.desc).not.toMatch(/220px|2초/);
  });
});
