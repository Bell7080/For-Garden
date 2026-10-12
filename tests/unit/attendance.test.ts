import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import {
  ATTENDANCE_DAYS, attendanceClaimable, attendanceTrackView, claimAttendanceAdBonus, claimAttendanceDay, createEmptyAttendanceState, isValidAttendanceState,
  NEWCOMER_ATTENDANCE_WINDOW_DAYS, REGULAR_ATTENDANCE_WINDOW_DAYS, rollAttendance, type AttendanceState,
} from "../../src/core/attendance";
import { createEmptyRaidTicketDropState, RAID_TICKET_DROP, rollRaidTicketDrops, strataRaidTicketTile } from "../../src/core/raidTicketDrops";
import { ATTENDANCE_AD_REWARDS, ATTENDANCE_AD_SLOT_ID, ATTENDANCE_REWARDS } from "../../src/data/attendance";
import { isCleanPaidAmount } from "../../src/core/paidAmountUnit";
import { RAID_SELECT_TICKET_ITEM, RAID_TICKET_ITEM } from "../../src/data/raid";
import { createDefaultSession } from "../../src/state/session";
import { attendancePanelLayout } from "../../src/ui/attendanceStyle";
import { lobbyEventEntries } from "../../src/ui/lobbyEventModel";

const day = (offset: number) => new Date(Date.UTC(2026, 9, 1 + offset, 12));

/** 날마다 한 칸씩 받는다(`skip`에 든 날은 들어오지 않는다). */
function walk(days: number, skip: readonly number[] = [], track: "newcomer" | "regular" = "regular"): { state: AttendanceState; claims: number[] } {
  let state = createEmptyAttendanceState();
  const claims: number[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    if (skip.includes(offset)) continue;
    const claimed = claimAttendanceDay(state, track, day(offset));
    if (claimed) { state = claimed.state; claims.push(claimed.day); }
  }
  return { state, claims };
}

describe("출석", () => {
  it("보상표는 두 줄 모두 일곱 칸, 칸마다 하나이고 수량은 깔끔한 단위다", () => {
    for (const rows of [...Object.values(ATTENDANCE_REWARDS), ATTENDANCE_AD_REWARDS]) {
      expect(rows).toHaveLength(ATTENDANCE_DAYS);
      for (const reward of rows) {
        expect(reward.amount).toBeGreaterThan(0);
        expect(isCleanPaidAmount(reward.amount)).toBe(true);
      }
    }
  });

  it("광고 덤은 그날 받은 칸에만 하루 한 번 붙는다", () => {
    const first = claimAttendanceDay(createEmptyAttendanceState(), "regular", day(0))!;
    expect(claimAttendanceAdBonus(createEmptyAttendanceState(), day(0))).toBeNull();
    const ad = claimAttendanceAdBonus(first.state, day(0))!;
    expect(ad.day).toBe(1);
    expect(claimAttendanceAdBonus(ad.state, day(0))).toBeNull();
    // 다음 날은 그날 칸을 받기 전에는 덤이 없고, 지나간 1일차 덤은 다시 열리지 않는다.
    expect(claimAttendanceAdBonus(first.state, day(1))).toBeNull();
    const second = claimAttendanceDay(first.state, "regular", day(1))!;
    expect(claimAttendanceAdBonus(second.state, day(1))?.day).toBe(2);
    expect(isValidAttendanceState(ad.state)).toBe(true);
  });

  it("신규를 받은 같은 날 정규도 받는다 — 두 줄은 서로를 막지 않는다", async () => {
    const state = createDefaultSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => day(0), random: () => 0 });
    await server.markAttendanceAutoShown();
    expect((await server.claimAttendance({ trackId: "newcomer", requestId: "n" })).day).toBe(1);
    const regular = await server.claimAttendance({ trackId: "regular", requestId: "r" });
    expect(regular.day).toBe(1);
    expect(regular.tracks.find(({ id }) => id === "regular")?.adClaimableToday).toBe(true);
    await expect(server.claimAttendanceAd({ requestId: "x", verificationToken: "bogus" })).rejects.toThrow();
    const gems = state.wallet.gold;
    const ad = await server.claimAttendanceAd({ requestId: "a", verificationToken: `verified:${ATTENDANCE_AD_SLOT_ID}` });
    expect(state.wallet.gold - gems).toBe(ATTENDANCE_AD_REWARDS[0]!.amount);
    expect(ad.tracks.find(({ id }) => id === "regular")?.adClaimed).toEqual([1]);
    await expect(server.claimAttendanceAd({ requestId: "b", verificationToken: `verified:${ATTENDANCE_AD_SLOT_ID}` })).rejects.toThrow();
  });

  it("하루에 한 칸만 받는다", () => {
    const first = claimAttendanceDay(createEmptyAttendanceState(), "regular", day(0));
    expect(first?.day).toBe(1);
    expect(claimAttendanceDay(first!.state, "regular", day(0))).toBeNull();
    expect(claimAttendanceDay(first!.state, "regular", day(1))?.day).toBe(2);
  });

  it("정규는 빠진 날을 이어 받고, 일곱 칸을 다 받으면 다음 날 새 바퀴가 열린다", () => {
    const { claims } = walk(9, [2]);
    expect(claims).toEqual([1, 2, 3, 4, 5, 6, 7, 1]);
  });

  it("정규는 첫 칸부터 10일이 지나면 남은 칸이 사라지고 1일차부터 다시 시작한다", () => {
    const { claims } = walk(REGULAR_ATTENDANCE_WINDOW_DAYS + 1, [1, 2, 3, 4, 5, 6]);
    // 0·7·8·9일에 받아 네 칸, 10일째에는 바퀴가 지나 1일차로 돌아간다.
    expect(claims).toEqual([1, 2, 3, 4, 1]);
  });

  it("신규는 14일 안에만 열리고, 다 받은 다음 날부터 서지 않는다", () => {
    const { state, claims } = walk(10, [], "newcomer");
    expect(claims).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(attendanceTrackView(rollAttendance(state, day(9)), "newcomer", day(9)).open).toBe(false);
    const idle = rollAttendance(createEmptyAttendanceState(), day(0));
    expect(attendanceTrackView(idle, "newcomer", day(NEWCOMER_ATTENDANCE_WINDOW_DAYS - 1)).claimableToday).toBe(true);
    expect(attendanceTrackView(idle, "newcomer", day(NEWCOMER_ATTENDANCE_WINDOW_DAYS)).open).toBe(false);
  });

  it("넘긴 상태는 저장 검증을 지난다", () => {
    const { state } = walk(3);
    expect(isValidAttendanceState(state)).toBe(true);
    expect(isValidAttendanceState({ ...state, regular: { ...state.regular, claimed: 9 } })).toBe(false);
    expect(attendanceClaimable(state, day(2))).toBe(true);
  });

  it("서버는 오늘 칸을 지급하고, 같은 요청은 한 번만 지급한다", async () => {
    const state = createDefaultSession();
    const server = new FakeServer(state, { latencyMs: 0, now: () => day(0) });
    const status = await server.getAttendance();
    expect(status.autoShow).toBe(true);
    expect(status.tracks.map(({ id }) => id)).toEqual(["newcomer", "regular"]);
    const gems = state.wallet.gems;
    const result = await server.claimAttendance({ trackId: "newcomer", requestId: "a" });
    expect(result.day).toBe(1);
    expect(state.wallet.gems - gems).toBe(1_000);
    await server.claimAttendance({ trackId: "newcomer", requestId: "a" });
    expect(state.wallet.gems - gems).toBe(1_000);
    await expect(server.claimAttendance({ trackId: "newcomer", requestId: "b" })).rejects.toThrow();
    await server.markAttendanceAutoShown();
    expect((await server.getAttendance()).autoShow).toBe(false);
  });
});

describe("토벌권 덤", () => {
  it("난수 0에서는 떨어지지 않는다", () => {
    expect(rollRaidTicketDrops(createEmptyRaidTicketDropState(), 10, day(0), () => 0).drops).toEqual([]);
    expect(strataRaidTicketTile(() => 0)).toBeNull();
  });

  it("하루 상한을 넘지 않고, 날이 바뀌면 다시 센다", () => {
    const always = () => 0.999;
    const first = rollRaidTicketDrops(createEmptyRaidTicketDropState(), 20, day(0), always);
    expect(first.drops).toEqual([{ itemId: RAID_TICKET_ITEM, amount: RAID_TICKET_DROP.dailyNormalCap }, { itemId: RAID_SELECT_TICKET_ITEM, amount: RAID_TICKET_DROP.dailySelectCap }]);
    expect(rollRaidTicketDrops(first.state, 5, day(0), always).drops).toEqual([]);
    expect(rollRaidTicketDrops(first.state, 1, day(1), always).drops).toHaveLength(2);
  });
});

describe("출석 판·이벤트 목록", () => {
  it.each([false, true])("일곱 칸이 판 안에 들고 세 줄 폭이 같으며 겹치지 않는다 (광고 덤 %s)", (withAd) => {
    const layout = attendancePanelLayout(withAd);
    expect(layout.slots.map(({ day: value }) => value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const edges = (row: typeof layout.slots) => [Math.min(...row.map((slot) => slot.x - slot.width / 2)), Math.max(...row.map((slot) => slot.x + slot.width / 2))];
    expect(edges(layout.slots.slice(0, 3))).toEqual(edges(layout.slots.slice(3, 6)));
    expect(edges(layout.slots.slice(0, 3))).toEqual(edges(layout.slots.slice(6)));
    for (const slot of layout.slots) {
      expect(slot.y + slot.height / 2).toBeLessThan(layout.height / 2 - 40);
      expect(slot.y - slot.height / 2).toBeGreaterThan(layout.headerY + 30);
      expect(slot.x - slot.width / 2).toBeGreaterThan(-layout.width / 2 + 40);
      expect(Boolean(slot.ad)).toBe(withAd);
      if (slot.ad) expect(slot.main.y + slot.main.height / 2).toBeLessThan(slot.ad.y - slot.ad.height / 2);
    }
    for (const a of layout.slots) for (const b of layout.slots) {
      if (a === b) continue;
      const apart = a.x + a.width / 2 <= b.x - b.width / 2 || b.x + b.width / 2 <= a.x - a.width / 2 || a.y + a.height / 2 <= b.y - b.height / 2 || b.y + b.height / 2 <= a.y - a.height / 2;
      expect(apart).toBe(true);
    }
  });

  it("출석이 기간 이벤트보다 먼저 선다", () => {
    const track = { id: "regular" as const, claimed: 0, claimableToday: true, endsAt: null, days: [], adClaimed: [], adClaimableToday: false };
    const entries = lobbyEventEntries([track], Date.parse("2026-10-01T00:00:00Z"));
    expect(entries[0].kind).toBe("attendance");
    expect(entries.slice(1).every(({ kind }) => kind === "event")).toBe(true);
  });
});
