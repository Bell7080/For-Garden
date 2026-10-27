import { afterAll, describe, expect, it } from "vitest";
import { sourceFunction } from "../helpers/sourceFunction";
import * as presentation from "../../src/ui/skillPresentation";
import * as damage from "../../src/core/damage";
import * as statGain from "../../src/ui/statGainKeywords";
import { buildSummonKeywords } from "../../src/ui/summonKeywords";
import { RELICS } from "../../src/data/relics";
import { KEYWORDS, parseKeywordText } from "../../src/data/keywords";
import { t, loadTextCatalog, setTextLanguage } from "../../src/i18n";
import { ferocityMaxOf } from "../../src/core/ferocity";
import { breakthroughEnhances } from "../../src/core/relicProgression";
import { LANGUAGE_IDS } from "../../src/core/language";
import type { SkillInfoViewModel } from "../../src/ui/SkillPopup";

const dependencies = { ...presentation, ...damage, ...statGain, t, buildSummonKeywords, ferocityMaxOf,
  skillArtFor: () => undefined, skillArtTint: () => 0 };
const build = sourceFunction("src/ui/info.ts", "buildSkillViewModel", dependencies);
let captured: SkillInfoViewModel;
const frenzy = sourceFunction("src/ui/info.ts", "openFerocityTraitPopup", { ...dependencies,
  openSkillPopup: (_scene: unknown, _layer: unknown, _manager: unknown, model: SkillInfoViewModel) => { captured = model; },
});
afterAll(() => setTextLanguage("ko"));

describe("적·아군·소환수 스킬 태그 전수 검사", () => {
  it.each(LANGUAGE_IDS)("%s: 50종 × 돌파 0~4 × 패시브·일반·궁극·폭주의 모든 본문·수치·중첩 태그가 열린다", async locale => {
    await loadTextCatalog(locale); setTextLanguage(locale);
    const failures = new Set<string>();
    const check = (text: string | undefined, contexts: SkillInfoViewModel["contextualKeywords"], where: string) => {
      if (!text) return;
      if (/NaN|undefined|\{[A-Za-z]+\}/.test(text)) failures.add(`${where}: unresolved value ${text}`);
      for (const match of text.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) {
        if (!parseKeywordText(match[0], contexts)[0]?.keyword) failures.add(`${where}: missing ${match[1]}`);
      }
    };
    for (const def of RELICS) for (let breakthrough = 0; breakthrough <= 4; breakthrough++) {
      for (const slot of ["passive", "basic", "ultimate", "ferocity"] as const) {
        const breakthroughEffect = breakthroughEnhances(def, breakthrough, slot)
          ? presentation.breakthroughEffectText(def, slot, def.stats) : undefined;
        let model: SkillInfoViewModel;
        if (slot === "ferocity") { frenzy(null, null, null, def, undefined, { breakthroughEffect }); model = captured; }
        else model = build({ def, breakthrough, kindLabel: slot, skill: def[slot], slot, breakthroughEffect });
        const where = `${locale}/${def.id}/${slot}`;
        for (const text of [model.description, model.valueLabel, model.breakthroughEffect]) check(text, model.contextualKeywords, where);
        for (const keyword of model.contextualKeywords ?? []) {
          check(keyword.description, model.contextualKeywords, `${where}/${keyword.id}`);
          for (const section of keyword.sections ?? []) check(section.text, [...(section.contextualKeywords ?? []), ...(model.contextualKeywords ?? [])], `${where}/${keyword.id}`);
        }
      }
    }
    for (const keyword of KEYWORDS) check(keyword.description, undefined, `${locale}/global/${keyword.id}`);
    expect([...failures]).toEqual([]);
  });
});
