import { describe, expect, it } from "vitest";
import { allowBurst, AREA_IMPACT, EFFECT_BUDGET, EFFECT_PRESETS, type EffectKind } from "../../src/ui/effectPresets";

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
      expect(spec.flashAlpha).toBeLessThanOrEqual(0.6);
    }
  });

  it("잦은 일반 공격의 섬광이 드문 궁극기보다 옅다", () => {
    // 매 초 여러 번 터지는 것이 진하면 난전 내내 화면이 하얗게 뜬다.
    expect(EFFECT_PRESETS.basic.flashAlpha).toBeLessThan(EFFECT_PRESETS.ultimate.flashAlpha);
    expect(EFFECT_PRESETS.basic.flash).toBeLessThan(EFFECT_PRESETS.ultimate.flash);
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

describe("광역 범위 바닥 표시", () => {
  it("정원이 아니라 눌린 마름모다", () => {
    // 위에서 비스듬히 내려다보는 전장이라 원을 그대로 그리면 바닥에 누운 것이 아니라
    // 캐릭터 앞에 세워 둔 고리처럼 보인다.
    expect(AREA_IMPACT.squash).toBeGreaterThan(0);
    expect(AREA_IMPACT.squash).toBeLessThan(1);
  });

  it("배경 원화가 비칠 만큼만 채우고 테두리로 경계를 알린다", () => {
    expect(AREA_IMPACT.fillAlpha).toBeLessThanOrEqual(0.25);
    expect(AREA_IMPACT.lineAlpha).toBeGreaterThan(AREA_IMPACT.fillAlpha);
  });

  it("점이 커지는 것처럼 보이지 않도록 이미 벌어진 크기에서 시작한다", () => {
    expect(AREA_IMPACT.growFrom).toBeGreaterThan(0.3);
    expect(AREA_IMPACT.growFrom).toBeLessThan(1);
  });

  it("궁극기 범위가 더 오래 남아 무엇이 컸는지 알린다", () => {
    expect(AREA_IMPACT.ultimateMs).toBeGreaterThan(AREA_IMPACT.ms);
  });
});
