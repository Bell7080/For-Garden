import { RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import { highestClearedStage } from "../core/stageProgress";
import type { PortraitAssetId } from "../core/types";
import type { Session } from "./session";

/** TopBar와 정보창이 공유하는 공개 표시 전용 모델이며 인증·계정 내부 키는 의도적으로 없다. */
export interface PlayerProfileDisplay {
  displayName: string;
  level: number;
  experience: number;
  experienceToNext: number;
  displayId: string;
  avatarAssetKey?: string;
  profileFrameKey: string;
  representativeRelic: string;
  /** 경쟁/기록 UI가 세션 원본이나 비공개 서버 응답을 다시 탐색하지 않게 만든 공개 스냅샷이다. */
  competitiveStats: PlayerCompetitiveStats;
  /** manager/API 경계에서 획득·장착 검증을 끝낸 뒤 전달되는 공개 수식어다. */
  equippedModifiers: PublicProfileModifier[];
}

/** 프로필의 네 기록을 위한 JSON 안전 공개 모델이며, 미배치 결투장 티어만 선택적으로 생략된다. */
export interface PlayerCompetitiveStats {
  favoriteRelic: { relicId: string; displayName: string; portraitAssetId: PortraitAssetId } | null;
  arenaTier?: { tierId: string; displayName: string };
  highestStage: { stageId: string; displayValue: string } | null;
  expedition: { label: "역대 최고"; score: number };
}

/** 문자열만 저장하지 않고 화면 의미와 안정적인 ID를 함께 보존하는 JSON 안전 공개 수식어다. */
export interface PublicProfileModifier {
  id: string;
  displayName: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  colorRole: "neutral" | "research" | "expedition" | "prestige";
}

/** 진행 수치를 제외한 공개 프로필의 비진행 표시 기본값이다. */
const DEFAULT_PUBLIC_PROFILE = {
  displayName: "연구원",
  profileFrameKey: "holo-cyan",
} as const;

/** 저장 가능한 공개 설정·애착 렐릭과 서버 확정 연구 진행만 읽어 안전한 표시 모델을 만든다. */
export function playerProfileDisplay(state: Session, equippedModifiers: readonly PublicProfileModifier[] = [], arenaTier?: { tierId: string; displayName: string }): PlayerProfileDisplay {
  // 손상되거나 구버전인 favorite ID도 공개 프로필 열기를 막지 않고 빈 애착으로 강등한다.
  const relic = RELICS.find(({ id }) => id === state.favorite);
  const stage = highestClearedStage(STAGES, state.cleared);
  return {
    ...DEFAULT_PUBLIC_PROFILE,
    // 화면은 경험치 공식이나 기본값을 소유하지 않고 API/manager 경계를 거친 세션 값을 표시한다.
    ...state.playerResearch,
    displayId: state.settings.account.displayId.trim() || "게스트",
    representativeRelic: relic?.name ?? "미지정",
    competitiveStats: {
      // 애착 ID와 공용 초상 에셋 ID만 공개하며, 정의가 손상된 ID면 이름만 추측하지 않고 항목을 비운다.
      favoriteRelic: relic ? { relicId: relic.id, displayName: relic.name, portraitAssetId: relic.portraitAssetId } : null,
      // 티어는 manager가 서버 응답에서 검증해 넘긴 경우에만 존재한다.
      ...(arenaTier ? { arenaTier: { ...arenaTier } } : {}),
      highestStage: stage ? { stageId: stage.id, displayValue: `${stage.id} ${stage.name}` } : null,
      // 장기 성취 프로필이므로 주간 초기화 값이 아닌 명시적인 역대 최고만 표시한다.
      expedition: { label: "역대 최고", score: Math.max(0, state.expedition.allTimeBestScore) },
    },
    // 이 함수는 표시 모델만 조립한다. 획득 여부를 알 수 있는 manager가 검증한 복사본만 받는다.
    equippedModifiers: equippedModifiers.map((modifier) => ({ ...modifier })),
  };
}

/** 실제 아바타 텍스처가 있을 때만 키를 쓰고, 없으면 표시 이름의 첫 글자로 되돌아간다. */
export function profileAvatarContent(profile: PlayerProfileDisplay, hasTexture: (key: string) => boolean): { assetKey?: string; fallback: string } {
  const fallback = Array.from(profile.displayName.trim())[0] ?? "?";
  return profile.avatarAssetKey && hasTexture(profile.avatarAssetKey)
    ? { assetKey: profile.avatarAssetKey, fallback }
    : { fallback };
}
