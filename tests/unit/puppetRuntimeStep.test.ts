import { describe, expect, it, vi } from "vitest";
import type { Puppet } from "puppetforge";
import {
  advancePuppet,
  PUPPET_MAX_CATCH_UP_SECONDS,
  PUPPET_STEP_SECONDS,
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

  it("탭 복귀처럼 큰 간격은 제한해 secondary spring 폭주를 막는다", () => {
    const { puppet, update } = puppetStub();
    advancePuppet(puppet, 2);

    expect(update.mock.calls.reduce((sum, [step]) => sum + step, 0)).toBeCloseTo(
      PUPPET_MAX_CATCH_UP_SECONDS,
    );
  });

  it("음수나 정지 프레임에서는 runtime 시간을 되감지 않는다", () => {
    const { puppet, update } = puppetStub();
    expect(advancePuppet(puppet, -1)).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
