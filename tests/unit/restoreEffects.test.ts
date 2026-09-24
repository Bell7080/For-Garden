import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { restoreCueIntensity } from "../../src/core/combatEffects";
import { healVisual, shieldAuraStyle, shieldGainVisual, SHIELD_AURA_LEVELS } from "../../src/ui/restoreEffects";
import { skillDescription } from "../../src/ui/skillPresentation";
import { getRelic } from "../../src/data/relics";

const skirmish = readFileSync(new URL("../../src/core/skirmish.ts", import.meta.url), "utf8");

describe("회복·보호막의 세기", () => {
  it("는 받는 쪽 최대 체력의 몇 %였는가에서 나온다(10%가 1)", () => {
    expect(restoreCueIntensity(100, 1000)).toBeCloseTo(1);
    expect(restoreCueIntensity(20, 1000)).toBeCloseTo(0.2);
    // 아주 작은 회복도 사라지지 않고, 아주 큰 회복도 끝없이 커지지 않는다.
    expect(restoreCueIntensity(0.1, 1000)).toBe(0.1);
    expect(restoreCueIntensity(5000, 1000)).toBe(4);
    expect(restoreCueIntensity(100, 1000, 1.5)).toBeCloseTo(1.5);
  });

  it("재생은 조금씩, 큰 회복은 쏟아지듯 선다", () => {
    const regen = healVisual(restoreCueIntensity(20, 1000));
    const big = healVisual(restoreCueIntensity(500, 1000));
    expect(regen.crosses).toBe(1);
    expect(big.crosses).toBeGreaterThanOrEqual(6);
    expect(big.crossSize).toBeGreaterThan(regen.crossSize);
    expect(big.glowSize).toBeGreaterThan(regen.glowSize * 2);
    // 섬광은 상한(0.6)보다 옅다 — 캐릭터를 가리지 않는다.
    expect(big.glowAlpha).toBeLessThan(0.6);
  });

  it("보호막은 두꺼울수록 굵고 진하며, 없으면 원이 서지 않는다", () => {
    expect(shieldAuraStyle(0, 1000)).toBeNull();
    const thin = shieldAuraStyle(20, 1000)!;
    const thick = shieldAuraStyle(600, 1000)!;
    expect(thin.level).toBe(1);
    expect(thick.level).toBe(SHIELD_AURA_LEVELS);
    expect(thick.width).toBeGreaterThan(thin.width);
    expect(thick.alpha).toBeGreaterThan(thin.alpha);
    expect(shieldGainVisual(3).rings).toBe(2);
    expect(shieldGainVisual(0.2).rings).toBe(1);
  });
});

describe("회복·보호막 지급 경로", () => {
  it("보호막은 grantShield 한 곳만 잔량을 바꾼다", () => {
    expect(skirmish.match(/^\s+\w+\.shield\.amount \+=/gm)?.length).toBe(1);
    expect(skirmish).not.toContain("grantShieldAmount");
  });

  it("회복 사건은 pushHeal 한 곳만 만든다", () => {
    expect(skirmish.match(/events\.push\(\{ kind: "heal"/g)?.length).toBe(1);
  });

  it("타보아는 회복 없이 궁극기 때만 조금 보호막을 두른다", () => {
    const taboa = getRelic("taboa");
    expect(taboa.ultimate.selfShieldMaxHpPercent).toBeGreaterThan(0);
    expect(taboa.ultimate.selfShieldMaxHpPercent).toBeLessThanOrEqual(5);
    expect(JSON.stringify(taboa)).not.toMatch(/Healing|heal/);
    expect(skillDescription(taboa.ultimate, { damage: 500, maxHp: 1000 })).toContain("[[shield-value|30]]만큼 보호막을 얻는다");
  });
});
