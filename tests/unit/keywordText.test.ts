import { describe, expect, it } from "vitest";
import { splitEmphasisRuns } from "../../src/core/keywordText";

describe("설명문 수치 강조 조각", () => {
  it("는 숫자와 %만 강조하고 조사·단위는 남긴다", () => {
    expect(splitEmphasisRuns("12%만큼")).toEqual([{ text: "12%", accent: true }, { text: "만큼", accent: false }]);
    expect(splitEmphasisRuns("3초에 ")).toEqual([{ text: "3", accent: true }, { text: "초에 ", accent: false }]);
    expect(splitEmphasisRuns("(+120%)")).toEqual([
      { text: "(", accent: false }, { text: "+120%", accent: true }, { text: ")", accent: false },
    ]);
  });

  it("는 소수점과 천 단위 쉼표를 한 수치로 묶고 이어 붙이면 원문이 된다", () => {
    const word = "1,200.5%씩 ";
    const runs = splitEmphasisRuns(word);
    expect(runs[0]).toEqual({ text: "1,200.5%", accent: true });
    expect(runs.map((run) => run.text).join("")).toBe(word);
  });

  it("는 숫자 없는 낱말을 한 조각 일반 글로 둔다", () => {
    expect(splitEmphasisRuns("공격력의 ")).toEqual([{ text: "공격력의 ", accent: false }]);
  });
});

import { RELICS } from "../../src/data/relics";
import { parseKeywordText } from "../../src/data/keywords";
import { resolveValueTag, valueTag } from "../../src/data/valueTags";
import {
  breakthroughEffectText, frostbiteKeyword, passiveDescription, plumeKeyword, prickleKeyword, shimmerBurstKeywords, skillDescription,
} from "../../src/ui/skillPresentation";

describe("능력치 환산 수치 태그", () => {
  it("는 근거를 ID에 싣고 다녀 문맥 사전 없이도 쪽지가 열린다", () => {
    const tag = valueTag("shield", "ap", 30, 420);
    expect(tag).toBe("[[v-shield-ap-30-420|126]]");
    const segment = parseKeywordText(`막 ${tag}`).find((entry) => entry.keyword !== undefined);
    expect(segment?.text).toBe("126");
    expect(segment?.keyword?.description).toContain("30%");
    expect(segment?.keyword?.description).toContain("420");
  });

  it("는 소수점 비율을 p로 실어 되읽는다", () => {
    const tag = valueTag("heal", "hp", 0.3, 2000);
    expect(tag).toBe("[[v-heal-hp-0p3-2000|6]]");
    const def = resolveValueTag("v-heal-hp-0p3-2000")!;
    expect(def.term).toBe("6");
    expect(def.description).toContain("0.3%");
    expect(resolveValueTag("v-heal-mp-10-100")).toBeUndefined();
    expect(resolveValueTag("shield-value")).toBeUndefined();
  });
});

describe("개체 전용 쪽지의 현재 수치 태그", () => {
  it("유티 동상 쪽지는 공격력으로 환산한 피해를 수치 태그로 달고, 능력치를 모르면 비율로 말한다", () => {
    const yuti = RELICS.find((relic) => relic.id === "yuti")!;
    const frost = frostbiteKeyword(yuti, 500)!;
    expect(frost.description).toMatch(/\[\[v-damage-atk-[\dp]+-500\|600\]\]/);
    expect(frostbiteKeyword(yuti)!.description).not.toContain("[[v-");
    const plume = plumeKeyword(yuti, 500)!;
    expect(parseKeywordText(plume.description, [frost]).some((segment) => segment.keyword?.id === "yuti-frostbite")).toBe(true);
    expect(plume.description).not.toContain("%");
  });

  it("켄토 까칠 쪽지는 주문력으로 환산한 겹당 반격 피해를 수치 태그로 단다", () => {
    const kento = RELICS.find((relic) => relic.passive.kind === "prickly")!;
    const percent = kento.passive.prickle!.reflectApPercentPerStack;
    const text = prickleKeyword(kento.passive, { ap: 400, maxHp: 1000 })!.description;
    expect(text).toContain(`|${Math.round(400 * percent / 100)}]]`);
    expect(text).toContain("[[v-damage-ap-");
    expect(prickleKeyword(kento.passive)!.description).not.toContain("[[v-");
  });
});

describe("돌파·패시브의 수치 태그", () => {
  const slots = ["basic", "ultimate", "passive"] as const;
  it("능력치 비례 돌파 효과는 능력치가 있을 때만 수치 태그가 서고, 태그는 제 근거로 풀린다", () => {
    let checked = 0;
    for (const relic of RELICS) {
      for (const slot of slots) {
        const text = breakthroughEffectText(relic, slot, relic.stats);
        const tags = [...(text ?? "").matchAll(/\[\[(v-[^|\]]+)\|(\d+)\]\]/g)];
        if (tags.length === 0) continue;
        checked++;
        for (const [, id, shown] of tags) expect(resolveValueTag(id)?.term, `${relic.id} ${slot}`).toBe(shown);
        expect(breakthroughEffectText(relic, slot)).not.toContain("[[v-");
      }
    }
    expect(checked).toBeGreaterThan(5);
  });

  it("능력치 비례 패시브는 능력치가 있을 때만 수치 태그가 선다", () => {
    const own = { ap: 400, maxHp: 1000 };
    let checked = 0;
    for (const relic of RELICS) {
      const text = passiveDescription(relic.passive, relic.stats.atk, undefined, own);
      const tags = [...text.matchAll(/\[\[(v-[^|\]]+)\|(\d+)\]\]/g)];
      if (tags.length === 0) continue;
      checked++;
      for (const [, id, shown] of tags) expect(resolveValueTag(id)?.term).toBe(shown);
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });
});

describe("티아 첨벙! 태그", () => {
  it("일반 공격 본문은 첨벙!을 가리키기만 하고, 수치는 그 태그가 환산해 갖는다", () => {
    const skill = RELICS.flatMap((relic) => [relic.basic, relic.ultimate]).find((entry) => "shimmerBurst" in entry && entry.shimmerBurst !== undefined)!;
    const stats = { ap: 400, maxHp: 1000 };
    const text = skillDescription(skill, stats);
    const keywords = shimmerBurstKeywords(skill, stats);
    expect(keywords.map((keyword) => keyword.id)).toEqual(["tia-splash"]);
    const [splash] = keywords;
    expect(text).toContain(`[[tia-splash|${splash.term}]]`);
    expect(text).not.toContain("50%");
    expect(splash.description).toContain("[[v-damage-ap-");
    expect(shimmerBurstKeywords(skill)[0].description).not.toContain("[[v-");
  });
});
