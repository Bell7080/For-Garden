import { describe, expect, it } from "vitest";
import { allowBurst, EFFECT_BUDGET, EFFECT_PRESETS, type EffectKind } from "../../src/ui/effectPresets";

const KINDS = Object.keys(EFFECT_PRESETS) as EffectKind[];

describe("이펙트 배치표", () => {
  it("모든 종류가 배치표와 간격 표를 함께 갖는다", () => {
    for (const kind of KINDS) {
      expect(EFFECT_PRESETS[kind]).toBeDefined();
      expect(EFFECT_BUDGET.minGapMs[kind]).toBeTypeOf("number");
    }
  });

  it("파편은 잔뜩 흩뿌리지 않고 한 자리 수로 끊는다", () => {
    for (const kind of KINDS) expect(EFFECT_PRESETS[kind].shards).toBeLessThanOrEqual(9);
  });

  it("아래로 쏟아지는 중력을 쓰지 않는다", () => {
    // 위에서 내려다보는 난전이라 파편이 발밑으로 떨어지면 "터졌다"가 아니라 "흘렸다"로 보인다.
    for (const kind of KINDS) expect(EFFECT_PRESETS[kind].gravity).toBeLessThanOrEqual(100);
  });

  it("파편은 남지 않고 배율 0으로 사라진다", () => {
    for (const kind of KINDS) {
      const spec = EFFECT_PRESETS[kind];
      if (spec.shards > 0) expect(spec.shardScale).toBeGreaterThan(0);
      if (spec.shards > 0) expect(spec.life[1]).toBeGreaterThanOrEqual(spec.life[0]);
    }
  });

  it("섬광은 밝은 배경 원화를 하얗게 뭉개지 않을 만큼만 진하다", () => {
    for (const kind of KINDS) {
      const spec = EFFECT_PRESETS[kind];
      expect(spec.flashAlpha).toBeGreaterThan(0);
      expect(spec.flashAlpha).toBeLessThanOrEqual(0.75);
    }
  });

  it("궁극기가 일반 공격보다 확실히 크다", () => {
    expect(EFFECT_PRESETS.ultimate.shards).toBeGreaterThan(EFFECT_PRESETS.basic.shards);
    expect(EFFECT_PRESETS.ultimate.ringRadius).toBeGreaterThan(EFFECT_PRESETS.basic.ringRadius);
    expect(EFFECT_PRESETS.ultimate.flash).toBeGreaterThan(EFFECT_PRESETS.basic.flash);
  });

  it("메뉴의 조작 이펙트는 파편을 뿌리지 않고 전장의 조작 이펙트와 결이 다르다", () => {
    expect(EFFECT_PRESETS.tap.shards).toBe(0);
    expect(EFFECT_PRESETS.tap.rings).toBe(1);
    expect(EFFECT_PRESETS.tapBattle.shards).toBeGreaterThan(0);
    expect(EFFECT_PRESETS.tapBattle.rings).toBe(0);
  });

  it("한 프레임 예산을 넘기면 열지 않는다", () => {
    expect(allowBurst("basic", 1_000, undefined, EFFECT_BUDGET.perFrame - 1)).toBe(true);
    expect(allowBurst("basic", 1_000, undefined, EFFECT_BUDGET.perFrame)).toBe(false);
  });

  it("같은 종류가 너무 촘촘히 이어지면 조용히 버린다", () => {
    const gap = EFFECT_BUDGET.minGapMs.basic;
    expect(allowBurst("basic", 1_000, 1_000 - gap + 1, 0)).toBe(false);
    expect(allowBurst("basic", 1_000, 1_000 - gap, 0)).toBe(true);
  });

  it("궁극기·폭주·사망은 드물게 일어나므로 간격으로 막지 않는다", () => {
    for (const kind of ["ultimate", "fever", "death"] as const) {
      expect(EFFECT_BUDGET.minGapMs[kind]).toBe(0);
      expect(allowBurst(kind, 1_000, 1_000, 0)).toBe(true);
    }
  });
});
