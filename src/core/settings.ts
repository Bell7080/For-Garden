import type { GameSettings } from "../state/session";

/** Phaser나 저장소 없이도 서버·테스트가 함께 쓸 수 있는 설정 허용값이다. */
// 실제 전투 조작의 1→2→3배 순환과 저장 허용값을 같은 표로 맞춘다.
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export const TEXT_SPEEDS = [0.5, 1, 2] as const;
/** 글자가 화면을 밀어내지 않는 범위에서 제공하는 공용 텍스트 배율이다. */
export const TEXT_SCALES = [1, 1.15, 1.3] as const;
/** 체력 게이지 반응과 전투 카메라가 함께 소비하는 움직임 강도다. */
export const BATTLE_UI_MOTIONS = ["default", "reduced", "off"] as const;
export type BattleUiMotion = typeof BATTLE_UI_MOTIONS[number];

/** 렌더러마다 임의 수치를 고르지 않도록 저장 선택을 공용 배율로 바꾼다. */
export function battleUiMotionFactor(value: BattleUiMotion): number {
  return value === "default" ? 1 : value === "reduced" ? 0.4 : 0;
}

/** 저사양 선택을 모든 프레젠테이션 소비자가 공유하는 명시적 렌더 예산으로 바꾼다. */
export function presentationPolicy(lowSpecMode: boolean) {
  // 씬은 이 값을 다시 해석하지 않고 파티클·전신·후처리 경계에 그대로 전달한다.
  return lowSpecMode
    ? { particleRatio: 0.45, ringRatio: 0.5, fullBodyScale: 0.78, postProcessing: false, renderQuality: 0.75 } as const
    : { particleRatio: 1, ringRatio: 1, fullBodyScale: 1, postProcessing: true, renderQuality: 1 } as const;
}

export type ExcavationPresentationStage = "scan" | "crack" | "rarity" | "firstMeeting";

/** 연구 결과의 단계 이름을 실제 대기 시간으로 바꾸는 순수한 단일 시간표다. */
export function excavationStageDuration(stage: ExcavationPresentationStage, shortenExcavation: boolean): number {
  const normal: Record<ExcavationPresentationStage, number> = { scan: 650, crack: 700, rarity: 650, firstMeeting: 1200 };
  // 정보 카드는 생략하지 않고 각 단계의 읽을 수 있는 최소 시간만 보존한다.
  return shortenExcavation ? Math.max(240, Math.round(normal[stage] * 0.45)) : normal[stage];
}

export type SemanticColorKind = "element" | "rarity" | "status";

/** 색각 보조를 홀로그램 색 위에 겹칠 공용 비색상 표식으로 변환한다. */
export function colorAssistPolicy(enabled: boolean, kind: SemanticColorKind, value: string) {
  if (!enabled) return { glyph: "", pattern: "none" as const };
  const glyphs: Record<SemanticColorKind, readonly string[]> = {
    element: ["◆", "▲", "●", "✦", "■"], rarity: ["◇", "◆", "✦", "✦✦"], status: ["+", "−", "!", "×"],
  };
  // 안정적인 문자열 해시는 새 값에도 색과 무관한 동일 표식을 되돌려준다.
  const index = [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % glyphs[kind].length;
  return { glyph: glyphs[kind][index], pattern: (["dots", "diagonal", "crosshatch"] as const)[index % 3] };
}

/** 새 계정과 손상 값 복구가 공유하되 호출자끼리 객체를 공유하지 않는 기본 설정을 만든다. */
export function createDefaultSettings(): GameSettings {
  return {
    sound: { masterVolume: 1, musicVolume: 0.8, effectsVolume: 0.8, voiceVolume: 0.8, masterMuted: false, musicMuted: false, effectsMuted: false, voiceMuted: false },
    vibration: { enabled: true, combatHit: true, ultimate: true, excavationResult: true, uiInput: true },
    // 무료 모집·이벤트·우편은 현재 예약/서버 푸시 계약이 없어 선택값을 저장하지 않는다.
    notifications: { enabled: false, staminaFull: true, dailyMission: true, quietHours: true, quietHoursStart: "22:00", quietHoursEnd: "08:00", lastScheduledIds: {} },
    presentation: { screenShake: true, damageNumbers: true, shortenExcavation: false, lowSpecMode: false, battleUiMotion: "default" },
    // 현재 대사는 보이스의 보조 자막이 아니라 필수 진행 정보이므로 숨김 설정을 제공하지 않는다.
    accessibility: { textScale: 1, reduceMotion: false, reduceFlashes: false, colorAssist: false },
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
    notifications: { enabled: bool(n.enabled, d.notifications.enabled), staminaFull: bool(n.staminaFull, d.notifications.staminaFull), dailyMission: bool(n.dailyMission, d.notifications.dailyMission), quietHours: bool(n.quietHours, d.notifications.quietHours), quietHoursStart: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(n.quietHoursStart)) ? String(n.quietHoursStart) : d.notifications.quietHoursStart, quietHoursEnd: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(n.quietHoursEnd)) ? String(n.quietHoursEnd) : d.notifications.quietHoursEnd, lastScheduledIds: Object.fromEntries(Object.entries(record(n.lastScheduledIds)).filter(([key, id]) => ["staminaFull", "dailyMission"].includes(key) && typeof id === "string" && id.length <= 120)) },
    presentation: { screenShake: bool(p.screenShake, d.presentation.screenShake), damageNumbers: bool(p.damageNumbers, d.presentation.damageNumbers), shortenExcavation: bool(p.shortenExcavation, d.presentation.shortenExcavation), lowSpecMode: bool(p.lowSpecMode, d.presentation.lowSpecMode),
      // 필드가 없던 모든 저장은 기존 연출과 같은 기본 강도로 명시 이관한다.
      battleUiMotion: allowed(p.battleUiMotion, BATTLE_UI_MOTIONS, d.presentation.battleUiMotion) },
    // 구버전의 subtitles 값은 필수 본문을 감추는 잘못된 의미라 저장 모델로 이관하지 않고 폐기한다.
    accessibility: { textScale: allowed(x.textScale, TEXT_SCALES, d.accessibility.textScale), reduceMotion: bool(x.reduceMotion, d.accessibility.reduceMotion), reduceFlashes: bool(x.reduceFlashes, d.accessibility.reduceFlashes), colorAssist: bool(x.colorAssist, d.accessibility.colorAssist) },
    game: { battleSpeed: allowed(g.battleSpeed, BATTLE_SPEEDS, d.game.battleSpeed), autoUltimate: bool(g.autoUltimate, d.game.autoUltimate),
      // 새 필드가 없을 때만 옛 `컷인 끄기`를 `전체 궁극 연출 스킵`으로 승격한다. 명시된 새 값이 언제나 우선한다.
      skipUltimatePresentation: typeof g.skipUltimatePresentation === "boolean" ? g.skipUltimatePresentation : p.ultimateCutIn === false,
      textSpeed: allowed(g.textSpeed, TEXT_SPEEDS, d.game.textSpeed), language: allowed(g.language, ["ko", "en", "ja"] as const, d.game.language) },
    // 인증 토큰은 이 모델에 애초에 자리를 만들지 않아 로컬 저장으로 새는 경로를 차단한다.
    account: { provider: allowed(a.provider, ["guest", "google", "apple"] as const, d.account.provider), displayId: typeof a.displayId === "string" && a.displayId.length <= 80 ? a.displayId : d.account.displayId },
  };
}
