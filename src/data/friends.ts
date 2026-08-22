/** 친구 목록과 프로필 화면이 공유하는 최소 공개 프로필이다. 실제 서비스에서는 서버 DTO로 교체한다. */
export interface FriendProfile {
  id: string;
  name: string;
  researcherLevel: number;
  status: string;
  favoriteRelicId: string;
  favoriteRelicLevel: number;
  lastActive: string;
}

/**
 * 백엔드 연동 전 화면 흐름을 검증하기 위한 임시 친구 명단이다.
 * 전투 능력치는 정적 렐릭 정의에서 읽고, 다른 이용자의 편성·재화 같은 비공개 값은 싣지 않는다.
 */
export const PREVIEW_FRIENDS: readonly FriendProfile[] = [
  { id: "friend-haneul", name: "하늘정원", researcherLevel: 27, status: "새 표본의 흔적을 찾는 중", favoriteRelicId: "rex", favoriteRelicLevel: 24, lastActive: "방금 전" },
  { id: "friend-moss", name: "이끼연구소", researcherLevel: 19, status: "오늘도 천천히 복원", favoriteRelicId: "anky", favoriteRelicLevel: 18, lastActive: "12분 전" },
  { id: "friend-tide", name: "푸른퇴적층", researcherLevel: 31, status: "수로 조사대 모집 중", favoriteRelicId: "spino", favoriteRelicLevel: 28, lastActive: "1시간 전" },
];
