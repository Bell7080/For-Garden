import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { BLEED } from "../../src/core/skirmish";
import { KEYWORDS } from "../../src/data/keywords";

/**
 * 출혈·깊은 출혈의 수치는 태그가 말하고, 스킬·돌파 본문은 「부여한다」까지만 적는다.
 * 그 약속은 **개체의 출혈이 공용 값(`BLEED`)과 같을 때만** 참이다 — 다른 값이 섞이면 본문이 줄인
 * 수치를 태그가 대신 거짓으로 말하게 되므로 여기서 막는다.
 */
function collect(node: unknown, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((item) => collect(item, found));
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (record.kind === "bleed" || record.kind === "deepBleed") found.push(record);
    Object.values(record).forEach((value) => collect(value, found));
  }
  return found;
}

describe("출혈 태그 계약", () => {
  const effects = RELICS.flatMap((def) => collect(def).map((effect) => ({ id: def.id, effect })));

  it("개체가 거는 출혈은 공용 매초 비율을 쓴다(시간이 다르면 본문이 시간을 적는다)", () => {
    const bleeds = effects.filter(({ effect }) => effect.kind === "bleed" && "maxHpPercentPerSecond" in effect);
    expect(bleeds.length).toBeGreaterThan(0);
    for (const { id, effect } of bleeds) {
      expect(effect.maxHpPercentPerSecond, id).toBe(BLEED.percentPerSecond);
      // 회복 감소가 없는 평범한 출혈은 시간도 태그 값이어야 한다 — 그래야 「출혈을 부여한다」 한 마디로 끝난다.
      if (!effect.healingReceivedReductionPercent && !effect.deepenOnRepeat) expect(effect.seconds, id).toBe(BLEED.seconds);
      if (effect.deepenOnRepeat || effect.deep) expect(effect.seconds, id).toBe(BLEED.seconds);
    }
  });

  it("수쿠스이노의 네 번째 턱은 처음부터 깊은 출혈이다", () => {
    const deep = effects.filter(({ id, effect }) => id === "sukusuino" && effect.kind === "bleed");
    expect(deep.length).toBeGreaterThan(0);
    for (const { effect } of deep) expect(effect.deep).toBe(true);
  });

  it("깊은 출혈은 개체마다 같은 배율이라 태그가 매초 비율을 말한다", () => {
    const deep = effects.flatMap(({ id, effect }) => {
      if (effect.kind === "deepBleed") return [{ id, multiplier: effect.bleedMultiplier }];
      const repeat = effect.deepenOnRepeat as { multiplier: number } | undefined;
      return repeat ? [{ id, multiplier: repeat.multiplier }] : [];
    });
    expect(deep.map(({ id }) => id).sort()).toEqual(expect.arrayContaining(["rex"]));
    for (const { id, multiplier } of deep) expect(multiplier, id).toBe(BLEED.deepMultiplier);
    const keyword = KEYWORDS.find((entry) => entry.id === "deep-bleed")!;
    expect(keyword.description).toContain(`${BLEED.percentPerSecond * BLEED.deepMultiplier}%`);
    expect(keyword.description).toContain(`${BLEED.seconds}초`);
  });
});
