import { describe, expect, it } from "vitest";
import { readWithRetry } from "../../src/core/readRetry";

const noWait = async (): Promise<void> => undefined;

describe("화면 조회 재시도", () => {
  it("처음 몇 번 실패해도 끝내 받은 답을 돌려준다", async () => {
    let calls = 0;
    const value = await readWithRetry(async () => { calls += 1; if (calls < 3) throw new Error("network"); return "ok"; }, { alive: () => true, wait: noWait });
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("기다림을 다 쓰면 마지막 실패를 던진다", async () => {
    let calls = 0;
    await expect(readWithRetry(async () => { calls += 1; throw new Error("down"); }, { alive: () => true, delays: [1, 1], wait: noWait })).rejects.toThrow("down");
    expect(calls).toBe(3);
  });

  it("화면을 떠나면 더 묻지 않는다", async () => {
    let calls = 0;
    let alive = true;
    const value = await readWithRetry(async () => { calls += 1; alive = false; throw new Error("x"); }, { alive: () => alive, wait: noWait });
    expect(value).toBeUndefined();
    expect(calls).toBe(1);
  });

  it("규칙이 거절한 실패는 다시 묻지 않는다", async () => {
    let calls = 0;
    await expect(readWithRetry(async () => { calls += 1; throw new Error("rule"); }, { alive: () => true, retryable: () => false, wait: noWait })).rejects.toThrow("rule");
    expect(calls).toBe(1);
  });
});
