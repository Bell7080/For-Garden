import type { PublicProfileHeaderDto } from "../api/contracts";

/** 친구 목록과 프로필 화면이 공유하는 최소 공개 프로필이다. 실제 서비스에서는 서버 DTO로 교체한다. */
export interface FriendProfile extends PublicProfileHeaderDto {
  id: string;
  status: string;
  lastActive: string;
}

/**
 * 백엔드 연동 전 화면 흐름을 검증하기 위한 임시 친구 명단이다.
 * 전투 능력치는 정적 렐릭 정의에서 읽고, 다른 이용자의 편성·재화 같은 비공개 값은 싣지 않는다.
 */
export const PREVIEW_FRIENDS: readonly FriendProfile[] = [
  // 샘플도 공개 화이트리스트만 명시해 실제 응답에 계정 키·재화·편성이 섞이는 일을 조기에 드러낸다.
  { id: "friend-haneul", displayName: "하늘정원", level: 27, status: "새 표본의 흔적을 찾는 중", lastActive: "방금 전", equippedModifiers: [{ id: "field-pioneer", displayName: "현장 개척자", rarity: "rare" }], favoriteRelic: { relicId: "rex", level: 24, stars: 5, stats: { hp: 820, def: 42, res: 36, atk: 132, ap: 76, attackSpeed: 112, moveSpeed: 108, critChance: 20, critDamage: 160, energyGain: 28, lifeSteal: 0, ferocityGain: 0 }, skillIds: ["rex-basic", "rex-passive", "rex-ultimate"] }, competitiveStats: { highestStage: { stageId: "stage-2-5", displayValue: "2-5 붉은 협곡" }, arenaTier: { tierId: "gold-2", displayName: "골드 II" }, expeditionScore: 18420 } },
  // 두 번째 샘플은 선택 기록과 수식어가 없는 정상 응답을 검수하며 빈 상태 문구 대신 렌더링 생략을 확인한다.
  { id: "friend-moss", displayName: "이끼연구소", level: 19, status: "오늘도 천천히 복원", lastActive: "12분 전", equippedModifiers: [], favoriteRelic: { relicId: "anky", level: 18, stars: 4, stats: { hp: 1420, def: 128, res: 92, atk: 74, ap: 52, attackSpeed: 78, moveSpeed: 72, critChance: 5, critDamage: 140, energyGain: 20, lifeSteal: 0, ferocityGain: 0 }, skillIds: ["anky-basic", "anky-passive", "anky-ultimate"] }, competitiveStats: {} },
];
