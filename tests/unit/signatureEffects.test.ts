import { describe, expect, it } from "vitest";
import {
  combatPalette, inkBlotPoints, mawTeeth, signatureFor, SIGNATURE_SPECS, slashPoints,
} from "../../src/ui/signatureEffects";
import { ELEMENT_TINT, ROLE_TINT, skillArtTint } from "../../src/ui/skillArt";
import { getRelic } from "../../src/data/relics";

describe("전투 색은 속성이 면, 직군이 선이다", () => {
  it("속성과 직군을 섞지 않고 그대로 나눠 갖는다", () => {
    const ella = getRelic("ella");
    const palette = combatPalette(ella.element, ella.role);
    expect(palette.main).toBe(ELEMENT_TINT[ella.element]);
    expect(palette.sub).toBe(ROLE_TINT[ella.role]);
    // 섞은 색은 스킬 아이콘과 같은 값이라야 한 개체로 읽힌다.
    expect(palette.mixed).toBe(skillArtTint(ella.element, ella.role));
  });

  it("같은 속성이라도 직군이 다르면 선 색이 갈린다", () => {
    const tank = combatPalette("wind", "tank");
    const assassin = combatPalette("wind", "assassin");
    expect(tank.main).toBe(assassin.main);
    expect(tank.sub).not.toBe(assassin.sub);
  });
});

describe("전용 연출은 표가 정한다", () => {
  it("개체와 순간이 맞을 때만 열린다", () => {
    expect(signatureFor("rex", "ultimate")).toBe("rexMaw");
    expect(signatureFor("spino", "combo")).toBe("spinoDoubleTap");
    expect(signatureFor("pachi", "concussion")).toBe("pachiSlam");
    expect(signatureFor("nodonia", "damageShared")).toBe("nodoniaShare");
    expect(signatureFor("ella", "basicStep")).toBe("ellaInkStroke");
  });

  it("같은 개체라도 다른 순간에는 공용 파편 그대로다", () => {
    expect(signatureFor("rex", "combo")).toBeUndefined();
    expect(signatureFor("ella", "ultimate")).toBeUndefined();
    expect(signatureFor("meron", "ultimate")).toBeUndefined();
  });

  it("표에 적힌 개체는 실제로 존재하고 그 순간을 가진 개체다", () => {
    // 스피나만 연격을 갖고, 파치만 뇌진탕을 갖고, 엘라만 순환 평타를 갖는다 —
    // 표가 실제 메커니즘과 갈리면 열리지 않는 연출이 조용히 남는다.
    expect(getRelic("spino").basic.combo).toBeDefined();
    expect(getRelic("ella").basic.cycle?.length).toBe(SIGNATURE_SPECS.ellaInkStroke.steps.length);
    expect(getRelic("nodonia").ultimate.selfBulwark).toBeDefined();
  });
});

describe("도형은 그 자리에서 읽혀야 한다", () => {
  it("턱은 이빨마다 뿌리로 돌아온다 — 삼각형을 늘어놓으면 톱날이 된다", () => {
    const spec = SIGNATURE_SPECS.rexMaw;
    const teeth = mawTeeth(spec.halfWidth, spec.depth, spec.teeth, 1);
    expect(teeth).toHaveLength(spec.teeth * 2 + 1);
    expect(teeth[0]).toEqual({ x: -spec.halfWidth, y: 0 });
    expect(teeth[teeth.length - 1].x).toBeCloseTo(spec.halfWidth, 5);
    // 홀수 번째가 이빨 끝, 짝수 번째가 뿌리다.
    expect(teeth[1].y).toBeCloseTo(spec.depth, 5);
    expect(teeth[2].y).toBe(0);
  });

  it("위턱과 아래턱은 서로 마주 본다", () => {
    const upper = mawTeeth(60, 20, 3, -1);
    const lower = mawTeeth(60, 20, 3, 1);
    expect(upper[1].y).toBeCloseTo(-lower[1].y, 5);
  });

  it("벤 자국은 뿌리가 두껍고 끝이 가늘다", () => {
    const spec = SIGNATURE_SPECS.spinoDoubleTap;
    const points = slashPoints({ x: 0, y: 0 }, 0, spec.length, spec.rootWidth, spec.tipWidth);
    expect(points).toHaveLength(4);
    const root = Math.hypot(points[0].x - points[3].x, points[0].y - points[3].y);
    const tip = Math.hypot(points[1].x - points[2].x, points[1].y - points[2].y);
    expect(root).toBeCloseTo(spec.rootWidth, 5);
    expect(tip).toBeCloseTo(spec.tipWidth, 5);
    expect(tip).toBeLessThan(root);
  });

  it("두 번째 베임은 더 길고 각이 다르다 — 같으면 한 번 그은 것이 깜빡인 것으로 보인다", () => {
    const spec = SIGNATURE_SPECS.spinoDoubleTap;
    expect(spec.growth).toBeGreaterThan(1);
    expect(spec.angleGap).toBeGreaterThan(0);
    // 박자는 한 획이 지나가는 시간과 겹치지 않아야 "따-닥"이 둘로 들린다.
    expect(spec.beatMs).toBeGreaterThan(spec.ms);
  });

  it("먹 자국은 정원이 아니다", () => {
    const blot = inkBlotPoints({ x: 0, y: 0 }, 40);
    const radii = blot.map((point) => Math.hypot(point.x, point.y));
    expect(Math.max(...radii)).toBeGreaterThan(Math.min(...radii) * 1.1);
    // 같은 인자면 같은 모양이다 — 매 프레임 다시 흔들리면 얼룩이 끓어 보인다.
    expect(inkBlotPoints({ x: 0, y: 0 }, 40)).toEqual(blot);
  });

  it("먹은 빛이 아니라 얼룩이라 검게 깔리고 색은 둘레에만 얹힌다", () => {
    const spec = SIGNATURE_SPECS.ellaInkStroke;
    expect(spec.ink).toBeLessThan(0x303030);
    expect(spec.edgeAlpha).toBeLessThan(spec.inkAlpha);
  });

  it("밝은 배경 원화 위에 서므로 어느 연출도 불투명하게 덮지 않는다", () => {
    const alphas = [
      SIGNATURE_SPECS.rexMaw.fillAlpha, SIGNATURE_SPECS.spinoDoubleTap.alpha,
      SIGNATURE_SPECS.pachiSlam.alpha, SIGNATURE_SPECS.nodoniaShare.alpha,
      SIGNATURE_SPECS.ellaInkStroke.inkAlpha,
    ];
    for (const alpha of alphas) expect(alpha).toBeLessThan(0.9);
  });

  it("파치의 금은 별이 되지 않고 바닥에 누워 있다", () => {
    const spec = SIGNATURE_SPECS.pachiSlam;
    expect(spec.cracks).toBeLessThanOrEqual(4);
    expect(spec.squash).toBeLessThan(0.5);
  });
});
