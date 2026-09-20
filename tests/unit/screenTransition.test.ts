import { describe, expect, it } from "vitest";
import { sceneHandoffDelay, TRANSITION, transitionTiming, type TransitionKind } from "../../src/core/screenTransition";
import { motionPolicy } from "../../src/core/settings";

const KINDS: TransitionKind[] = ["sceneOut", "sceneIn", "popupIn", "popupOut"];

/** 저장 설정에서 실제로 나오는 배율만 검사한다 — 화면이 임의 값을 지어내지 않는다. */
const factorFor = (reduceMotion: boolean): number =>
  motionPolicy({ presentation: { screenShake: true, battleUiMotion: "default" }, accessibility: { reduceMotion } }).nonEssentialDistanceFactor;

describe("화면 전환", () => {
  it("은 나가는 쪽을 들어오는 쪽보다 짧게 둔다", () => {
    // 볼 일이 끝난 화면을 배웅하는 시간은 그대로 기다림이다.
    expect(TRANSITION.sceneOut.duration).toBeLessThan(TRANSITION.sceneIn.duration);
    expect(TRANSITION.popupOut.duration).toBeLessThan(TRANSITION.popupIn.duration);
  });

  it("은 손이 기다린다고 느끼지 않을 만큼만 쓴다", () => {
    // 세로 모바일은 화면을 자주 넘나든다 — 한 번에 0.3초를 넘기면 그 길이가 곧 기다림이다.
    for (const kind of KINDS) expect(TRANSITION[kind].duration, kind).toBeLessThanOrEqual(300);
  });

  it("은 움직임을 끄면 시간과 거리를 함께 0으로 만든다", () => {
    // 시간만 0이면 판이 옮겨진 자리에 그대로 굳고, 거리만 0이면 아무것도 움직이지 않는
    // 트윈을 그 시간만큼 기다린다. 둘 다 없애고 완성된 화면을 곧바로 세운다.
    for (const kind of KINDS) {
      const timing = transitionTiming(kind, { factor: 0 });
      expect(timing, kind).toEqual({ duration: 0, distance: 0, alpha: 1, scale: 1 });
    }
    expect(sceneHandoffDelay({ factor: 0 })).toBe(0);
  });

  it("은 움직임 감소를 켜면 모든 전환이 함께 줄어든다", () => {
    const full = factorFor(false);
    const reduced = factorFor(true);
    expect(reduced).toBeLessThan(full);
    for (const kind of KINDS) {
      const before = transitionTiming(kind, { factor: full });
      const after = transitionTiming(kind, { factor: reduced });
      expect(after.duration, kind).toBeLessThan(before.duration);
      // 부풀어 오르는 몫도 함께 얕아진다 — 시간만 줄이면 같은 거리를 더 빨리 지나 더 거칠어진다.
      expect(1 - after.scale, kind).toBeLessThanOrEqual(1 - before.scale);
      expect(after.distance, kind).toBeLessThanOrEqual(before.distance);
    }
  });

  it("은 다음 씬을 나가는 연출이 끝나기 전에 시작한다", () => {
    // 완전히 사라진 뒤에 갈아 끼우면 그 사이 검은 화면이 한 프레임 보이고, 다음 씬이 무거우면
    // 그 준비 시간이 전환 뒤에 **더해진다.**
    const motion = { factor: factorFor(false) };
    expect(sceneHandoffDelay(motion)).toBeLessThan(transitionTiming("sceneOut", motion).duration);
    expect(sceneHandoffDelay(motion)).toBeGreaterThan(0);
  });

  it("은 망가진 배율을 받아도 화면을 멈춰 세우지 않는다", () => {
    for (const factor of [Number.NaN, -1, 5]) {
      const timing = transitionTiming("sceneIn", { factor });
      expect(timing.duration, String(factor)).toBeGreaterThanOrEqual(0);
      expect(timing.duration, String(factor)).toBeLessThanOrEqual(TRANSITION.sceneIn.duration);
    }
  });
});
