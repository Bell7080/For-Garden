import type { PublicRelicProfileDto } from "../api/contracts";
import { getRelic } from "./relics";

/** 친구 목록과 프로필 화면이 공유하는 최소 공개 프로필이다. 실제 서비스에서는 서버 DTO로 교체한다. */
export interface FriendProfile {
  id: string;
  name: string;
  researcherLevel: number;
  status: string;
  favoriteRelic: PublicRelicProfileDto;
  lastActive: string;
}

/**
 * 백엔드 연동 전 화면 흐름을 검증하기 위한 임시 친구 명단이다.
 * 전투 능력치는 정적 렐릭 정의에서 읽고, 다른 이용자의 편성·재화 같은 비공개 값은 싣지 않는다.
 */
export const PREVIEW_FRIENDS: readonly FriendProfile[] = [
  previewFriend("friend-haneul", "하늘정원", 27, "새 표본의 흔적을 찾는 중", "rex", 24, "방금 전"),
  previewFriend("friend-moss", "이끼연구소", 19, "오늘도 천천히 복원", "anky", 18, "12분 전"),
  previewFriend("friend-tide", "푸른퇴적층", 31, "수로 조사대 모집 중", "spino", 28, "1시간 전"),
];

/** 임시 데이터도 실제 서버와 동일한 공개 필드 화이트리스트로 만든다. */
function previewFriend(id: string, name: string, researcherLevel: number, status: string, relicId: string, level: number, lastActive: string): FriendProfile {
  const relic = getRelic(relicId);
  const stars = relic.rarity === "SSR" ? 5 : relic.rarity === "SR" ? 4 : 3;
  return { id, name, researcherLevel, status, lastActive, favoriteRelic: { relicId, level, stars, stats: { ...relic.stats }, skillIds: [relic.basic.id, relic.passive.id, relic.ultimate.id] } };
}
