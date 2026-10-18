import { describe, expect, it } from "vitest";
import { GUILD_GUARD_ELEMENTS, guildGuardElement, guildPageEventKey, guildPageHasNews, guildWarNow } from "../../src/core/guildPages";

const DAY = 86_400_000;

describe("길드 큰 탭의 붉은 점", () => {
  it("본 날짜와 지금 날짜가 다를 때만 선다", () => {
    const now = Date.UTC(2026, 9, 18, 12);
    const key = guildPageEventKey("war", now);
    expect(guildPageHasNews("war", key, now)).toBe(false);
    expect(guildPageHasNews("war", key, now + DAY)).toBe(true);
    expect(guildPageHasNews("guard", 0, now)).toBe(true);
  });

  it("길드전은 정비일과 전투일이 하루씩 번갈아 돈다", () => {
    const now = Date.UTC(2026, 9, 18, 12);
    const a = guildWarNow(now), b = guildWarNow(now + DAY);
    expect(a.phase).not.toBe(b.phase);
    expect(a.endsAt).toBe(b.endsAt - DAY);
  });

  it("수호전 보스 속성은 다섯 날마다 돌아온다", () => {
    const now = Date.UTC(2026, 9, 18, 12);
    const seen = Array.from({ length: 5 }, (_, i) => guildGuardElement(now + i * DAY));
    expect(new Set(seen).size).toBe(GUILD_GUARD_ELEMENTS.length);
    expect(guildGuardElement(now + 5 * DAY)).toBe(seen[0]);
  });
});
