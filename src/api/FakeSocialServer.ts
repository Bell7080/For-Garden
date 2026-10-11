import {
  FRIEND_LIMIT, FRIEND_POINTS_PER_RENTAL, FRIEND_REQUEST_LIMIT, helperRentalAvailability, matchesUserQuery,
  type FriendRelation, type UserSearchMode,
} from "../core/social";
import { PREVIEW_DIRECTORY } from "../data/friendDirectory";
import type { FriendProfile } from "../data/friends";

/** 친구 화면이 실제 계정 서버로 교체되어도 유지할 최소 응답 계약이다. */
export interface FriendListResponse {
  friends: FriendProfile[];
  /** 즐겨찾기로 둔 친구의 id. */
  favoriteIds: string[];
  friendPoints: number;
  helperUsesToday: number;
  friendLimit: number;
  /** 서버 시각(ms). 접속 중 표시와 「N분 전」은 기기 시계가 아니라 이 값으로 잰다. */
  serverTime: number;
}
/** 신청 한 건. 받은 신청과 보낸 신청 모두 상대의 공개 프로필을 싣는다. */
export interface FriendRequestEntry { profile: FriendProfile; requestedAt: number }
export interface FriendRequestsResponse {
  incoming: FriendRequestEntry[];
  outgoing: FriendRequestEntry[];
  requestLimit: number;
  serverTime: number;
}
/** 검색·추천 한 줄. 관계가 함께 와야 버튼 자리가 「신청」인지 「친구」인지 정해진다. */
export interface UserSearchEntry { profile: FriendProfile; relation: FriendRelation }
export interface UserSearchResponse { users: UserSearchEntry[]; serverTime: number }
/** 대여 확정 뒤 양쪽 지급과 남은 일일 횟수를 UI가 그대로 표시하도록 반환한다. */
export interface RentHelperResponse { friendId: string; relicId: string; renterPointsEarned: number; ownerPointsEarned: number; friendPoints: number; remaining: number; }
/** 수락·거절을 한꺼번에 처리한 몫. 상한에 걸려 남은 신청은 `skipped`다. */
export interface BulkRequestResponse { processed: number; skipped: number }

export type SocialErrorCode =
  | "FRIEND_NOT_FOUND" | "DAILY_HELPER_LIMIT" | "USER_NOT_FOUND" | "ALREADY_FRIEND" | "ALREADY_REQUESTED"
  | "REQUEST_NOT_FOUND" | "FRIEND_LIMIT" | "REQUEST_LIMIT" | "SELF_REQUEST";

/** 소셜 요청에서 예상 가능한 거절을 화면 문구와 구분하기 위한 오류다. */
export class SocialApiError extends Error {
  constructor(public readonly code: SocialErrorCode, message: string) { super(message); this.name = "SocialApiError"; }
}

/** 호출자가 서버 원본을 바꾸지 못하게 공개 프로필의 중첩 값까지 복사한다. */
function cloneProfile(friend: FriendProfile): FriendProfile {
  return {
    ...friend,
    equippedModifiers: friend.equippedModifiers.map((modifier) => ({ ...modifier })),
    favoriteRelic: { ...friend.favoriteRelic, stats: { ...friend.favoriteRelic.stats }, skillIds: [...friend.favoriteRelic.skillIds] },
    competitiveStats: {
      ...friend.competitiveStats,
      highestStage: friend.competitiveStats.highestStage ? { ...friend.competitiveStats.highestStage } : undefined,
      arenaTier: friend.competitiveStats.arenaTier ? { ...friend.competitiveStats.arenaTier } : undefined,
    },
  };
}

/** 추천은 최근 접속한 사람부터, 이만큼만 세운다. */
const RECOMMENDATION_COUNT = 10;

/**
 * 백엔드 전환 전 친구 목록→신청→찾기→프로필→대여 흐름을 실행 가능하게 하는 메모리 어댑터다.
 * 임시 데이터이며 새로고침 시 초기화된다. 영구 지급과 관계 변경은 인증된 서버의 원자 처리로 교체해야 한다.
 *
 * **서버가 붙으면 이 클래스의 메서드가 그대로 HTTP 호출이 된다.** 관계의 상한(친구 50 · 신청 30)과
 * 상호 신청의 자동 수락은 서버가 판정하고 화면은 결과만 그린다.
 */
export class FakeSocialServer {
  private friendPoints = 120;
  private helperUsesToday = 0;
  private readonly profiles = new Map<string, FriendProfile>();
  private readonly friendIds = new Set<string>();
  private readonly favoriteIds = new Set<string>();
  private readonly incoming = new Map<string, number>();
  private readonly outgoing = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly now: () => number = Date.now) {
    for (const entry of PREVIEW_DIRECTORY) {
      this.profiles.set(entry.profile.id, entry.profile);
      if (entry.relation === "friend") this.friendIds.add(entry.profile.id);
      if (entry.relation === "friend" && entry.favorite) this.favoriteIds.add(entry.profile.id);
      if (entry.relation === "incoming") this.incoming.set(entry.profile.id, entry.requestedAt ?? this.now());
      if (entry.relation === "outgoing") this.outgoing.set(entry.profile.id, entry.requestedAt ?? this.now());
    }
  }

  /** 받은 신청 수가 바뀔 때 부르는 신호. 로비 빨간 점이 이 신호로 다시 읽는다. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void { for (const listener of this.listeners) listener(); }

  /** 받은 신청 수. 알림 신호가 읽는 값이다. */
  pendingRequestCount(): number { return this.incoming.size; }

  private relationOf(userId: string): FriendRelation {
    if (this.friendIds.has(userId)) return "friend";
    if (this.incoming.has(userId)) return "incoming";
    if (this.outgoing.has(userId)) return "outgoing";
    return "none";
  }

  private profileOf(userId: string): FriendProfile {
    const profile = this.profiles.get(userId);
    if (!profile) throw new SocialApiError("USER_NOT_FOUND", "이용자 정보를 찾을 수 없습니다.");
    return profile;
  }

  async getFriends(): Promise<FriendListResponse> {
    const friends = [...this.friendIds].map((id) => cloneProfile(this.profileOf(id)));
    return { friends, favoriteIds: [...this.favoriteIds], friendPoints: this.friendPoints, helperUsesToday: this.helperUsesToday, friendLimit: FRIEND_LIMIT, serverTime: this.now() };
  }

  /** 받은 신청·보낸 신청. 둘 다 최근에 오간 것이 위다. */
  async getRequests(): Promise<FriendRequestsResponse> {
    const list = (source: Map<string, number>): FriendRequestEntry[] => [...source.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, requestedAt]) => ({ profile: cloneProfile(this.profileOf(id)), requestedAt }));
    return { incoming: list(this.incoming), outgoing: list(this.outgoing), requestLimit: FRIEND_REQUEST_LIMIT, serverTime: this.now() };
  }

  /** 이름(부분 일치) 또는 고유 ID(정확히 일치)로 찾는다. `selfUid`는 자기 자신을 결과에서 뺀다. */
  async searchUsers(request: { mode: UserSearchMode; query: string; selfUid?: string }): Promise<UserSearchResponse> {
    const users = [...this.profiles.values()]
      .filter((profile) => profile.uid !== request.selfUid && matchesUserQuery(profile, request.mode, request.query))
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((profile): UserSearchEntry => ({ profile: cloneProfile(profile), relation: this.relationOf(profile.id) }));
    return { users, serverTime: this.now() };
  }

  /** 아직 아무 관계도 아닌 이용자를 최근 접속순으로 추천한다. */
  async getRecommendations(selfUid?: string): Promise<UserSearchResponse> {
    const users = [...this.profiles.values()]
      .filter((profile) => profile.uid !== selfUid && this.relationOf(profile.id) === "none")
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .slice(0, RECOMMENDATION_COUNT)
      .map((profile): UserSearchEntry => ({ profile: cloneProfile(profile), relation: "none" }));
    return { users, serverTime: this.now() };
  }

  /**
   * 친구 신청. 상대가 이미 나에게 신청했다면 **서로 원한 것이라 곧바로 친구가 된다**.
   */
  async sendRequest(userId: string, selfUid?: string): Promise<{ relation: FriendRelation }> {
    const profile = this.profileOf(userId);
    if (profile.uid === selfUid) throw new SocialApiError("SELF_REQUEST", "자기 자신에게는 신청할 수 없습니다.");
    const relation = this.relationOf(userId);
    if (relation === "friend") throw new SocialApiError("ALREADY_FRIEND", "이미 친구입니다.");
    if (relation === "outgoing") throw new SocialApiError("ALREADY_REQUESTED", "이미 신청했습니다.");
    if (relation === "incoming") { await this.acceptRequest(userId); return { relation: "friend" }; }
    if (this.friendIds.size >= FRIEND_LIMIT) throw new SocialApiError("FRIEND_LIMIT", "친구 목록이 가득 찼습니다.");
    if (this.outgoing.size >= FRIEND_REQUEST_LIMIT) throw new SocialApiError("REQUEST_LIMIT", "보낸 신청이 너무 많습니다.");
    this.outgoing.set(userId, this.now());
    return { relation: "outgoing" };
  }

  /** 보낸 신청을 거둔다. */
  async cancelRequest(userId: string): Promise<void> {
    if (!this.outgoing.delete(userId)) throw new SocialApiError("REQUEST_NOT_FOUND", "취소할 신청이 없습니다.");
  }

  async acceptRequest(userId: string): Promise<void> {
    if (!this.incoming.has(userId)) throw new SocialApiError("REQUEST_NOT_FOUND", "받은 신청을 찾을 수 없습니다.");
    if (this.friendIds.size >= FRIEND_LIMIT) throw new SocialApiError("FRIEND_LIMIT", "친구 목록이 가득 찼습니다.");
    this.incoming.delete(userId);
    this.outgoing.delete(userId);
    this.friendIds.add(userId);
    this.emit();
  }

  async declineRequest(userId: string): Promise<void> {
    if (!this.incoming.delete(userId)) throw new SocialApiError("REQUEST_NOT_FOUND", "받은 신청을 찾을 수 없습니다.");
    this.emit();
  }

  /** 받은 신청을 오래된 순으로 모두 수락한다. 친구 상한에 닿으면 멈추고 남은 몫은 `skipped`다. */
  async acceptAllRequests(): Promise<BulkRequestResponse> {
    const ids = [...this.incoming.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    let processed = 0;
    for (const id of ids) {
      if (this.friendIds.size >= FRIEND_LIMIT) break;
      await this.acceptRequest(id);
      processed += 1;
    }
    return { processed, skipped: ids.length - processed };
  }

  async declineAllRequests(): Promise<BulkRequestResponse> {
    const processed = this.incoming.size;
    this.incoming.clear();
    if (processed > 0) this.emit();
    return { processed, skipped: 0 };
  }

  async setFavorite(friendId: string, favorite: boolean): Promise<void> {
    if (!this.friendIds.has(friendId)) throw new SocialApiError("FRIEND_NOT_FOUND", "친구 정보를 찾을 수 없습니다.");
    if (favorite) this.favoriteIds.add(friendId); else this.favoriteIds.delete(friendId);
  }

  /** 친구 관계만 끊는다. 상대가 다시 신청하면 받은 신청으로 들어온다. */
  async removeFriend(friendId: string): Promise<void> {
    if (!this.friendIds.delete(friendId)) throw new SocialApiError("FRIEND_NOT_FOUND", "친구 정보를 찾을 수 없습니다.");
    this.favoriteIds.delete(friendId);
  }

  /** 일일 제한 확인, 양쪽 포인트 지급, 사용 횟수 증가를 실제 서버의 단일 처리처럼 묶는다. */
  async rentFavoriteRelic(friendId: string): Promise<RentHelperResponse> {
    const friend = this.friendIds.has(friendId) ? this.profiles.get(friendId) : undefined;
    if (!friend) throw new SocialApiError("FRIEND_NOT_FOUND", "친구 정보를 찾을 수 없습니다.");
    const availability = helperRentalAvailability(this.helperUsesToday);
    if (!availability.allowed) throw new SocialApiError("DAILY_HELPER_LIMIT", "오늘의 조력자 대여를 모두 사용했습니다.");
    this.helperUsesToday += 1;
    this.friendPoints += FRIEND_POINTS_PER_RENTAL;
    return { friendId, relicId: friend.favoriteRelic.relicId, renterPointsEarned: FRIEND_POINTS_PER_RENTAL, ownerPointsEarned: FRIEND_POINTS_PER_RENTAL, friendPoints: this.friendPoints, remaining: helperRentalAvailability(this.helperUsesToday).remaining };
  }
}

/** 현재 브라우저 세션에서 친구 화면이 공유하는 임시 API 인스턴스다. */
export const socialApi = new FakeSocialServer();
