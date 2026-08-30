import { getRelic } from "../data/relics";
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
}

/** 아직 서버 플레이어 진행 DTO가 없는 빌드가 사용하는 공개 표시 기본값이다. */
const DEFAULT_PUBLIC_PROFILE = {
  displayName: "연구원",
  level: 1,
  experience: 0,
  experienceToNext: 100,
  profileFrameKey: "holo-cyan",
} as const;

/** 저장 가능한 공개 설정과 애착 렐릭만 읽어 UI에 건넬 안전한 표시 모델을 만든다. */
export function playerProfileDisplay(state: Session): PlayerProfileDisplay {
  const relic = getRelic(state.favorite);
  return {
    ...DEFAULT_PUBLIC_PROFILE,
    displayId: state.settings.account.displayId.trim() || "게스트",
    representativeRelic: relic?.name ?? "미지정",
  };
}

/** 실제 아바타 텍스처가 있을 때만 키를 쓰고, 없으면 표시 이름의 첫 글자로 되돌아간다. */
export function profileAvatarContent(profile: PlayerProfileDisplay, hasTexture: (key: string) => boolean): { assetKey?: string; fallback: string } {
  const fallback = Array.from(profile.displayName.trim())[0] ?? "?";
  return profile.avatarAssetKey && hasTexture(profile.avatarAssetKey)
    ? { assetKey: profile.avatarAssetKey, fallback }
    : { fallback };
}
