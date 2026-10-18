import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import {
  ATTENDANCE_DAYS, attendanceClaimable, attendanceTrackView, claimAttendanceAdBonus, claimAttendanceDay, createEmptyAttendanceState, isValidAttendanceState,
  REGULAR_ATTENDANCE_WINDOW_DAYS, rollAttendance, type AttendanceState,
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

  it("신규는 기한이 없고, 다 받은 다음 날부터 서지 않는다", () => {
    const { state, claims } = walk(10, [], "newcomer");
    expect(claims).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(attendanceTrackView(rollAttendance(state, day(9)), "newcomer", day(9)).open).toBe(false);
    const idle = rollAttendance(createEmptyAttendanceState(), day(0));
    expect(attendanceTrackView(idle, "newcomer", day(400)).claimableToday).toBe(true);
    expect(attendanceTrackView(idle, "newcomer", day(400)).endsAt).toBeNull();
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
    expect(state.wallet.gems - gems).toBe(1_500);
    await server.claimAttendance({ trackId: "newcomer", requestId: "a" });
    expect(state.wallet.gems - gems).toBe(1_500);
    await expect(server.claimAttendance({ trackId: "newcomer", requestId: "b" })).rejects.toThrow();
    await server.markAttendanceAutoShown();
    expect((await server.getAttendance()).autoShow).toBe(false);
  });
});

describe("토벌권 덤", () => {
  it("난수 0에서는 떨어지지 않는다", () => {
    expect(rollRaidTicketDrops(createEmptyRaidTicketDropState(), 10, day(0), () => 0, true).drops).toEqual([]);
    expect(strataRaidTicketTile(() => 0, true)).toBeNull();
  });

  it("하루 상한을 넘지 않고, 날이 바뀌면 다시 센다 — 일반 토벌권만 나온다", () => {
    const always = () => 0.999;
    const first = rollRaidTicketDrops(createEmptyRaidTicketDropState(), 20, day(0), always, true);
    expect(first.drops).toEqual([{ itemId: RAID_TICKET_ITEM, amount: RAID_TICKET_DROP.dailyNormalCap }]);
    expect(rollRaidTicketDrops(first.state, 5, day(0), always, true).drops).toEqual([]);
    expect(rollRaidTicketDrops(first.state, 1, day(1), always, true).drops).toHaveLength(1);
  });

  it("레이드가 닫혀 있으면 굴리지도 세지도 않는다", () => {
    const empty = createEmptyRaidTicketDropState();
    const closed = rollRaidTicketDrops(empty, 20, day(0), () => 0.999, false);
    expect(closed.drops).toEqual([]);
    expect(closed.state).toEqual(empty);
    expect(strataRaidTicketTile(() => 0.999, false)).toBeNull();
    expect(strataRaidTicketTile(() => 0.999, true)).toBe(RAID_TICKET_ITEM);
  });

  it("선택 토벌권은 어디서도 떨어지지 않는다", () => {
    const always = () => 0.999;
    const ids = [...rollRaidTicketDrops(createEmptyRaidTicketDropState(), 50, day(0), always, true).drops.map((drop) => drop.itemId), strataRaidTicketTile(always, true)];
    expect(ids).not.toContain(RAID_SELECT_TICKET_ITEM);
  });
});

describe("출석 판·이벤트 목록", () => {
  it.each([false, true])("일곱 액자가 판 안에 들고 일곱째는 두 줄 사이 가운데에 서며 겹치지 않는다 (광고 덤 %s)", (withAd) => {
    const layout = attendancePanelLayout(withAd);
    expect(layout.tiles.map(({ day: value }) => value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // 일차 이름표와 광고 라벨은 모두 액자 왼쪽 위에 걸쳐 솟으므로 윗변을 그만큼 넓혀 잰다.
    const boxes = layout.tiles.flatMap((tile) => [
      { left: tile.x - tile.size / 2, right: tile.x + tile.size / 2, top: tile.y - tile.size / 2 - 24, bottom: tile.y + tile.size / 2 },
      ...(tile.adY !== undefined ? [{ left: tile.x - tile.size / 2, right: tile.x + tile.size / 2, top: tile.adY - tile.size / 2 - 24, bottom: tile.adY + tile.size / 2 }] : []),
    ]);
    expect(boxes).toHaveLength(withAd ? 14 : 7);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(-layout.width / 2 + 40);
      expect(box.right).toBeLessThanOrEqual(layout.width / 2 - 40);
      expect(box.top).toBeGreaterThan(layout.banner.y + layout.banner.height / 2);
      expect(box.bottom).toBeLessThan(layout.height / 2 - 40);
    }
    for (const a of boxes) for (const b of boxes) {
      if (a === b) continue;
      expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
    }
    for (const tile of layout.tiles) expect(Boolean(tile.adY)).toBe(withAd);
    const [first, , , fourth, , , finale] = layout.tiles;
    const groupMiddle = (tile: typeof finale) => (tile.y - tile.size / 2 + (tile.adY ?? tile.y) + tile.size / 2) / 2;
    expect(groupMiddle(finale)).toBeCloseTo((groupMiddle(first) + groupMiddle(fourth)) / 2, 5);
  });

  it("출석이 기간 이벤트보다 먼저 선다", () => {
    const track = { id: "regular" as const, claimed: 0, claimableToday: true, endsAt: null, days: [], adClaimed: [], adClaimableToday: false };
    const entries = lobbyEventEntries([track], Date.parse("2026-10-01T00:00:00Z"));
    expect(entries[0].kind).toBe("attendance");
    expect(entries.slice(1).every(({ kind }) => kind === "event")).toBe(true);
  });
});
