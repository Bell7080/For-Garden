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
import { plumeBurstKeyword, plumeKeyword, prickleKeyword, prickleReflectKeyword } from "../../src/ui/skillPresentation";

describe("개체 전용 쪽지의 현재 수치 태그", () => {
  it("유티 서리깃 쪽지는 공격력으로 환산한 폭발 피해를 태그로 단다", () => {
    const yuti = RELICS.find((relic) => relic.id === "yuti")!;
    const burst = plumeBurstKeyword(yuti, 500)!;
    expect(burst.term).toBe("600");
    const plume = plumeKeyword(yuti, 500)!;
    const tagged = parseKeywordText(plume.description, [burst]).find((segment) => segment.keyword?.id === "plume-burst");
    expect(tagged?.text).toBe("600");
    expect(plumeKeyword(yuti)!.description).not.toContain("plume-burst");
    expect(plumeBurstKeyword(yuti)).toBeUndefined();
  });

  it("켄토 까칠 쪽지는 주문력으로 환산한 겹당 반격 피해를 태그로 단다", () => {
    const kento = RELICS.find((relic) => relic.passive.kind === "prickly")!;
    const percent = kento.passive.prickle!.reflectApPercentPerStack;
    const reflect = prickleReflectKeyword(kento.passive, 400)!;
    expect(reflect.term).toBe(String(Math.round(400 * percent / 100)));
    expect(prickleKeyword(kento.passive, 400)!.description).toContain("[[prickle-reflect|");
    expect(prickleKeyword(kento.passive)!.description).not.toContain("prickle-reflect");
  });
});
