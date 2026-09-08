import { describe, expect, it, vi } from "vitest";
import type { Puppet } from "puppetforge";
import {
  advancePuppet,
  PUPPET_MAX_CATCH_UP_SECONDS,
  PUPPET_STEP_SECONDS,
  shouldAdvancePuppet,
} from "../../src/puppets/runtimeStep";

/** Runtime 전체를 만들지 않고 적분 간격과 마지막 vertex 전달만 검증하는 최소 Puppet 대역이다. */
function puppetStub(): { puppet: Puppet; update: ReturnType<typeof vi.fn> } {
  const update = vi.fn((step: number) => new Float32Array([step]));
  return { puppet: { update } as unknown as Puppet, update };
}

describe("Puppet runtime stepping", () => {
  it.each([
    ["비활성 GameObject", { active: false, visible: true, sceneActive: true, motionPaused: false }],
    ["숨은 GameObject", { active: true, visible: false, sceneActive: true, motionPaused: false }],
    ["멈춘 Scene", { active: true, visible: true, sceneActive: false, motionPaused: false }],
    ["명시적으로 정지한 motion", { active: true, visible: true, sceneActive: true, motionPaused: true }],
  ])("%s의 CPU 애니메이션을 건너뛴다", (_label, state) => {
    // Scene UPDATE 구독 여부와 별개로 네 수명주기 조건 중 하나라도 꺼지면 적분하지 않는다.
    expect(shouldAdvancePuppet(state)).toBe(false);
  });

  it("보이고 활성화된 Scene의 재생 중 Puppet만 진행한다", () => {
    // 공개 pause/resume 상태를 포함한 완전한 활성 조합만 runtime update를 허용한다.
    expect(shouldAdvancePuppet({ active: true, visible: true, sceneActive: true, motionPaused: false })).toBe(true);
  });

  it("정지 중 프레임은 재개 프레임의 delta에 누적하지 않는다", () => {
    const { puppet, update } = puppetStub();
    // 정지 중에는 호출 자체가 없고, 재개 뒤에는 그 프레임의 20ms만 PuppetForge에 전달한다.
    if (shouldAdvancePuppet({ active: true, visible: true, sceneActive: true, motionPaused: true })) {
      advancePuppet(puppet, 5);
    }
    if (shouldAdvancePuppet({ active: true, visible: true, sceneActive: true, motionPaused: false })) {
      advancePuppet(puppet, 0.02);
    }

    expect(update.mock.calls.reduce((sum, [step]) => sum + step, 0)).toBeCloseTo(0.02);
  });

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
