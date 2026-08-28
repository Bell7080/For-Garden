import type { GameSettings } from "../state/session";

/** Phaser나 저장소 없이도 서버·테스트가 함께 쓸 수 있는 설정 허용값이다. */
// 실제 전투 조작의 1→2→3배 순환과 저장 허용값을 같은 표로 맞춘다.
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export const TEXT_SPEEDS = [0.5, 1, 2] as const;
/** 글자가 화면을 밀어내지 않는 범위에서 제공하는 공용 텍스트 배율이다. */
export const TEXT_SCALES = [1, 1.15, 1.3] as const;

/** 새 계정과 손상 값 복구가 공유하되 호출자끼리 객체를 공유하지 않는 기본 설정을 만든다. */
export function createDefaultSettings(): GameSettings {
  return {
    sound: { masterVolume: 1, musicVolume: 0.8, effectsVolume: 0.8, voiceVolume: 0.8, masterMuted: false, musicMuted: false, effectsMuted: false, voiceMuted: false },
    vibration: { enabled: true, combatHit: true, ultimate: true, excavationResult: true, uiInput: true },
    notifications: { enabled: false, staminaFull: true, freeRecruit: true, dailyMission: true, event: true, mail: true, quietHours: true, quietHoursStart: "22:00", quietHoursEnd: "08:00", lastScheduledIds: {} },
    presentation: { screenShake: true, damageNumbers: true, shortenExcavation: false, lowSpecMode: false },
    accessibility: { textScale: 1, reduceMotion: false, reduceFlashes: false, colorAssist: false, subtitles: true },
    // 궁극기 스킵은 연출 품질이 아니라 전투 조작이며 기본적으로 완전한 시퀀스를 보여 준다.
    game: { battleSpeed: 1, autoUltimate: false, skipUltimatePresentation: false, textSpeed: 1, language: "ko" },
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
  const p = record(root.presentation); const x = record(root.accessibility); const g = record(root.game); const a = record(root.account);
  return {
    sound: { masterVolume: volume(s.masterVolume, d.sound.masterVolume), musicVolume: volume(s.musicVolume, d.sound.musicVolume), effectsVolume: volume(s.effectsVolume, d.sound.effectsVolume), voiceVolume: volume(s.voiceVolume, d.sound.voiceVolume), masterMuted: bool(s.masterMuted, d.sound.masterMuted), musicMuted: bool(s.musicMuted, d.sound.musicMuted), effectsMuted: bool(s.effectsMuted, d.sound.effectsMuted), voiceMuted: bool(s.voiceMuted, d.sound.voiceMuted) },
    vibration: { enabled: bool(v.enabled, d.vibration.enabled), combatHit: bool(v.combatHit, d.vibration.combatHit), ultimate: bool(v.ultimate, d.vibration.ultimate), excavationResult: bool(v.excavationResult, d.vibration.excavationResult), uiInput: bool(v.uiInput, d.vibration.uiInput) },
    notifications: { enabled: bool(n.enabled, d.notifications.enabled), staminaFull: bool(n.staminaFull, d.notifications.staminaFull), freeRecruit: bool(n.freeRecruit, d.notifications.freeRecruit), dailyMission: bool(n.dailyMission, d.notifications.dailyMission), event: bool(n.event, d.notifications.event), mail: bool(n.mail, d.notifications.mail), quietHours: bool(n.quietHours, d.notifications.quietHours), quietHoursStart: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(n.quietHoursStart)) ? String(n.quietHoursStart) : d.notifications.quietHoursStart, quietHoursEnd: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(n.quietHoursEnd)) ? String(n.quietHoursEnd) : d.notifications.quietHoursEnd, lastScheduledIds: Object.fromEntries(Object.entries(record(n.lastScheduledIds)).filter(([key, id]) => ["staminaFull", "freeRecruit", "dailyMission"].includes(key) && typeof id === "string" && id.length <= 120)) },
    presentation: { screenShake: bool(p.screenShake, d.presentation.screenShake), damageNumbers: bool(p.damageNumbers, d.presentation.damageNumbers), shortenExcavation: bool(p.shortenExcavation, d.presentation.shortenExcavation), lowSpecMode: bool(p.lowSpecMode, d.presentation.lowSpecMode) },
    accessibility: { textScale: allowed(x.textScale, TEXT_SCALES, d.accessibility.textScale), reduceMotion: bool(x.reduceMotion, d.accessibility.reduceMotion), reduceFlashes: bool(x.reduceFlashes, d.accessibility.reduceFlashes), colorAssist: bool(x.colorAssist, d.accessibility.colorAssist), subtitles: bool(x.subtitles, d.accessibility.subtitles) },
    game: { battleSpeed: allowed(g.battleSpeed, BATTLE_SPEEDS, d.game.battleSpeed), autoUltimate: bool(g.autoUltimate, d.game.autoUltimate),
      // 새 필드가 없을 때만 옛 `컷인 끄기`를 `전체 궁극 연출 스킵`으로 승격한다. 명시된 새 값이 언제나 우선한다.
      skipUltimatePresentation: typeof g.skipUltimatePresentation === "boolean" ? g.skipUltimatePresentation : p.ultimateCutIn === false,
      textSpeed: allowed(g.textSpeed, TEXT_SPEEDS, d.game.textSpeed), language: allowed(g.language, ["ko", "en", "ja"] as const, d.game.language) },
    // 인증 토큰은 이 모델에 애초에 자리를 만들지 않아 로컬 저장으로 새는 경로를 차단한다.
    account: { provider: allowed(a.provider, ["guest", "google", "apple"] as const, d.account.provider), displayId: typeof a.displayId === "string" && a.displayId.length <= 80 ? a.displayId : d.account.displayId },
  };
}
