import { describe, expect, it } from "vitest";
import { FakeSocialServer } from "../../src/api/FakeSocialServer";

const SELF = "000000001";

describe("친구 신청 흐름", () => {
  it("이름과 고유 ID로 찾고 자기 자신은 뺀다", async () => {
    const s = new FakeSocialServer();
    const byName = await s.searchUsers({ query: "하늘" });
    expect(byName.users.map((u) => u.profile.id)).toContain("friend-haneul");
    const byUid = await s.searchUsers({ query: "418207735" });
    expect(byUid.users).toHaveLength(1);
    expect(byUid.users[0].relation).toBe("friend");
    const self = await s.searchUsers({ query: "418207735", selfUid: "418207735" });
    expect(self.users).toHaveLength(0);
  });

  it("신청하면 보낸 신청에 서고 취소하면 사라진다", async () => {
    const s = new FakeSocialServer();
    const target = (await s.getRecommendations(SELF)).users[0].profile.id;
    await s.sendRequest(target, SELF);
    expect((await s.getRequests()).outgoing.map((e) => e.profile.id)).toContain(target);
    await expect(s.sendRequest(target, SELF)).rejects.toMatchObject({ code: "ALREADY_REQUESTED" });
    await s.cancelRequest(target);
    expect((await s.getRequests()).outgoing.map((e) => e.profile.id)).not.toContain(target);
  });

  it("받은 신청을 수락하면 친구가 되고 거절하면 없어진다", async () => {
    const s = new FakeSocialServer();
    const { incoming } = await s.getRequests();
    expect(incoming.length).toBeGreaterThanOrEqual(2);
    const [first, second] = incoming.map((e) => e.profile.id);
    await s.acceptRequest(first);
    expect((await s.getFriends()).friends.map((f) => f.id)).toContain(first);
    await s.declineRequest(second);
    expect((await s.getFriends()).friends.map((f) => f.id)).not.toContain(second);
    expect((await s.getRequests()).incoming.map((e) => e.profile.id)).not.toContain(second);
    await expect(s.acceptRequest(first)).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND" });
  });

  it("서로 신청하면 곧바로 친구가 된다", async () => {
    const s = new FakeSocialServer();
    const id = (await s.getRequests()).incoming[0].profile.id;
    await s.sendRequest(id, SELF);
    expect((await s.getFriends()).friends.map((f) => f.id)).toContain(id);
  });

  it("모두 수락·모두 거절은 받은 신청을 비운다", async () => {
    const a = new FakeSocialServer();
    const n = (await a.getRequests()).incoming.length;
    expect(await a.acceptAllRequests()).toMatchObject({ processed: n, skipped: 0 });
    expect((await a.getRequests()).incoming).toHaveLength(0);
    const b = new FakeSocialServer();
    expect((await b.declineAllRequests()).processed).toBe(n);
  });

  it("즐겨찾기와 삭제는 친구 목록에 반영된다", async () => {
    const s = new FakeSocialServer();
    await s.setFavorite("friend-moss", true);
    expect((await s.getFriends()).favoriteIds).toContain("friend-moss");
    await s.removeFriend("friend-moss");
    const after = await s.getFriends();
    expect(after.friends.map((f) => f.id)).not.toContain("friend-moss");
    expect(after.favoriteIds).not.toContain("friend-moss");
    await expect(s.removeFriend("friend-moss")).rejects.toMatchObject({ code: "FRIEND_NOT_FOUND" });
  });

  it("접속 시각은 서버 시계를 따른다", async () => {
    const s = new FakeSocialServer(() => 42);
    expect((await s.getFriends()).serverTime).toBe(42);
  });
});
