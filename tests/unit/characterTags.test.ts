import { afterAll, describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { loadTextCatalog, setTextLanguage, t, type TextKey } from "../../src/i18n";
import { LANGUAGE_IDS } from "../../src/core/language";
import { CHARACTER_TRAIT_LIMIT, CHARACTER_TRAIT_ORDER, characterTags, characterTraits } from "../../src/ui/characterTags";
import { ENEMY_INFO } from "../../src/ui/enemyInfoLayout";

afterAll(() => setTextLanguage("ko"));

const byId = (id: string) => {
  const def = RELICS.find((relic) => relic.id === id);
  if (!def) throw new Error(id);
  return def;
};

describe("정보창 해시태그", () => {
  it("모든 개체가 사거리 → 맡은 몫 → 공격 범위 → 특징(둘까지) 순서로 선다", () => {
    for (const def of RELICS) {
      const tags = characterTags(def);
      expect(tags[0].kind, def.id).toBe(def.reachTier);
      expect(["dealer", "tank", "support"], def.id).toContain(tags[1].kind);
      expect(["area", "single"], def.id).toContain(tags[2].kind);
      const traits = tags.slice(3).map((tag) => tag.kind);
      expect(traits.length, def.id).toBeLessThanOrEqual(CHARACTER_TRAIT_LIMIT);
      // 특징은 정해 둔 순서 그대로이고 같은 말이 두 번 서지 않는다.
      expect(traits, def.id).toEqual(characterTraits(def).slice(0, CHARACTER_TRAIT_LIMIT));
      expect(new Set(tags.map((tag) => tag.text)).size, def.id).toBe(tags.length);
    }
  });

  it("데이터가 말하는 특징을 그대로 읽는다", () => {
    expect(characterTraits(byId("dian"))).toContain("summon");
    expect(characterTraits(byId("dodo"))).toContain("heal");
    expect(characterTraits(byId("kento")).slice(0, 2)).toEqual(["taunt", "shield"]);
    expect(characterTraits(byId("stella"))).toContain("teamBuff");
    expect(characterTraits(byId("noa"))).toContain("stealth");
    expect(characterTraits(byId("rex"))).toContain("dot");
    expect(characterTags(byId("irna")).map((tag) => tag.kind).slice(0, 3)).toEqual(["ranged", "dealer", "single"]);
  });

  it("특징 순서표는 모든 특징을 한 번씩 갖는다", () => {
    expect(new Set(CHARACTER_TRAIT_ORDER).size).toBe(CHARACTER_TRAIT_ORDER.length);
  });

  it("모든 언어가 태그 낱말을 갖고 공백 없이 하나의 낱말로 선다", async () => {
    const kinds = ["melee", "mid", "ranged", "dealer", "tank", "support", "area", "single", ...CHARACTER_TRAIT_ORDER];
    for (const language of LANGUAGE_IDS) {
      await loadTextCatalog(language);
      setTextLanguage(language);
      for (const kind of kinds) {
        const key = `info.tag.${kind}` as TextKey;
        const text = t(key);
        expect(text, `${language}/${kind}`).not.toBe(key);
        expect(text, `${language}/${kind}`).not.toMatch(/\s|#/);
      }
    }
  }, 30_000);

  it("적 창의 태그 줄은 이름과 개체번호 사이, 오른쪽 기둥 앞에 든다", () => {
    const { tags, nameY, numberY, left, column } = ENEMY_INFO;
    const half = (tags.size * 1.6) / 2;
    expect(tags.y - half).toBeGreaterThan(nameY + 42);
    expect(tags.y + half).toBeLessThan(numberY - 12);
    expect(left + 2 + tags.maxWidth).toBeLessThan(column.x - column.width / 2);
  });
});
