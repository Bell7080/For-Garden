import { describe, expect, it } from "vitest";
import { installScreenWakeLock, type WakeLockHost } from "../../src/ui/screenWakeLock";
import { ARENA_NOTICE_FALLBACK_MS, arenaNoticePollDue } from "../../src/core/arenaNoticePoll";

function fakeHost(overrides: Partial<WakeLockHost> = {}) {
  const sentinels: Array<{ released: boolean; release: () => void }> = [];
  let visible = true;
  const listeners: { vis: Array<() => void>; down: Array<() => void> } = { vis: [], down: [] };
  const host: WakeLockHost = {
    wakeLock: {
      request: async () => {
        let onRelease = (): void => undefined;
        const sentinel = { released: false, addEventListener: (_: "release", fn: () => void) => { onRelease = fn; }, release: () => { sentinel.released = true; onRelease(); } };
        sentinels.push(sentinel);
        return sentinel;
      },
    },
    visible: () => visible,
    onVisibilityChange: (fn) => listeners.vis.push(fn),
    onPointerDown: (fn) => listeners.down.push(fn),
    ...overrides,
  };
  return { host, sentinels, listeners, setVisible: (v: boolean) => { visible = v; } };
}

describe("화면 꺼짐 방지", () => {
  it("잡고 있는 동안은 다시 묻지 않고, 풀린 뒤 돌아오면 다시 잡는다", async () => {
    const { host, sentinels, setVisible } = fakeHost();
    const ask = installScreenWakeLock(host);
    await ask();
    await ask();
    expect(sentinels).toHaveLength(1);
    setVisible(false);
    sentinels[0].release();
    await ask();
    expect(sentinels).toHaveLength(1);
    setVisible(true);
    await ask();
    expect(sentinels).toHaveLength(2);
  });

  it("거절돼도 던지지 않고, 웹 API가 없으면 아무것도 하지 않는다", async () => {
    const refused = fakeHost({ wakeLock: { request: async () => { throw new Error("NotAllowed"); } } });
    await expect(installScreenWakeLock(refused.host)()).resolves.toBeUndefined();
    const none = fakeHost({ wakeLock: undefined });
    await expect(installScreenWakeLock(none.host)()).resolves.toBeUndefined();
  });

  it("앱 셸의 화면 유지 플러그인이 있으면 그것을 쓴다", async () => {
    let calls = 0;
    const { host, sentinels } = fakeHost({ keepAwake: async () => { calls += 1; } });
    await installScreenWakeLock(host)();
    expect(calls).toBeGreaterThan(0);
    expect(sentinels).toHaveLength(0);
  });
});

describe("아레나 초대 알림 조회 간격", () => {
  it("실시간 신호가 살아 있으면 1분에 한 번만 묻고, 끊기면 매 틱 묻는다", () => {
    expect(arenaNoticePollDue(10_000, 5_000, true)).toBe(false);
    expect(arenaNoticePollDue(5_000 + ARENA_NOTICE_FALLBACK_MS, 5_000, true)).toBe(true);
    expect(arenaNoticePollDue(10_000, 5_000, false)).toBe(true);
  });
});
