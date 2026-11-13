import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { passiveDescription, skillDescription, breakthroughEffectText } from "../../src/ui/skillPresentation";

describe("플레샤 유성 태그", () => {
  const plesha = getRelic("plesha");

  it("유성 태그의 회복 비율이 패시브 계약과 같다", () => {
    const keyword = findKeyword("meteor");
    expect(keyword).toBeDefined();
    const percent = plesha.passive.starfall!.lowestAllyHealPercent;
    expect(keyword!.description).toContain(`${percent}%`);
  });

  it("패시브·궁극기·폭주·돌파 문구가 유성 태그를 건다", () => {
    expect(passiveDescription(plesha.passive)).toContain("[[meteor|");
    expect(skillDescription(plesha.ultimate)).toContain("[[meteor|");
    expect(plesha.ultimate.repeatStrike?.meteor).toBe(true);
    for (const slot of ["basic", "ultimate", "passive"] as const) {
      expect(breakthroughEffectText(plesha, slot)).toContain("[[meteor|");
    }
  });

  it("패시브 본문은 태그가 말하는 회복 비율을 되풀이하지 않는다", () => {
    expect(passiveDescription(plesha.passive)).not.toContain(`${plesha.passive.starfall!.lowestAllyHealPercent}%`);
  });
});
