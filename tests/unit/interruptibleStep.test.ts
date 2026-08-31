import { describe, expect, it, vi } from "vitest";
import { InterruptibleStep } from "../../src/ui/InterruptibleStep";

/** Phaser 콜백을 직접 모사해 UI 런타임 없이 컷인 대기의 수명주기 계약을 검증한다. */
describe("InterruptibleStep", () => {
  it("complete와 stop이 같은 resolve를 중복 호출해도 한 번만 종료된다", async () => {
    const step = new InterruptibleStep();
    let finish!: () => void;
    const completed = vi.fn();
    const waiting = step.wait((settle) => { finish = settle; return vi.fn(); }).then(completed);
    finish();
    finish();
    await waiting;
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it.each(["destroy", "scene shutdown"])("%s 중단은 자원을 정리하고 Promise도 종료한다", async () => {
    const cleanup = vi.fn();
    const step = new InterruptibleStep();
    const waiting = step.wait(() => cleanup);
    step.cancel();
    await expect(waiting).resolves.toBeUndefined();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("정상 complete는 중단 cleanup 없이 Promise를 종료한다", async () => {
    const step = new InterruptibleStep();
    let complete!: () => void;
    const cleanup = vi.fn();
    const waiting = step.wait((finish) => { complete = finish; return cleanup; });
    complete();
    await expect(waiting).resolves.toBeUndefined();
    expect(cleanup).not.toHaveBeenCalled();
  });
});
