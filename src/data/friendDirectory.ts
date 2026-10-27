import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { applyLevelGrowth } from "../core/relicProgression";
import type { FriendRelation } from "../core/social";
import { PREVIEW_FRIENDS, type FriendProfile } from "./friends";
import { getRelic } from "./relics";

/** 임시 서버가 처음 깔아 두는 관계. 실서버에서는 계정마다 서버에 저장된 값이다. */
export interface PreviewDirectoryEntry {
  profile: FriendProfile;
  relation: FriendRelation;
  /** 친구일 때 처음부터 즐겨찾기인가. */
  favorite?: boolean;
  /** 신청이 오가던 시각(ms). 신청 목록은 이 순서로 선다. */
  requestedAt?: number;
}

const NOW = Date.now();
const MINUTE = 60_000;

function preview(
  id: string, uid: string, displayName: string, level: number, frameId: string, status: string,
  relicId: string, relicLevel: number, breakthroughGrade: number, lastActiveAt: number,
): FriendProfile {
  const relic = getRelic(relicId);
  return {
    id, uid, frameId, displayName, level, status, lastActiveAt,
    equippedModifiers: [],
    favoriteRelic: {
      relicId, level: relicLevel, breakthroughGrade,
      stats: applyLevelGrowth(relic.stats, relicLevel, relic.rarity),
      skillIds: [`${relicId}-basic`, `${relicId}-passive`, `${relicId}-ultimate`],
    },
    competitiveStats: {},
  };
}

/**
 * 찾기·신청·친구 화면을 눈으로 확인하기 위한 **표본 이용자 풀**이다. QA 빌드에서만 선다 —
 * 일반 빌드는 실서버가 붙기 전까지 아무도 찾지 못하는 빈 풀이다.
 *
 * 이름과 소개는 이용자가 직접 쓴 계정 글이라 번역 대상이 아니다.
 */
const SAMPLE_DIRECTORY: readonly PreviewDirectoryEntry[] = [
  { relation: "friend", profile: preview("friend-dawn", "275810396", "새벽표본", 22, "field", "아침 순찰 중", "parua", 20, 3, NOW - 3 * 60 * MINUTE) },
  { relation: "friend", favorite: true, profile: preview("friend-amber", "930274815", "호박상자", 35, "amber", "발굴 일지 정리", "stella", 32, 4, NOW - 2 * 24 * 60 * MINUTE) },
  { relation: "friend", profile: preview("friend-wave", "514602783", "파도소리", 14, "field", "천천히 키우는 중", "dodo", 12, 2, NOW - 20_000) },
  { relation: "incoming", requestedAt: NOW - 25 * MINUTE, profile: preview("user-fog", "187305926", "안개기록", 24, "holo", "같이 해요", "luka", 21, 3, NOW - 8 * MINUTE) },
  { relation: "incoming", requestedAt: NOW - 5 * 60 * MINUTE, profile: preview("user-sand", "706418259", "모래시계", 11, "field", "처음 시작했어요", "toby", 9, 1, NOW - 2 * 60 * MINUTE) },
  { relation: "outgoing", requestedAt: NOW - 3 * 60 * MINUTE, profile: preview("user-lighthouse", "362591048", "푸른등대", 40, "abyss", "레이드 같이 돌 분", "rex", 38, 5, NOW - 40_000) },
  { relation: "none", profile: preview("user-stars", "849062317", "별무리", 29, "holo", "표본 수집가", "torika", 26, 4, NOW - 15 * MINUTE) },
  { relation: "none", profile: preview("user-fern", "621874503", "고사리숲", 18, "field", "조용히 플레이", "kento", 16, 2, NOW - 26 * 60 * MINUTE) },
  { relation: "none", profile: preview("user-late", "453719806", "늦은표본", 31, "amber", "밤에 접속해요", "mosana", 28, 3, NOW - 4 * 24 * 60 * MINUTE) },
  { relation: "none", profile: preview("user-garden", "198456230", "정원사하루", 47, "garden", "정원 관리 중", "ella", 44, 5, NOW - 90_000) },
];

/**
 * 임시 서버가 아는 모든 이용자와 처음 관계. 기존 표본 친구 둘이 맨 앞에 선다.
 * 일반 빌드는 비어 있다.
 */
export const PREVIEW_DIRECTORY: readonly PreviewDirectoryEntry[] = QA_TOOLS_ENABLED
  ? [
    ...PREVIEW_FRIENDS.map((profile): PreviewDirectoryEntry => ({ profile, relation: "friend", favorite: profile.id === "friend-haneul" })),
    ...SAMPLE_DIRECTORY,
  ]
  : [];
