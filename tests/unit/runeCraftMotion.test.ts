import { describe, expect, it } from "vitest";
import { EFFECT_BUDGET, EFFECT_PRESETS } from "../../src/ui/effectPresets";
import {
  planRuneCraftTap,
  RUNE_CHANCE_ROLL,
  RUNE_CRAFT_IMPACT,
  RUNE_CRAFT_QUEUE_LIMIT,
  RUNE_CRAFT_STRIKE,
  RUNE_MARK,
  type RuneCraftImpactKind,
} from "../../src/ui/runeCraftMotion";

const KINDS: readonly RuneCraftImpactKind[] = ["success", "fail", "engrave"];

/** 24비트 색의 대략적인 밝기. 표식이 줄 판 위에서 읽히는지 비교할 때만 쓴다. */
function luminance(color: number): number {
  return 0.2126 * ((color >> 16) & 0xff) + 0.7152 * ((color >> 8) & 0xff) + 0.0722 * (color & 0xff);
}

describe("세공 결과 표식의 색", () => {
  it("세 결과 모두 그림자·빛무리·발광·몸통 네 겹을 갖는다", () => {
    for (const kind of KINDS) {
      const tones = RUNE_MARK[kind];
      expect(tones.shadow).toBeTypeOf("number");
      expect(luminance(tones.glow)).toBeGreaterThan(luminance(tones.body));
      expect(luminance(tones.shadow)).toBeLessThan(luminance(tones.body));
    }
  });

  it("실패도 줄 판 위에서 읽힌다", () => {
    // 줄 판은 0x121a23이다. 몸통이 그 명도에 가까우면 세 칸이 다 찬 줄에서도 무엇이 실패였는지
    // 눈에 들어오지 않는다(예전 0x6e1526이 그랬다).
    expect(luminance(RUNE_MARK.fail.body)).toBeGreaterThan(luminance(0x121a23) * 2);
  });

  it("실패는 성공보다 뒤로 물러난다", () => {
    expect(luminance(RUNE_MARK.fail.body)).toBeLessThan(luminance(RUNE_MARK.success.body));
    expect(RUNE_MARK.fail.bloom ?? 1).toBeLessThan(RUNE_MARK.success.bloom ?? 1);
  });

  it("각인은 크기가 아니라 가장 넓은 빛으로 완성을 말한다", () => {
    expect(RUNE_MARK.engrave.bloom ?? 1).toBeGreaterThan(RUNE_MARK.success.bloom ?? 1);
    expect(RUNE_MARK.engrave.bloom ?? 1).toBeGreaterThan(RUNE_MARK.fail.bloom ?? 1);
  });
});

describe("세공 결과가 박히는 순간", () => {
  it("세 결과 모두 제 크기보다 크게 나타나 앉는다", () => {
    for (const kind of KINDS) {
      expect(RUNE_CRAFT_IMPACT[kind].fromScale).toBeGreaterThan(1);
      // 오래 앉으면 연타 사이에 동작이 겹친다. 서버 응답 간격보다 짧게 끝난다.
      expect(RUNE_CRAFT_IMPACT[kind].settleMs).toBeLessThanOrEqual(300);
    }
  });

  it("성공은 크게 꽂히고 실패는 위에서 떨어져 내려앉는다", () => {
    expect(RUNE_CRAFT_IMPACT.success.fromScale).toBeGreaterThan(RUNE_CRAFT_IMPACT.fail.fromScale);
    expect(RUNE_CRAFT_IMPACT.success.fromY).toBe(0);
    expect(RUNE_CRAFT_IMPACT.fail.fromY).toBeLessThan(0);
  });

  it("각인이 가장 크게 나타나고, 판을 때리는 것도 각인 하나뿐이다", () => {
    expect(RUNE_CRAFT_IMPACT.engrave.fromScale).toBeGreaterThan(RUNE_CRAFT_IMPACT.success.fromScale);
    expect(RUNE_CRAFT_IMPACT.engrave.kickPx).toBeGreaterThan(0);
    expect(RUNE_CRAFT_IMPACT.success.kickPx).toBe(0);
    expect(RUNE_CRAFT_IMPACT.fail.kickPx).toBe(0);
  });

  it("결과마다 제 이펙트 종류를 갖고 간격으로 막히지 않는다", () => {
    for (const kind of KINDS) {
      const effect = RUNE_CRAFT_IMPACT[kind].effect;
      expect(EFFECT_PRESETS[effect]).toBeDefined();
      // 손이 누른 만큼 결과가 박혀야 연타가 화면에 남는다.
      expect(EFFECT_BUDGET.minGapMs[effect]).toBe(0);
    }
  });

  it("누른 순간의 예고는 결과보다 짧고 옅지 않다", () => {
    // 결과가 도착하기 전에 꺼져야 두 동작이 겹치지 않는다.
    expect(RUNE_CRAFT_STRIKE.ms).toBeLessThan(RUNE_CRAFT_IMPACT.success.settleMs);
    expect(RUNE_CRAFT_STRIKE.scale).toBeGreaterThan(1);
  });
});

describe("확률 줄이 흘러가는 시간", () => {
  it("한 번의 세공 결과가 눈에 남고 다음 연타를 막지 않는다", () => {
    expect(RUNE_CHANCE_ROLL.ms).toBeGreaterThanOrEqual(200);
    expect(RUNE_CHANCE_ROLL.ms).toBeLessThanOrEqual(600);
  });
});

describe("세공 연타 대기열", () => {
  it("기다리는 중이 아니면 곧바로 보낸다", () => {
    expect(planRuneCraftTap({ pending: false, queued: 0, repeatable: true })).toBe("run");
    expect(planRuneCraftTap({ pending: false, queued: 0, repeatable: false })).toBe("run");
  });

  it("응답을 기다리는 동안 누른 손도 정해진 깊이까지 세어 둔다", () => {
    for (let queued = 0; queued < RUNE_CRAFT_QUEUE_LIMIT; queued += 1) {
      expect(planRuneCraftTap({ pending: true, queued, repeatable: true })).toBe("queue");
    }
    // 손을 뗀 뒤에도 골드가 계속 빠져나가지 않도록 깊이를 넘으면 버린다.
    expect(planRuneCraftTap({ pending: true, queued: RUNE_CRAFT_QUEUE_LIMIT, repeatable: true })).toBe("drop");
  });

  it("각인은 되돌릴 수 없는 한 번이라 절대 쌓지 않는다", () => {
    expect(planRuneCraftTap({ pending: true, queued: 0, repeatable: false })).toBe("drop");
  });
});
