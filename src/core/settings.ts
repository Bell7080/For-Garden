import type { GameSettings } from "../state/session";

/** Phaser나 저장소 없이도 서버·테스트가 함께 쓸 수 있는 설정 허용값이다. */
// 실제 전투 조작의 1→2→3배 순환과 저장 허용값을 같은 표로 맞춘다.
export const BATTLE_SPEEDS = [1, 2, 3] as const;
export const TEXT_SPEEDS = [0.5, 1, 2] as const;
/** 글자가 화면을 밀어내지 않는 범위에서 제공하는 공용 텍스트 배율이다. */
export const TEXT_SCALES = [1, 1.15, 1.3] as const;
/** 체력 게이지 반응과 전투 카메라가 함께 소비하는 움직임 강도다. */
export const BATTLE_UI_MOTIONS = ["default", "reduced", "off"] as const;
/** 저장 보정과 렌더 정책이 공유하는 품질·프레임 허용 목록이다. */
export const GRAPHICS_QUALITIES = ["high", "balanced", "low"] as const;
export const FRAME_RATE_LIMITS = [30, 60] as const;
export type GraphicsQuality = typeof GRAPHICS_QUALITIES[number];
export type BattleUiMotion = typeof BATTLE_UI_MOTIONS[number];

/** 렌더러마다 임의 수치를 고르지 않도록 저장 선택을 공용 배율로 바꾼다. */
export function battleUiMotionFactor(value: BattleUiMotion): number {
  return value === "default" ? 1 : value === "reduced" ? 0.4 : 0;
}

/** 저장 토글 사이의 우선순위를 렌더러가 재해석하지 않도록 확정한 움직임 정책이다. */
export interface MotionPolicy {
  /** 전투 카메라 흔들림에만 곱하며, 화면 흔들림을 끄면 접근성 선택과 무관하게 항상 0이다. */
  cameraShakeFactor: number;
  /** 전투 게이지·카드 반응에만 쓰는 최종 강도다. */
  battleUiFactor: number;
  /** 팝업·전환을 포함한 비필수 이동 거리에 공통으로 곱한다. */
  nonEssentialDistanceFactor: number;
  /** 반복 애니메이션 횟수에 공통으로 곱하며 0은 추가 반복을 허용하지 않는다. */
  nonEssentialRepeatFactor: number;
  /** 기존 전투 UI 프리팹에 넘길 수 있도록 최종 강도를 저장 열거형으로 표현한다. */
  effectiveBattleUiMotion: BattleUiMotion;
}

/** 정책 계산에 필요한 저장 설정의 최소 읽기 계약이다. */
export interface MotionPolicySettings {
  presentation: Pick<GameSettings["presentation"], "screenShake" | "battleUiMotion">;
  accessibility: Pick<GameSettings["accessibility"], "reduceMotion">;
}

/** 절전 적용 대상 화면을 명시해 전투·서버 시계·보상 및 입력 경계가 실수로 들어오지 않게 한다. */
export type DecorativeSurface = "lobby" | "info" | "idleExcavation";

/** 비전투 장식만 소비하는 절전 예산이다. 0은 탭 비가시성에 따른 일시정지이지 저장 선택이 아니다. */
export interface PowerSavingPolicy {
  decorativeParticleFactor: number;
  hologramSweepFactor: number;
  idlePuppetUpdateFactor: number;
  pausedByVisibility: boolean;
}

/** 저장 의미를 섞지 않으면서 절전과 움직임 감소 중 더 강한 장식 제한을 고르는 순수 함수다. */
export function powerSavingPolicy(
  settings: Pick<GameSettings, "presentation" | "accessibility">,
  visibility: "visible" | "hidden" = "visible",
): PowerSavingPolicy {
  // 숨김은 사용자의 절전 선택과 별개인 런타임 정지이며 foreground 복귀 때 누락분을 재생하지 않는다.
  if (visibility === "hidden") return { decorativeParticleFactor: 0, hologramSweepFactor: 0, idlePuppetUpdateFactor: 0, pausedByVisibility: true };
  // reduceMotion은 동작 수 자체를 더 강하게 제한하지만 powerSaving의 저장값은 그대로 보존한다.
  const factor = settings.accessibility.reduceMotion ? 0.25 : settings.presentation.powerSaving ? 0.5 : 1;
  return { decorativeParticleFactor: factor, hologramSweepFactor: factor, idlePuppetUpdateFactor: factor, pausedByVisibility: false };
}

/** 대표 비전투 화면이 초당 허용하는 장식 갱신 횟수를 회귀 테스트가 공유한다. */
export function decorativeUpdateBudget(surface: DecorativeSurface, policy: PowerSavingPolicy): number {
  const normalUpdates = { lobby: 60, info: 60, idleExcavation: 60 } as const;
  return Math.round(normalUpdates[surface] * policy.idlePuppetUpdateFactor);
}

/** 화면 흔들림·전체 움직임 감소·전투 UI 강도의 우선순위를 한 번에 계산하는 순수 함수다. */
export function motionPolicy(settings: MotionPolicySettings): MotionPolicy {
  // 전체 움직임 감소는 비필수 거리와 반복을 함께 줄이고 전투 UI의 최대 강도를 `reduced`로 막는다.
  const globalFactor = settings.accessibility.reduceMotion ? 0.4 : 1;
  const requestedBattleUiFactor = battleUiMotionFactor(settings.presentation.battleUiMotion);
  const battleUiFactor = Math.min(requestedBattleUiFactor, globalFactor);
  const effectiveBattleUiMotion: BattleUiMotion = battleUiFactor === 0 ? "off" : battleUiFactor < 1 ? "reduced" : "default";
  return {
    // 화면 흔들림 끄기가 최우선이며, 켠 경우에만 전체 움직임 감소의 공통 배율을 적용한다.
    cameraShakeFactor: settings.presentation.screenShake ? globalFactor : 0,
    battleUiFactor,
    nonEssentialDistanceFactor: globalFactor,
    nonEssentialRepeatFactor: settings.accessibility.reduceMotion ? 0 : 1,
    effectiveBattleUiMotion,
  };
}

/** 품질 프리셋을 시간과 무관한 순수 렌더 작업량 예산으로 바꾼다. */
export function presentationPolicy(quality: GraphicsQuality) {
  // 게임플레이 코드는 이 반환값을 읽지 않고, 연출은 각 수치를 다시 해석하지 않는다.
  const budgets = {
    high: { particleRatio: 1, ringRatio: 1, fullBodyScale: 1, postProcessing: true, renderQuality: 1 },
    balanced: { particleRatio: 0.72, ringRatio: 0.75, fullBodyScale: 0.9, postProcessing: true, renderQuality: 0.9 },
    low: { particleRatio: 0.45, ringRatio: 0.5, fullBodyScale: 0.78, postProcessing: false, renderQuality: 0.75 },
  } as const;
  return budgets[quality];
}

export type ExcavationPresentationStage = "scan" | "crack" | "rarity" | "firstMeeting";

/** 연구 결과의 단계 이름을 실제 대기 시간으로 바꾸는 순수한 단일 시간표다. */
export function excavationStageDuration(stage: ExcavationPresentationStage, shortenExcavation: boolean): number {
  const normal: Record<ExcavationPresentationStage, number> = { scan: 650, crack: 700, rarity: 650, firstMeeting: 1200 };
  // 정보 카드는 생략하지 않고 각 단계의 읽을 수 있는 최소 시간만 보존한다.
  return shortenExcavation ? Math.max(240, Math.round(normal[stage] * 0.45)) : normal[stage];
}

export type SemanticColorKind = "element" | "rarity" | "status";

export type ColorAssistPattern = "none" | "dots" | "diagonal" | "crosshatch";

/** 알려진 게임 의미는 명시 표에 고정해 표시가 문자열 순서나 새 콘텐츠 추가에 흔들리지 않게 한다. */
const COLOR_ASSIST_MARKS: Record<SemanticColorKind, Record<string, { glyph: string; pattern: Exclude<ColorAssistPattern, "none"> }>> = {
  element: {
    fire: { glyph: "▲", pattern: "diagonal" }, water: { glyph: "●", pattern: "dots" },
    grass: { glyph: "◆", pattern: "crosshatch" }, earth: { glyph: "■", pattern: "dots" }, wind: { glyph: "✦", pattern: "diagonal" },
  },
  rarity: {
    R: { glyph: "◇", pattern: "dots" }, SR: { glyph: "◆", pattern: "diagonal" }, SSR: { glyph: "✦", pattern: "crosshatch" },
  },
  status: {
    buff: { glyph: "+", pattern: "dots" }, debuff: { glyph: "−", pattern: "diagonal" },
    claimable: { glyph: "!", pattern: "crosshatch" }, claimed: { glyph: "×", pattern: "diagonal" }, normal: { glyph: "·", pattern: "dots" },
    up: { glyph: "+", pattern: "dots" }, down: { glyph: "−", pattern: "diagonal" },
  },
};

/** 색각 보조를 홀로그램 색 위에 겹칠 공용 비색상 표식으로 변환한다. */
export function colorAssistPolicy(enabled: boolean, kind: SemanticColorKind, value: string) {
  if (!enabled) return { glyph: "", pattern: "none" as const };
  const known = COLOR_ASSIST_MARKS[kind][value];
  if (known) return known;
  const glyphs: Record<SemanticColorKind, readonly string[]> = { element: ["◆", "▲", "●", "✦", "■"], rarity: ["◇", "◆", "✦"], status: ["+", "−", "!", "×"] };
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
    presentation: { screenShake: true, damageNumbers: true, shortenExcavation: false, battleUiMotion: "default", powerSaving: false, graphicsQuality: "high", frameRateLimit: 60 },
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
    presentation: { screenShake: bool(p.screenShake, d.presentation.screenShake), damageNumbers: bool(p.damageNumbers, d.presentation.damageNumbers), shortenExcavation: bool(p.shortenExcavation, d.presentation.shortenExcavation), powerSaving: bool(p.powerSaving, d.presentation.powerSaving),
      // 필드가 없던 모든 저장은 기존 연출과 같은 기본 강도로 명시 이관한다.
      battleUiMotion: allowed(p.battleUiMotion, BATTLE_UI_MOTIONS, d.presentation.battleUiMotion),
      // 새 명시값이 있으면 예전 토글보다 우선하고, 없을 때만 true를 low로 이관한다.
      graphicsQuality: allowed(p.graphicsQuality, GRAPHICS_QUALITIES, p.lowSpecMode === true ? "low" : d.presentation.graphicsQuality),
      frameRateLimit: allowed(p.frameRateLimit, FRAME_RATE_LIMITS, d.presentation.frameRateLimit) },
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
