import type { GameSettings } from "../state/session";

/** Phaser나 저장소 없이도 서버·테스트가 함께 쓸 수 있는 설정 허용값이다. */
export const BATTLE_SPEEDS = [1, 1.5, 2] as const;
export const TEXT_SPEEDS = [0.5, 1, 2] as const;

/** 새 계정과 손상 값 복구가 공유하되 호출자끼리 객체를 공유하지 않는 기본 설정을 만든다. */
export function createDefaultSettings(): GameSettings {
  return {
    sound: { masterVolume: 1, musicVolume: 0.8, effectsVolume: 0.8, voiceVolume: 0.8, masterMuted: false, musicMuted: false, effectsMuted: false, voiceMuted: false },
    vibration: { enabled: true, combatHit: true, ultimate: true, excavationResult: true, uiInput: true },
    notifications: { staminaFull: true, freeRecruit: true, dailyMission: true, event: true, mail: true, quietHours: true },
    presentation: { ultimateCutIn: true, screenShake: true, damageNumbers: true, shortenExcavation: false, lowSpecMode: false },
    game: { battleSpeed: 1, autoUltimate: false, textSpeed: 1, language: "ko" },
    account: { provider: "guest", displayId: "게스트" },
  };
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const bool = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const volume = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const allowed = <T extends string | number>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;

/** 오래된 부분 객체와 알 수 없는 열거형을 현재의 완전한 직렬화 모델로 안전하게 정규화한다. */
export function normalizeSettings(value: unknown): GameSettings {
  const d = createDefaultSettings(); const root = record(value);
  const s = record(root.sound); const v = record(root.vibration); const n = record(root.notifications);
  const p = record(root.presentation); const g = record(root.game); const a = record(root.account);
  return {
    sound: { masterVolume: volume(s.masterVolume, d.sound.masterVolume), musicVolume: volume(s.musicVolume, d.sound.musicVolume), effectsVolume: volume(s.effectsVolume, d.sound.effectsVolume), voiceVolume: volume(s.voiceVolume, d.sound.voiceVolume), masterMuted: bool(s.masterMuted, d.sound.masterMuted), musicMuted: bool(s.musicMuted, d.sound.musicMuted), effectsMuted: bool(s.effectsMuted, d.sound.effectsMuted), voiceMuted: bool(s.voiceMuted, d.sound.voiceMuted) },
    vibration: { enabled: bool(v.enabled, d.vibration.enabled), combatHit: bool(v.combatHit, d.vibration.combatHit), ultimate: bool(v.ultimate, d.vibration.ultimate), excavationResult: bool(v.excavationResult, d.vibration.excavationResult), uiInput: bool(v.uiInput, d.vibration.uiInput) },
    notifications: { staminaFull: bool(n.staminaFull, d.notifications.staminaFull), freeRecruit: bool(n.freeRecruit, d.notifications.freeRecruit), dailyMission: bool(n.dailyMission, d.notifications.dailyMission), event: bool(n.event, d.notifications.event), mail: bool(n.mail, d.notifications.mail), quietHours: bool(n.quietHours, d.notifications.quietHours) },
    presentation: { ultimateCutIn: bool(p.ultimateCutIn, d.presentation.ultimateCutIn), screenShake: bool(p.screenShake, d.presentation.screenShake), damageNumbers: bool(p.damageNumbers, d.presentation.damageNumbers), shortenExcavation: bool(p.shortenExcavation, d.presentation.shortenExcavation), lowSpecMode: bool(p.lowSpecMode, d.presentation.lowSpecMode) },
    game: { battleSpeed: allowed(g.battleSpeed, BATTLE_SPEEDS, d.game.battleSpeed), autoUltimate: bool(g.autoUltimate, d.game.autoUltimate), textSpeed: allowed(g.textSpeed, TEXT_SPEEDS, d.game.textSpeed), language: allowed(g.language, ["ko", "en", "ja"] as const, d.game.language) },
    // 인증 토큰은 이 모델에 애초에 자리를 만들지 않아 로컬 저장으로 새는 경로를 차단한다.
    account: { provider: allowed(a.provider, ["guest", "google", "apple"] as const, d.account.provider), displayId: typeof a.displayId === "string" && a.displayId.length <= 80 ? a.displayId : d.account.displayId },
  };
}
