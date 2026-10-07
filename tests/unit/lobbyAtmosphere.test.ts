import { describe, expect, it } from "vitest";
import { LOBBY_ATMOSPHERE, lobbyAtmospherePlan, moteFrequencyMs } from "../../src/core/lobbyAtmosphere";

describe("로비 분위기 층", () => {
  it("기본에서는 알갱이 상한만큼 서고 숨 쉬는 역광을 쓴다", () => {
    const plan = lobbyAtmospherePlan({ particleFactor: 1, quality: "high", reduceMotion: false });
    expect(plan.motes).toBe(LOBBY_ATMOSPHERE.motes.max);
    expect(plan.breathing).toBe(true);
  });
  it("절전·움직임 감소·낮은 품질은 알갱이를 줄이고 움직임 줄이기는 역광 숨쉬기를 멈춘다", () => {
    const power = lobbyAtmospherePlan({ particleFactor: 0.5, quality: "high", reduceMotion: false }).motes;
    const low = lobbyAtmospherePlan({ particleFactor: 0.5, quality: "low", reduceMotion: false }).motes;
    expect(power).toBeLessThan(LOBBY_ATMOSPHERE.motes.max);
    expect(low).toBeLessThan(power);
    expect(lobbyAtmospherePlan({ particleFactor: 0.25, quality: "high", reduceMotion: true }).breathing).toBe(false);
  });
  it("숨김(0)이면 알갱이를 세우지 않지만 정지한 역광은 남는다", () => {
    const plan = lobbyAtmospherePlan({ particleFactor: 0, quality: "high", reduceMotion: false });
    expect(plan.motes).toBe(0);
    expect(plan.glow).toBe(true);
    expect(moteFrequencyMs(0)).toBe(0);
  });
  it("생성 간격은 평균 수명을 수로 나눈 값이라 정해진 수가 유지된다", () => {
    const [min, max] = LOBBY_ATMOSPHERE.motes.lifeMs;
    expect(moteFrequencyMs(24) * 24).toBeCloseTo((min + max) / 2);
  });
});
