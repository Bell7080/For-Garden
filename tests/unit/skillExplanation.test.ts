import { describe, expect, it } from "vitest";
import { formatEffectDescription, skillDescriptionTop } from "../../src/ui/skillExplanation";
import { defenseGainKeywords, defenseGainSummary } from "../../src/ui/statGainKeywords";
import { getRelic } from "../../src/data/relics";
import { buildSummonKeywords } from "../../src/ui/summonKeywords";

describe("효과 설명의 가독성과 계산 근거", () => {
  it("효과를 문단으로 나누되 소수와 태그 내부·기존 줄바꿈은 보존한다", () => {
    const text = "1.5초 동안 [[guard|A. B]]를 얻는다. 20% 증가한다.";
    expect(formatEffectDescription(text)).toBe("• 1.5초 동안 [[guard|A. B]]를 얻는다.\n\n• 20% 증가한다.");
    expect(formatEffectDescription("1.5초간 [[guard|A. B]]를 얻는다. 효과가 끝나면 사라진다.")).toBe("• 1.5초간 [[guard|A. B]]를 얻는다.\n\n• 효과가 끝나면 사라진다.");
    expect(formatEffectDescription("공격한다。강화한다。")).toBe("• 공격한다。\n\n• 강화한다。");
    expect(formatEffectDescription("기준 100\n증가량 20")).toBe("기준 100\n증가량 20");
  });
  it("긴 요약을 본문과 구분선이 침범하지 않는다", () => {
    expect(skillDescriptionTop(32)).toBe(268);
    expect(skillDescriptionTop(200)).toBeGreaterThanOrEqual(156 + 200 + 36);
  });
  it("방어·저항의 서로 다른 기준값을 각각 계산하며 합계는 이 효과만 적용한 값이라고 명시한다", () => {
    const tags = defenseGainKeywords({ def: 120, res: 50 }, 25);
    expect(tags.map(t => t.term)).toEqual(["+30", "+13"]);
    expect(tags[0].description).toContain("120 × 25%");
    expect(tags[0].description).toContain("150");
    expect(tags[1].description).toContain("63");
    expect(defenseGainSummary({ def: 120, res: 50 }, 25)).toContain("[[stat-bonus-res|+13]]");
  });
  it("디안·모르페 소환수는 현재 주인 능력치의 계수와 일반·궁극·폭주를 모두 제공한다", () => {
    for (const id of ["dian", "morphe"]) {
      const owner = getRelic(id), stats = { ...owner.stats, atk: 200, ap: 300 };
      const tags = buildSummonKeywords(owner, stats);
      expect(tags).toHaveLength(owner.summons!.length);
      for (const tag of tags) {
        expect(tag.sections?.map(s => s.label)).toContain("폭주");
        expect(tag.sections?.map(s => s.text).join(" ")).not.toMatch(/NaN|undefined/);
        expect(tag.sections?.[0].text).toContain("%");
      }
    }
  });
});
