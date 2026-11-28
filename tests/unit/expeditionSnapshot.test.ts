import { describe, expect, it } from "vitest";
import { captureExpeditionRelicSnapshot, isExpeditionRelicSnapshot } from "../../src/core/expeditionSnapshot";
import { getRelic } from "../../src/data/relics";
import { createInitialRelicProgress } from "../../src/state/session";

describe("원정 스냅샷 — 떠난 순간의 성장을 굳힌다", () => {
  const def = getRelic("torika");

  it("유대 각성도 능력치와 함께 굳고, 떠난 뒤 다시 골라도 런의 몫은 그대로다", () => {
    const progress = { ...createInitialRelicProgress(), level: 30, bondLevel: 12, bondAwakening: { atk: 2 } };
    const plain = captureExpeditionRelicSnapshot(def, { ...progress, bondAwakening: undefined }, [], null);
    const snapshot = captureExpeditionRelicSnapshot(def, progress, [], null);
    expect(snapshot.bondAwakening).toEqual({ atk: 2 });
    expect(snapshot.stats.atk).toBeGreaterThan(plain.stats.atk);
    progress.bondAwakening.atk = 0;
    expect(snapshot.bondAwakening).toEqual({ atk: 2 });
    expect(isExpeditionRelicSnapshot(snapshot)).toBe(true);
  });

  it("각성이 없는 예전 스냅샷도 그대로 읽고, 레벨보다 많은 각성은 버린다", () => {
    const snapshot = captureExpeditionRelicSnapshot(def, { ...createInitialRelicProgress(), level: 10 }, [], null);
    expect("bondAwakening" in snapshot).toBe(false);
    expect(isExpeditionRelicSnapshot(snapshot)).toBe(true);
    expect(isExpeditionRelicSnapshot({ ...snapshot, bondAwakening: { atk: 5 } })).toBe(false);
  });
});
