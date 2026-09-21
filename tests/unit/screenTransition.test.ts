import { describe, expect, it } from "vitest";
import { TRANSITION, transitionTiming, type TransitionKind } from "../../src/core/screenTransition";
import { motionPolicy } from "../../src/core/settings";

const KINDS: TransitionKind[] = ["sceneIn", "navSwitch", "popupIn", "popupOut"];

/** 저장 설정에서 실제로 나오는 배율만 검사한다 — 화면이 임의 값을 지어내지 않는다. */
const factorFor = (reduceMotion: boolean): number =>
  motionPolicy({ presentation: { screenShake: true, battleUiMotion: "default" }, accessibility: { reduceMotion } }).nonEssentialDistanceFactor;

describe("화면 전환", () => {
  it("은 닫는 쪽을 여는 쪽보다 짧게 둔다", () => {
    // 닫는 손은 이미 다음 조작을 하려는 손이라, 사라지는 판을 기다리게 하면 안 된다.
    expect(TRANSITION.popupOut.duration).toBeLessThan(TRANSITION.popupIn.duration);
  });

  it("에는 씬이 나가는 연출이 없다", () => {
    /*
     * 나가는 연출은 `scene.start`를 그만큼 미뤄야 성립하는데, 미루는 일을 씬의 시계가 맡으므로
     * **프레임이 돌아야** 깨어난다 — 메인 스레드가 바쁜 자리에서 98ms짜리 타이머가 1.5초 넘게
     * 늦어, 화면이 갈리는 일 자체에 상한 없는 기다림이 얹혔다. 다시 만들려면 그 지연부터 푼다.
     */
    expect(Object.keys(TRANSITION)).not.toContain("sceneOut");
  });

  it("은 화면을 검게 지웠다 밝히지 않는다", () => {
    /*
     * 시작 불투명도가 0이면 화면을 옮길 때마다 한 번씩 암전을 지난다. 자주 오가는 손에는
     * 그것이 전환이 아니라 **번쩍임**으로 읽힌다 — 실제로 그 말을 들었다.
     */
    expect(TRANSITION.sceneIn.alpha).toBeGreaterThan(0);
    expect(TRANSITION.navSwitch.alpha).toBeGreaterThan(TRANSITION.sceneIn.alpha);
  });

  it("은 핵심 화면 다섯 사이를 일반 전환보다 가볍게 지난다", () => {
    // 나란히 놓인 자리라 손이 하루에도 수십 번 오간다. 같은 무게로 두면 그만큼 되풀이해 본다.
    expect(TRANSITION.navSwitch.duration).toBeLessThan(TRANSITION.sceneIn.duration);
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

  it("은 망가진 배율을 받아도 화면을 멈춰 세우지 않는다", () => {
    for (const factor of [Number.NaN, -1, 5]) {
      const timing = transitionTiming("sceneIn", { factor });
      expect(timing.duration, String(factor)).toBeGreaterThanOrEqual(0);
      expect(timing.duration, String(factor)).toBeLessThanOrEqual(TRANSITION.sceneIn.duration);
    }
  });
});
