import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import type { BreakthroughSlot } from "../../src/core/relicProgression";
import { t } from "../../src/i18n";
import { BREAKTHROUGH_TAG_KINDS, breakthroughTags, newBreakthroughTags } from "../../src/ui/breakthroughTags";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";
import { skillTagsFromDef, type SkillTag } from "../../src/ui/skillTags";

const SLOTS: readonly BreakthroughSlot[] = ["passive", "basic", "ultimate", "ferocity"];
const byId = (id: string) => {
  const def = RELICS.find((relic) => relic.id === id);
  if (!def) throw new Error(id);
  return def;
};
const texts = (tags: readonly SkillTag[]) => tags.map((tag) => tag.text);

/** 칩이 가리키는 규칙어 ID. 피해 종류 칩은 규칙어 대신 문구로 서므로 그 문구를 ID로 옮긴다. */
function tagIds(tags: readonly SkillTag[]): Set<string> {
  const ids = new Set<string>();
  for (const tag of tags) {
    for (const match of tag.text.matchAll(/\[\[([a-z-]+)\|/g)) ids.add(match[1]);
    for (const kind of ["physical", "magical", "fixed"] as const) {
      if (tag.text === t(`skill.effect.${kind}`)) ids.add(`${kind}-damage`);
    }
  }
  return ids;
}

/** 돌파 문장에 나오면 칩으로도 서야 하는 규칙어 — 거는 상태·내는 피해 종류·주는 막. */
const VOCAB = new Set([
  "stun", "stagger", "taunt", "stealth", "shield", "chill", "tailwind", "intimidation", "concussion", "overpaint", "curse",
  "reagent", "bleed", "butcher", "drowsy", "pressure", "pull", "knockback", "resonance", "poison", "frozen",
  "physical-damage", "magical-damage", "fixed-damage",
]);

/**
 * 문장에 나와도 돌파가 **거는 것이 아니라 조건·대상**인 자리(「출혈이 걸린 적에게」·「보호막을 두른 아군」).
 * 새 돌파가 여기 들어가야 한다면 정말 조건인지 먼저 읽는다.
 */
const CONDITION_ONLY: Readonly<Record<string, readonly string[]>> = {
  "stella.passive": ["stealth"],
  "stella.basic": ["tailwind"],
  "mosana.ferocity": ["stun"], // 「기절이나 밀림은 없다」
  "ark.passive": ["intimidation"],
  "yuti.passive": ["stealth"],
  "meron.passive": ["overpaint"],
  "maki.ultimate": ["bleed"],
  "keris.passive": ["curse"],
  "delopi.passive": ["poison"],
  "ella.ferocity": ["shield"], // 폭주가 이미 두르는 막의 양만 늘린다
  "ripa.ferocity": ["reagent"],
  "atra.passive": ["poison"],
  "mette.passive": ["shield"],
  "maddy.ultimate": ["frozen"],
  "terisa.passive": ["shield"],
  "terisa.basic": ["shield"],
  "taboa.ferocity": ["pull"],
};

describe("한계 돌파 칩", () => {
  it("표의 모든 종류가 실제 돌파 효과로 쓰인다", () => {
    const used = new Set(RELICS.flatMap((def) => SLOTS.map((slot) => def.breakthroughEffects?.[slot]?.kind)));
    expect(BREAKTHROUGH_TAG_KINDS.filter((kind) => !used.has(kind as never))).toEqual([]);
  });

  it("돌파 문장이 거는 상태·피해 종류·막은 칩으로도 선다", () => {
    const missing: string[] = [];
    for (const def of RELICS) {
      for (const slot of SLOTS) {
        if (def.breakthroughEffects?.[slot] === undefined) continue;
        const text = breakthroughEffectText(def, slot, def.stats) ?? "";
        const said = [...text.matchAll(/\[\[([a-z-]+)\|/g)].map((match) => match[1]).filter((id) => VOCAB.has(id));
        const base = slot === "ferocity" ? [] : skillTagsFromDef(def[slot], slot);
        const shown = tagIds([...breakthroughTags(def, slot), ...base]);
        const allowed = CONDITION_ONLY[`${def.id}.${slot}`] ?? [];
        for (const id of said) if (!shown.has(id) && !allowed.includes(id)) missing.push(`${def.id}.${slot}:${id}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("돌파가 얹는 것을 칩으로 말한다", () => {
    expect(texts(breakthroughTags(byId("noa"), "ultimate"))).toEqual([t("skill.tag.withSeconds", { name: "[[stun|기절]]", seconds: 0.8 })]);
    expect(tagIds(breakthroughTags(byId("carno"), "ferocity"))).toEqual(new Set(["physical-damage", "stun"]));
    expect(tagIds(breakthroughTags(byId("pachi"), "basic"))).toEqual(new Set(["physical-damage", "concussion"]));
    expect(tagIds(breakthroughTags(byId("torika"), "basic"))).toContain("taunt");
    expect(tagIds(breakthroughTags(byId("spino"), "passive"))).toEqual(new Set(["stealth"]));
    expect(tagIds(breakthroughTags(byId("nodonia"), "ultimate"))).toEqual(new Set(["fixed-damage"]));
    // 피해만 늘리는 돌파는 새 갈래가 없다.
    expect(breakthroughTags(byId("irna"), "basic")).toEqual([]);
  });

  it("기본 칩에 이미 선 것은 돌파 줄에서 뺀다", () => {
    const kento = byId("kento");
    const base = skillTagsFromDef(kento.ultimate, "ultimate");
    const added = newBreakthroughTags(breakthroughTags(kento, "ultimate"), base);
    for (const tag of added) expect(tagIds(base)).not.toContain([...tagIds([tag])][0]);
    // 같은 규칙어는 시간이 달라도 같은 칩이다.
    const taunt = (seconds: number): SkillTag => ({ tone: "control", glyph: "tag-control", text: t("skill.tag.withSeconds", { name: "[[taunt|도발]]", seconds }) });
    expect(newBreakthroughTags([taunt(2)], [taunt(5)])).toEqual([]);
  });
});
