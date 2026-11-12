import { afterAll, describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { parseKeywordText } from "../../src/data/keywords";
import { loadTextCatalog, setTextLanguage } from "../../src/i18n";
import { LANGUAGE_IDS } from "../../src/core/language";
import { buildSkillTags, skillTagsFromDef, type SkillTagTone } from "../../src/ui/skillTags";

afterAll(() => setTextLanguage("ko"));

const ORDER: readonly SkillTagTone[][] = [
  ["physical", "magical", "fixed", "heal", "buff"],
  ["scope"],
  ["timing"],
  ["control", "debuff", "mark", "shield", "buff", "heal"],
  ["value"],
];
// 첫 칸 뒤에 덧붙는 피해 종류 칩(얼굴과 다른 피해)도 첫 갈래다.
const group = (tone: SkillTagTone, index: number) => index === 0 || ["physical", "magical", "fixed"].includes(tone) ? 0 : ORDER.findIndex((tones, g) => g > 0 && tones.includes(tone));

describe("스킬 요약 칩 규격", () => {
  it("모든 개체의 네 칸이 종류 → 범위 → 시간 → 거는 효과 → 수치 순서로 선다", () => {
    for (const def of RELICS) for (const slot of ["passive", "basic", "ultimate"] as const) {
      const tags = skillTagsFromDef(def[slot], slot, "피해량 [[damage-value|100]]");
      const where = `${def.id}/${slot}`;
      expect(ORDER[0], where).toContain(tags[0].tone);
      const groups = tags.map((tag, index) => group(tag.tone, index));
      expect(groups, where).toEqual([...groups].sort((a, b) => a - b));
      expect(tags.filter((tag) => tag.tone === "timing"), where).toHaveLength(1);
      // 평타·궁극기는 반드시 범위를 말한다.
      if (slot !== "passive") expect(tags.some((tag) => tag.tone === "scope"), where).toBe(true);
      expect(new Set(tags.map((tag) => tag.text)).size, where).toBe(tags.length);
    }
  });

  it("인원으로 끊는 범위는 대상 수를, 대상을 늘리는 폭주는 늘어나는 몫을 칩으로 말한다", () => {
    setTextLanguage("ko");
    const yuti = RELICS.find((def) => def.id === "yuti")!;
    const basic = skillTagsFromDef(yuti.basic, "basic").map((tag) => tag.text);
    expect(basic).toContain("다중");
    expect(basic).toContain("대상 2명");
    expect(basic.indexOf("대상 2명")).toBe(basic.indexOf("다중") + 1);
    const ferocity = buildSkillTags({ slot: "ferocity", effectType: "buff", extraTargets: 1 });
    expect(ferocity.find((tag) => tag.text === "대상 +1")?.tone).toBe("buff");
    // 반경으로만 끊는 광역은 인원을 말하지 않는다.
    expect(buildSkillTags({ slot: "basic", effectType: "physical", targeting: "battlefieldEnemies" }).some((tag) => tag.text.startsWith("대상 "))).toBe(false);
  });

  it("얼굴과 다른 피해를 함께 내면 그 피해 종류가 첫 칸 바로 뒤에 선다", () => {
    const def = (id: string) => RELICS.find((relic) => relic.id === id)!;
    const head = (id: string, slot: "passive" | "basic" | "ultimate") => skillTagsFromDef(def(id)[slot], slot).map((tag) => tag.text).slice(0, 2);
    expect(head("kento", "passive")).toEqual(["강화", "마법 피해"]);
    expect(head("anka", "passive")).toEqual(["강화", "마법 피해"]);
    // 동상은 지속 피해라 고정 피해 칩을 달지 않는다
    expect(head("yuti", "basic")[1]).not.toBe("고정 피해");
    expect(head("noa", "ultimate")[0]).toBe("고정 피해");
    expect(head("rex", "basic")).toEqual(["물리 피해", "단일"]);
  });

  it("상태 효과는 갈래 색으로 갈리고 시간을 함께 말한다", () => {
    const torika = RELICS.find((def) => def.id === "torika")!;
    const tags = skillTagsFromDef(torika.ultimate, "ultimate");
    expect(tags.map((tag) => tag.text)).toEqual(expect.arrayContaining(["[[stun|기절]] 2초", "주위 광역"]));
    expect(tags.find((tag) => tag.text.startsWith("[[stun"))?.tone).toBe("control");
  });

  it("시간 갈래: 패시브는 상시, 폭주는 폭주 중, 지속 시간이 있으면 지속 N초", () => {
    expect(buildSkillTags({ slot: "passive", effectType: "buff" }).map((tag) => tag.text)).toContain("상시");
    expect(buildSkillTags({ slot: "ferocity", effectType: "buff" }).map((tag) => tag.text)).toContain("폭주 중");
    expect(buildSkillTags({ slot: "ultimate", effectType: "buff", durationSeconds: 6 }).map((tag) => tag.text)).toContain("지속 6초");
    expect(buildSkillTags({ slot: "basic", effectType: "physical" }).map((tag) => tag.text)).toEqual(["물리 피해", "단일", "즉발"]);
  });

  it("연발 궁극기(테쿠)는 한 명이 아니라 여럿에게 나눠 맞히는 총 발 수를 말한다", () => {
    setTextLanguage("ko");
    const teku = RELICS.find((def) => def.id === "teku")!;
    const tags = skillTagsFromDef(teku.ultimate, "ultimate").map((tag) => tag.text);
    expect(tags).toContain("다중");
    expect(tags).toContain("총 5발");
    expect(tags).not.toContain("단일");
  });

  it.each(LANGUAGE_IDS)("%s: 모든 칩 글이 채워지고 규칙어가 사전에서 열린다", async (locale) => {
    await loadTextCatalog(locale); setTextLanguage(locale);
    const failures: string[] = [];
    for (const def of RELICS) for (const slot of ["passive", "basic", "ultimate"] as const) {
      for (const tag of skillTagsFromDef(def[slot], slot)) {
        if (/undefined|NaN|\{[A-Za-z]+\}|skill\.tag\./.test(tag.text)) failures.push(`${def.id}/${slot}: ${tag.text}`);
        for (const match of tag.text.matchAll(/\[\[[^\]]+\]\]/g)) {
          if (!parseKeywordText(match[0])[0]?.keyword) failures.push(`${def.id}/${slot}: ${match[0]}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
