import { describe, expect, it } from "vitest";
import { captureExpeditionRelicSnapshot } from "../../src/core/expeditionSnapshot";
import { GUILD_GUARD, GUILD_GUARD_ARENA, GUILD_GUARD_ENTRY_Y, GUILD_GUARD_SIDE_BAND, arrangeGuardFormation, guildGuardIdleSpot, hordeEntrySpots, buildGuardWave, guardRosterPreview, guardWaveCounts, guardWaveLevel, guildGuardAttemptsLeft, guildGuardDayKey, guildGuardSlotSpot, normalizeGuildGuardFormation, rankGuildGuardMembers } from "../../src/core/guildGuard";
import { GUILD_GUARD_COIN, guildGuardCoin, replayGuildGuard, type GuildGuardLineup } from "../../src/core/guildGuardBattle";
import { GUILD_GUARD_ELEMENTS } from "../../src/core/guildPages";
import { guildGuardRoster } from "../../src/data/guildGuard";
import { getRelic } from "../../src/data/relics";
import { PARTY_GUARD_ROSTER, guardRosterPopupLayout } from "../../src/ui/partyPreviewLayout";
import { createInitialRelicProgress } from "../../src/state/session";

const lineup = (ids: readonly (string | null)[], level: number): GuildGuardLineup => ids.map((id) => id === null ? null : {
  relicId: id,
  snapshot: captureExpeditionRelicSnapshot(getRelic(id), { ...createInitialRelicProgress(), level, breakthrough: Math.max(0, Math.ceil((level - 20) / 10)) }, [], null),
});

describe("수호전 웨이브", () => {
  it("웨이브마다 레벨이 오르고 정예는 셋째 웨이브부터 섞인다", () => {
    expect(guardWaveLevel(1)).toBe(GUILD_GUARD.startLevel);
    expect(guardWaveLevel(5)).toBeGreaterThan(guardWaveLevel(4));
    expect(guardWaveLevel(999)).toBe(GUILD_GUARD.maxLevel);
    expect(guardWaveCounts(1).elites).toBe(0);
    expect(guardWaveCounts(3).elites).toBe(1);
    expect(guardWaveCounts(60).grunts).toBeLessThanOrEqual(GUILD_GUARD.gruntCap);
  });

  it("다섯 속성 모두 잡졸과 정예를 그 속성에서만 고른다", () => {
    for (const element of GUILD_GUARD_ELEMENTS) {
      const roster = guildGuardRoster(element);
      expect(roster.grunts.length, element).toBeGreaterThan(0);
      expect(roster.elites.length, element).toBeGreaterThan(0);
      for (const def of [...roster.grunts, ...roster.elites]) expect(def.element).toBe(element);
      const wave = buildGuardWave(roster, 3);
      expect(wave.units.filter((unit) => unit.role === "elite")).toHaveLength(1);
    }
  });

  it("적은 스토리 적 전용 개체뿐이다 — 아군 캐릭터가 적으로 서지 않는다", () => {
    for (const element of GUILD_GUARD_ELEMENTS) {
      const roster = guildGuardRoster(element);
      expect(roster.grunts.some((def) => def.id.startsWith("raitia-")), element).toBe(true);
      for (const def of [...roster.grunts, ...roster.elites]) expect(def.enemyOnly, def.id).toBe(true);
    }
  });

  it("적은 위·양옆 경계에서만 들어오고 뒤(아래)에서는 오지 않는다", () => {
    const arena = GUILD_GUARD_ARENA;
    for (let wave = 0; wave < 6; wave += 1) {
      const spots = hordeEntrySpots(arena, GUILD_GUARD_ENTRY_Y, 12, wave);
      expect(spots).toHaveLength(12);
      expect(new Set(spots.map(({ from }) => from)).size).toBe(3);
      for (const spot of spots) {
        if (spot.from === "top") {
          expect(spot.y).toBeLessThanOrEqual(GUILD_GUARD_ENTRY_Y);
          expect(spot.x).toBeGreaterThanOrEqual(arena.left);
          expect(spot.x).toBeLessThanOrEqual(arena.right);
        } else {
          expect(spot.y).toBeGreaterThanOrEqual(GUILD_GUARD_SIDE_BAND.top);
          expect(spot.y).toBeLessThanOrEqual(GUILD_GUARD_SIDE_BAND.bottom);
          expect(spot.from === "left" ? spot.x < arena.left : spot.x > arena.right).toBe(true);
        }
      }
    }
  });

  it("적이 없을 때 서는 자리는 제 칸보다 가운데·위쪽이다", () => {
    const centerX = (GUILD_GUARD_ARENA.left + GUILD_GUARD_ARENA.right) / 2;
    for (let slot = 0; slot < 6; slot += 1) {
      const home = guildGuardSlotSpot(slot), idle = guildGuardIdleSpot(slot);
      expect(idle.y).toBeLessThan(home.y);
      expect(Math.abs(idle.x - centerX)).toBeLessThanOrEqual(Math.abs(home.x - centerX));
    }
  });

  it("앞줄은 뒷줄보다 위(적 쪽)에 서고 더 깊이 나간다", () => {
    for (let slot = 0; slot < 3; slot += 1) {
      const front = guildGuardSlotSpot(slot), back = guildGuardSlotSpot(slot + 3);
      expect(front.x).toBe(back.x);
      expect(front.y).toBeLessThan(back.y);
      expect(front.leashTop).toBeLessThan(back.leashTop);
    }
  });
});

describe("수호전 규칙", () => {
  it("하루 두 번, 날이 바뀌면 다시 두 번", () => {
    const now = Date.UTC(2026, 9, 27, 12);
    const day = guildGuardDayKey(now);
    expect(guildGuardAttemptsLeft(undefined, now)).toBe(2);
    expect(guildGuardAttemptsLeft({ day, used: 1 }, now)).toBe(1);
    expect(guildGuardAttemptsLeft({ day, used: 2 }, now)).toBe(0);
    expect(guildGuardAttemptsLeft({ day, used: 2 }, now + 86_400_000)).toBe(2);
  });

  it("편성은 여섯 칸·중복 없음·한 명 이상", () => {
    expect(normalizeGuildGuardFormation(["a", null, null, "b", null, null])).toEqual(["a", null, null, "b", null, null]);
    expect(() => normalizeGuildGuardFormation(["a", "a", null, null, null, null])).toThrow();
    expect(() => normalizeGuildGuardFormation([null, null, null, null, null, null])).toThrow();
    expect(() => normalizeGuildGuardFormation(["a"])).toThrow();
  });

  it("코인은 한 판 5~20이다(하루 두 판 40이 끝)", () => {
    expect(guildGuardCoin(0)).toBe(GUILD_GUARD_COIN.base);
    expect(guildGuardCoin(150)).toBe(6);
    expect(guildGuardCoin(1_000_000)).toBe(GUILD_GUARD_COIN.cap);
    expect(GUILD_GUARD_COIN.cap * GUILD_GUARD.attemptsPerDay).toBeLessThanOrEqual(40);
  });

  it("순위는 점수 내림차순, 같으면 먼저 낸 사람", () => {
    const ranked = rankGuildGuardMembers([
      { accountId: "a", name: "A", score: 100, at: 2 },
      { accountId: "b", name: "B", score: 300, at: 5 },
      { accountId: "c", name: "C", score: 100, at: 1 },
    ]);
    expect(ranked.map(({ accountId }) => accountId)).toEqual(["b", "c", "a"]);
  });
});

describe("수호전 재현", () => {
  it("같은 편성·시드면 같은 점수가 나오고, 키운 편성이 더 멀리 간다", () => {
    const roster = guildGuardRoster("earth");
    const ids = ["deina", "rex", "ark", "terisa", "stella", "mette"];
    const weak = replayGuildGuard(lineup(ids, 1), getRelic, roster, "seed-a");
    const again = replayGuildGuard(lineup(ids, 1), getRelic, roster, "seed-a");
    expect(again).toEqual(weak);
    expect(weak.score).toBeGreaterThan(0);
    const strong = replayGuildGuard(lineup(ids, 30), getRelic, roster, "seed-a");
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.waves).toBeGreaterThan(weak.waves);
  }, 60_000);

  it("빈 칸이 있는 편성도 그 자리를 비운 채 선다", () => {
    const outcome = replayGuildGuard(lineup(["deina", null, null, null, "stella", null], 10), getRelic, guildGuardRoster("fire"), "seed-b");
    expect(outcome.kills).toBeGreaterThan(0);
  }, 60_000);
});

describe("수호전 자동 배치", () => {
  it("앞줄에 탱커·전사를 먼저 세우고 모자란 칸은 비운다", () => {
    const tank = { ...getRelic("deina"), id: "t", role: "tank" as const };
    const support = { ...getRelic("deina"), id: "s", role: "support" as const };
    const warrior = { ...getRelic("deina"), id: "w", role: "warrior" as const };
    expect(arrangeGuardFormation([support, tank, warrior])).toEqual(["t", "w", "s", null, null, null]);
  });
});

describe("수호전 「오늘의 적」 미리보기", () => {
  it("명단의 얼굴이 한 번씩, 처음 서는 웨이브의 레벨로 선다(무리 먼저)", () => {
    for (const element of GUILD_GUARD_ELEMENTS) {
      const roster = guildGuardRoster(element);
      const { entries, firstWave } = guardRosterPreview(roster);
      const ids = entries.map((entry) => entry.def.id);
      expect(new Set(ids).size).toBe(ids.length);
      const rosterIds = new Set([...roster.grunts, ...roster.elites].map((def) => def.id));
      for (const id of ids) expect(rosterIds.has(id)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) expect(entry.level).toBe(guardWaveLevel(entry.wave));
      const firstElite = entries.findIndex((entry) => entry.role === "elite");
      if (firstElite >= 0) expect(entries.slice(firstElite).every((entry) => entry.role === "elite")).toBe(true);
      expect(firstWave.index).toBe(1);
    }
  });

  it("얼굴 칸은 창 폭과 높이 안에 들고 줄끼리 겹치지 않는다", () => {
    for (const counts of [[3, 2], [7, 0], [12, 6], [0, 4]]) {
      const layout = guardRosterPopupLayout(counts);
      const half = layout.height / 2;
      for (const section of layout.sections) {
        expect(section.titleY).toBeGreaterThan(-half);
        for (const cell of section.cells) {
          expect(Math.abs(cell.x) + PARTY_GUARD_ROSTER.face / 2).toBeLessThanOrEqual(PARTY_GUARD_ROSTER.width / 2);
          expect(cell.y - PARTY_GUARD_ROSTER.face / 2).toBeGreaterThan(section.titleY);
          expect(cell.y + PARTY_GUARD_ROSTER.face / 2 + 70).toBeLessThan(half);
        }
      }
      expect(layout.sections.length).toBe(counts.filter((count) => count > 0).length);
    }
  });
});
