import { FRIEND_POINTS_PER_RENTAL, helperRentalAvailability } from "../core/social";
import { PREVIEW_FRIENDS, type FriendProfile } from "../data/friends";

/** 친구 화면이 실제 계정 서버로 교체되어도 유지할 최소 응답 계약이다. */
export interface FriendListResponse { friends: FriendProfile[]; friendPoints: number; helperUsesToday: number; }
/** 대여 확정 뒤 양쪽 지급과 남은 일일 횟수를 UI가 그대로 표시하도록 반환한다. */
export interface RentHelperResponse { friendId: string; relicId: string; renterPointsEarned: number; ownerPointsEarned: number; friendPoints: number; remaining: number; }

/** 소셜 요청에서 예상 가능한 거절을 화면 문구와 구분하기 위한 오류다. */
export class SocialApiError extends Error {
  constructor(public readonly code: "FRIEND_NOT_FOUND" | "DAILY_HELPER_LIMIT", message: string) { super(message); this.name = "SocialApiError"; }
}

/**
 * 백엔드 전환 전 목록→프로필→대여 흐름을 실행 가능하게 하는 메모리 어댑터다.
 * 임시 데이터이며 새로고침 시 초기화된다. 영구 지급은 인증된 서버의 원자 처리로 교체해야 한다.
 */
export class FakeSocialServer {
  private friendPoints = 120;
  private helperUsesToday = 0;

  /** 화면이 내부 배열을 바꾸지 못하도록 친구 프로필을 복사해 반환한다. */
  async getFriends(): Promise<FriendListResponse> {
    // 공개 화이트리스트의 모든 중첩 값도 복사해 실제 JSON 응답처럼 호출자가 서버 원본을 바꿀 수 없게 한다.
    const friends = PREVIEW_FRIENDS.map((friend): FriendProfile => ({ ...friend, equippedModifiers: friend.equippedModifiers.map((modifier) => ({ ...modifier })), favoriteRelic: { ...friend.favoriteRelic, stats: { ...friend.favoriteRelic.stats }, skillIds: [...friend.favoriteRelic.skillIds] }, competitiveStats: { ...friend.competitiveStats, highestStage: friend.competitiveStats.highestStage ? { ...friend.competitiveStats.highestStage } : undefined, arenaTier: friend.competitiveStats.arenaTier ? { ...friend.competitiveStats.arenaTier } : undefined } }));
    return { friends, friendPoints: this.friendPoints, helperUsesToday: this.helperUsesToday };
  }

  /** 일일 제한 확인, 양쪽 포인트 지급, 사용 횟수 증가를 실제 서버의 단일 처리처럼 묶는다. */
  async rentFavoriteRelic(friendId: string): Promise<RentHelperResponse> {
    const friend = PREVIEW_FRIENDS.find((candidate) => candidate.id === friendId);
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
