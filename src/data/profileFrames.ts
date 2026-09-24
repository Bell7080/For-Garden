import { registerDataText } from "../i18n";

/**
 * 프로필 테두리 — 연구원 레벨이 여는 치장.
 *
 * 수집형 RPG의 프로필 테두리는 대개 **오래 한 흔적**이다(레벨·업적·시즌). 여기서는 레벨이 연다:
 * 레벨이 곧 얼마나 오래 싸웠는가라, 테두리 하나가 그 계정의 연차를 한눈에 말한다.
 * 저장에는 ID만 남고 이름·색은 이 표에서만 읽는다.
 */
export interface ProfileFrameDefinition {
  readonly id: string;
  displayName: string;
  /** 이 레벨에 닿으면 고를 수 있다. */
  readonly unlockLevel: number;
  /** 테두리 선과 발광의 색. */
  readonly color: number;
  /** 액자 안쪽을 은은하게 물들이는 색. */
  readonly wash: number;
  /**
   * 장식의 생김새. 색만 다른 테두리 여섯 장은 "테두리"가 아니라 "색"으로 읽힌다 — 수집형 RPG의
   * 아이콘 테두리가 레벨마다 모양 자체가 화려해지듯 여기도 레벨이 오를수록 장식이 늘어난다.
   */
  readonly style: ProfileFrameStyle;
}

export type ProfileFrameStyle = "plain" | "bracket" | "gem" | "wing" | "vine" | "crown";

export const DEFAULT_PROFILE_FRAME_ID = "field";

export const PROFILE_FRAMES: readonly ProfileFrameDefinition[] = [
  { id: "field", style: "plain", displayName: "현장 연구원", unlockLevel: 1, color: 0x9fb3c8, wash: 0x2a3644 },
  { id: "holo", style: "bracket", displayName: "투영 관측", unlockLevel: 10, color: 0x5fd4ff, wash: 0x173848 },
  { id: "amber", style: "gem", displayName: "호박 표본", unlockLevel: 20, color: 0xf2b441, wash: 0x3d2c12 },
  { id: "abyss", style: "wing", displayName: "심해 기록", unlockLevel: 30, color: 0xb07cff, wash: 0x2a1c44 },
  { id: "garden", style: "vine", displayName: "정원 수호", unlockLevel: 45, color: 0x57e0a0, wash: 0x143a2c },
  { id: "eternal", style: "crown", displayName: "이터널", unlockLevel: 60, color: 0xff6f6f, wash: 0x42161c },
];

export function findProfileFrame(id: string): ProfileFrameDefinition | undefined {
  return PROFILE_FRAMES.find((frame) => frame.id === id);
}

/** 손상·삭제된 ID는 기본 테두리로 강등한다. */
export function profileFrameOrDefault(id: string): ProfileFrameDefinition {
  return findProfileFrame(id) ?? PROFILE_FRAMES[0];
}

export function isProfileFrameUnlocked(frame: ProfileFrameDefinition, playerLevel: number): boolean {
  return playerLevel >= frame.unlockLevel;
}

for (const frame of PROFILE_FRAMES) registerDataText(frame, "displayName", `profileFrame.${frame.id}.name`);
