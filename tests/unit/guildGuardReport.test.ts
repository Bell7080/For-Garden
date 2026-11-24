import { describe, expect, it } from "vitest";
import { buildGuardReport, guardReportRows, guardSpawnedThrough, GUARD_REPORT_WAVE_SCALE } from "../../src/core/guildGuardReport";
import { guardWaveCount } from "../../src/core/guildGuard";
import { GUARD_REPORT_LAYOUT, guardReportRowY } from "../../src/ui/guardResultReportLayout";

const member = (rank: number, score: number, isMe = false) => ({ rank, name: `m${rank}`, score, isMe });

describe("수호전 결과판 성적 블록", () => {
  it("처치 막대는 그 웨이브까지 들어온 적에 견준다", () => {
    expect(guardSpawnedThrough(3)).toBe(guardWaveCount(1) + guardWaveCount(2) + guardWaveCount(3));
    const spawned = guardSpawnedThrough(15);
    const report = buildGuardReport({ outcome: { score: 8140, waves: 15, kills: spawned - 4 }, best: 8140, before: null, after: null });
    expect(report.stats[2].fill).toBeCloseTo((spawned - 4) / spawned);
    expect(report.stats[1].fill).toBeCloseTo(15 / GUARD_REPORT_WAVE_SCALE);
    expect(report.rows).toHaveLength(0);
  });

  it("이번 판 전 최고를 넘으면 최고 기록이다", () => {
    const before = { members: [member(1, 9000), member(2, 5000, true)], guildRank: 4 };
    const after = { members: [member(1, 9000), member(2, 8140, true)], guildRank: 3 };
    const report = buildGuardReport({ outcome: { score: 8140, waves: 15, kills: 70 }, best: 8140, before, after });
    expect(report.newBest).toBe(true);
    expect(report.previousBest).toBe(5000);
    expect(report.stats[0].fill).toBeCloseTo(8140 / 9000);
    expect(report.guildRank).toBe(3);
    const again = buildGuardReport({ outcome: { score: 4000, waves: 9, kills: 30 }, best: 8140, before: after, after });
    expect(again.newBest).toBe(false);
    expect(again.best).toBe(8140);
  });

  it("순위 줄은 셋 안이면 위 셋, 아니면 1위 · 바로 위 · 나이고 오른 등수를 센다", () => {
    const after = [member(1, 900), member(2, 800), member(3, 700), member(4, 600), member(5, 500, true)];
    const before = [member(1, 900), member(2, 800), member(3, 700), member(4, 600), member(5, 450), member(6, 400, true)];
    const rows = guardReportRows(after, before);
    expect(rows.map((row) => row.rank)).toEqual([1, 4, 5]);
    expect(rows[2]).toMatchObject({ isMe: true, climbed: 1 });
    expect(rows[0].fill).toBe(1);
    const top = guardReportRows([member(1, 900, true), member(2, 800)], null);
    expect(top.map((row) => row.rank)).toEqual([1, 2]);
    expect(top[0].climbed).toBe(0);
  });

  it("순위 줄은 결과판 밑변 위에 든다", () => {
    const last = guardReportRowY(2) + GUARD_REPORT_LAYOUT.ranking.rowHeight / 2;
    // 결과판 몸판 1360의 절반 680, 오른쪽 아래 깎임(폭 940의 8%)을 비껴야 한다.
    const bevel = 940 * 0.08;
    expect(last).toBeLessThan(680);
    expect(GUARD_REPORT_LAYOUT.ranking.right).toBeLessThan(470 - Math.max(0, last - (680 - bevel)));
    // 보상 액자(y 320 · 132)는 올라가도 기여도 버튼(y 50 · 84) 아래에 서고, 막대 칸은 그 액자 아래에서 시작한다.
    const S = GUARD_REPORT_LAYOUT.stats;
    const lootY = 320 + GUARD_REPORT_LAYOUT.lootShift;
    expect(lootY - 66).toBeGreaterThan(50 + 42 + 40);
    expect(S.y + S.labelDy - S.labelSize / 2).toBeGreaterThan(lootY + 66 + 20);
    expect(S.y + S.captionDy + S.captionSize / 2).toBeLessThan(GUARD_REPORT_LAYOUT.ranking.headerY - 10);
  });
});
