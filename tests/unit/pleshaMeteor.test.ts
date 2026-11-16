import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { passiveDescription, skillDescription, breakthroughEffectText } from "../../src/ui/skillPresentation";

/*
 * 유성 구조(응태 결정 2026-11-16) — 「유성」 태그가 한 발의 피해를, 패시브가 그 피해로 드는 회복을,
 * 기본 공격이 몇 번째마다 떨어지는지를, 궁극기가 「피해 절반·회복 두 배」의 유성을 말한다.
 */
describe("플레샤 유성", () => {
  const plesha = getRelic("plesha");
  const meteor = plesha.passive.starfall!;
  const basicStarfall = "starfall" in plesha.basic ? plesha.basic.starfall : undefined;
  const repeat = plesha.ultimate.repeatStrike!;

  it("유성 태그는 패시브 계약의 피해를 말하고 회복은 말하지 않는다", () => {
    const keyword = findKeyword("meteor");
    expect(keyword).toBeDefined();
    expect(keyword!.description).toContain(`${meteor.power}%`);
    expect(keyword!.description).not.toContain(`${meteor.lowestAllyHealPercent}%`);
  });

  it("패시브 본문은 회복만 말한다", () => {
    const text = passiveDescription(plesha.passive);
    expect(text).toContain("[[meteor|");
    expect(text).toContain(`${meteor.lowestAllyHealPercent}%`);
    expect(text).not.toContain(`${basicStarfall!.every}번째`);
  });

  it("기본 공격 본문이 몇 번째마다 유성이 떨어지는지 말한다", () => {
    expect(basicStarfall).toBeDefined();
    expect(skillDescription(plesha.basic)).toContain("[[meteor|");
    expect(skillDescription(plesha.basic)).toContain(`${basicStarfall!.every}번째`);
  });

  it("궁극기 유성은 패시브 유성 위력의 절반이고 회복은 두 배다", () => {
    expect(repeat.meteor).toEqual({ powerPercent: 50, healMultiplier: 2 });
    expect(plesha.ultimate.power).toBe(meteor.power * repeat.meteor!.powerPercent / 100);
    const text = skillDescription(plesha.ultimate);
    expect(text).toContain("[[meteor|");
    expect(text).toContain(`${repeat.meteor!.powerPercent}%`);
    expect(text).toContain(`${repeat.meteor!.healMultiplier}배`);
  });

  it("폭주·돌파 문구가 유성 태그를 건다", () => {
    for (const slot of ["basic", "ultimate", "passive"] as const) {
      expect(breakthroughEffectText(plesha, slot)).toContain("[[meteor|");
    }
  });
});
