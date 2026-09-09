import { describe, expect, it, vi } from "vitest";
import type { Puppet } from "puppetforge";
import {
  advancePuppet,
  PUPPET_BACKGROUND_GAP_SECONDS,
  PUPPET_STEP_SECONDS,
  puppetElapsedMs,
} from "../../src/puppets/runtimeStep";

/** Runtime 전체를 만들지 않고 적분 간격과 마지막 vertex 전달만 검증하는 최소 Puppet 대역이다. */
function puppetStub(): { puppet: Puppet; update: ReturnType<typeof vi.fn> } {
  const update = vi.fn((step: number) => new Float32Array([step]));
  return { puppet: { update } as unknown as Puppet, update };
}

describe("Puppet runtime stepping", () => {
  it("긴 렌더 프레임을 편집기와 같은 60 fps 이하 간격으로 나눈다", () => {
    const { puppet, update } = puppetStub();
    const vertices = advancePuppet(puppet, 0.05);

    expect(update).toHaveBeenCalledTimes(3);
    expect(update.mock.calls.every(([step]) => step <= PUPPET_STEP_SECONDS)).toBe(true);
    expect(update.mock.calls.reduce((sum, [step]) => sum + step, 0)).toBeCloseTo(0.05);
    expect(vertices).toBe(update.mock.results.at(-1)?.value);
  });

  it("500ms 프레임이 지속되어도 1초의 wall-clock 시간을 같은 프레임들에서 모두 진행한다", () => {
    const { puppet, update } = puppetStub();

    // 두 프레임만으로 실제 1초가 지났으므로 뒤의 빠른 프레임에 빚을 남겨서는 안 된다.
    advancePuppet(puppet, 0.5);
    advancePuppet(puppet, 0.5);

    expect(update.mock.calls.reduce((sum, [step]) => sum + step, 0)).toBeCloseTo(1);
    expect(update.mock.calls.every(([step]) => step <= PUPPET_STEP_SECONDS)).toBe(true);
  });

  it.each([0.2, 0.1, 0.033, 0.01667])(
    "%d초 프레임에서 누적 animation time과 1초 wall-clock time이 일치한다",
    (frameSeconds) => {
      const { puppet, update } = puppetStub();
      let wallClock = 0;

      // 마지막 프레임만 잘라 정확히 1초를 구성해 프레임 길이별 누적 오차를 직접 비교한다.
      while (wallClock < 1) {
        const elapsed = Math.min(frameSeconds, 1 - wallClock);
        advancePuppet(puppet, elapsed);
        wallClock += elapsed;
      }

      const animationTime = update.mock.calls.reduce((sum, [step]) => sum + step, 0);
      expect(animationTime).toBeCloseTo(wallClock, 10);
      expect(animationTime).toBeCloseTo(1, 10);
      expect(update.mock.calls.every(([step]) => step <= PUPPET_STEP_SECONDS)).toBe(true);
    },
  );

  it("탭 복귀처럼 큰 간격은 별도 임계값에서 버려 secondary spring 폭주를 막는다", () => {
    const { puppet, update } = puppetStub();
    advancePuppet(puppet, PUPPET_BACKGROUND_GAP_SECONDS);

    // 백그라운드에서 흐른 벽시계 시간은 foreground 재생 remainder와 달리 복구하지 않는다.
    expect(update).not.toHaveBeenCalled();
  });

  it("음수나 정지 프레임에서는 runtime 시간을 되감지 않는다", () => {
    const { puppet, update } = puppetStub();
    expect(advancePuppet(puppet, -1)).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Puppet에 전달할 실제 경과 시간", () => {
  // Phaser의 fps.min=30 설정에서 smoothDelta가 33.33ms로 잘라 보고하는 상황을 그대로 세운다.
  const CLAMPED_MS = 1000 / 30;

  it("평탄화된 delta가 아니라 rawDelta를 써서 느린 프레임의 시간을 잃지 않는다", () => {
    // 6fps(166ms)로 도는 저사양 화면: 평탄화 값만 믿으면 1초가 0.2초로 줄어 5배 슬로모션이 된다.
    expect(puppetElapsedMs(166, CLAMPED_MS)).toBe(166);
    // 창을 다시 잡은 직후의 panicMax 쿨다운(16.67ms 고정)도 같은 이유로 무시한다.
    expect(puppetElapsedMs(166, 1000 / 60)).toBe(166);
  });

  it("1초의 실제 시간은 프레임이 아무리 길어도 1초로 누적된다", () => {
    // 166ms 프레임 여섯 번이 실제 1초에 해당하며, 평탄화 값을 쓰면 0.2초에 그친다.
    const frames = [166, 166, 167, 167, 167, 167];
    const raw = frames.reduce((sum, ms) => sum + puppetElapsedMs(ms, CLAMPED_MS), 0);
    const smoothed = frames.reduce((sum) => sum + CLAMPED_MS, 0);
    expect(raw).toBe(1000);
    expect(smoothed).toBeLessThan(210);
  });

  it("rawDelta를 읽을 수 없으면 기존 delta로 되돌아간다", () => {
    for (const missing of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(puppetElapsedMs(missing, CLAMPED_MS)).toBe(CLAMPED_MS);
    }
  });
});
