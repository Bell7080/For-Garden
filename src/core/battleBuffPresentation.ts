import type { ActiveCombatBuff } from "./skirmish";
import { t } from "../i18n";

/** Phaser와 무관한 버프 칩 진행 표시 모델이다. 각도는 12시를 0으로 한 시계 방향 회전수다. */
export interface BattleBuffProgressModel {
  kind: "countdown" | "conditional" | "permanent";
  remainingRatio: number;
  /** 12시부터 시계 방향으로 이미 비워진 회전수다. */
  elapsedTurns: number;
  conditionLabel?: string;
}

/**
 * 버프가 **무엇을 올리는가**. 칩의 바탕색이 이 계열을 말한다 — 같은 렐릭이 건 버프라도 속도와
 * 회복이 같은 색이면 칩 넷이 한 덩어리로 보인다(예전에는 렐릭 색 하나로 칠해 그랬다).
 */
export type BattleBuffCategory = "attack" | "speed" | "defense" | "heal" | "special";

/**
 * 칩 안에 서는 그림. `skill`이면 그 버프를 건 **스킬의 일러스트**를 세우고, 나머지는 증강처럼
 * 제 그림이 없는 버프가 쓰는 공용 문양이다(`src/ui/statusGlyphShapes.ts`의 `BUFF_GLYPHS`).
 */
export type BattleBuffGlyphId =
  | "haste" | "killHaste" | "regen" | "guard" | "rage" | "streak" | "warmUp" | "critical"
  | "counter" | "devour" | "bleed" | "curse" | "focus" | "special";

export interface BattleBuffVisual {
  category: BattleBuffCategory;
  glyph: BattleBuffGlyphId | "skill";
  /** 스킬 그림이 없을 때 대신 서는 문양. */
  fallback: BattleBuffGlyphId;
}

/** 코어가 붙이는 ID 머리(`가속:파치`의 `trait-haste`)마다 계열과 그림. 설명 문자열에는 기대지 않는다. */
const KIT_VISUAL: Readonly<Record<string, Omit<BattleBuffVisual, "fallback"> & { fallback?: BattleBuffGlyphId }>> = {
  "trait-haste": { category: "speed", glyph: "haste" },
  "luka-passive": { category: "speed", glyph: "skill", fallback: "haste" },
  "kill-haste": { category: "speed", glyph: "killHaste" },
  "many-eyes": { category: "speed", glyph: "haste" },
  "ingredient-haste": { category: "speed", glyph: "skill", fallback: "haste" },
  "augment-warm-up": { category: "speed", glyph: "warmUp" },
  "hastened-attacks": { category: "speed", glyph: "skill", fallback: "haste" },
  "trait-regen": { category: "heal", glyph: "regen" },
  elation: { category: "heal", glyph: "skill", fallback: "regen" },
  "augment-guard": { category: "defense", glyph: "guard" },
  "undying-guard": { category: "defense", glyph: "guard" },
  bulwark: { category: "defense", glyph: "skill", fallback: "guard" },
  fortress: { category: "defense", glyph: "skill", fallback: "guard" },
  undying: { category: "defense", glyph: "skill", fallback: "guard" },
  prickle: { category: "defense", glyph: "skill", fallback: "guard" },
  "augment-low-hp-attack": { category: "attack", glyph: "rage" },
  "augment-streak": { category: "attack", glyph: "streak" },
  "vital-aim": { category: "attack", glyph: "streak" },
  "bleed-streak": { category: "attack", glyph: "bleed" },
  "augment-opening-crit": { category: "attack", glyph: "critical" },
  "augment-periodic-crit": { category: "attack", glyph: "critical" },
  "empowered-basic": { category: "attack", glyph: "critical" },
  "augment-nth-basic": { category: "attack", glyph: "counter" },
  "augment-current-hp-strike": { category: "attack", glyph: "devour" },
  "augment-bleed-on-attack": { category: "attack", glyph: "bleed" },
  "augment-curse-on-attack": { category: "attack", glyph: "curse" },
  "hit-count": { category: "attack", glyph: "skill", fallback: "counter" },
  pincer: { category: "attack", glyph: "skill", fallback: "counter" },
  "instant-butcher": { category: "attack", glyph: "skill", fallback: "counter" },
  "crescendo-staccato": { category: "attack", glyph: "skill", fallback: "critical" },
  volley: { category: "attack", glyph: "skill", fallback: "counter" },
  focus: { category: "attack", glyph: "focus" },
  shallows: { category: "special", glyph: "skill", fallback: "special" },
};

/** 버프 하나의 계열·그림. 모르는 ID는 그 스킬의 그림 + 특수 계열로 선다 — 새 버프도 칩은 빠지지 않는다. */
export function battleBuffVisual(buff: Pick<ActiveCombatBuff, "id">): BattleBuffVisual {
  const colon = buff.id.indexOf(":");
  const head = colon > 0 ? buff.id.slice(0, colon) : buff.id;
  // 발동형 증강의 N회 카운터는 증강 순번이 ID에 붙는다(`augment-every-3`).
  const known = KIT_VISUAL[head] ?? (head.startsWith("augment-every-") ? { category: "attack" as const, glyph: "counter" as const } : undefined);
  if (!known) return { category: "special", glyph: "skill", fallback: "special" };
  return { category: known.category, glyph: known.glyph, fallback: known.fallback ?? (known.glyph === "skill" ? "special" : known.glyph) };
}

/** 잘못된 서버 값도 액자 밖으로 그리지 않도록 남은 시간의 비율을 0~1로 고정한다. */
export function battleBuffRemainingRatio(remainingSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(remainingSeconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
}

/** 실제 시간이 없는 오라는 가짜 시계 대신 끊김 없는 활성 테두리와 해제 조건을 돌려준다. */
export function battleBuffProgress(timing: ActiveCombatBuff["timing"]): BattleBuffProgressModel {
  if (timing.kind === "conditional") {
    return { kind: "conditional", remainingRatio: 1, elapsedTurns: 0, conditionLabel: t("battle.buff.sameTarget") };
  }
  if (timing.kind === "permanent") return { kind: "permanent", remainingRatio: 1, elapsedTurns: 0 };
  const remainingRatio = battleBuffRemainingRatio(timing.remainingSeconds, timing.totalSeconds);
  return { kind: "countdown", remainingRatio, elapsedTurns: 1 - remainingRatio };
}

/** 작은 HUD에서는 숨기고 상세 팝업에서만 쓰는 한 자리 초 표기다. */
export function battleBuffTimingLabel(timing: ActiveCombatBuff["timing"]): string {
  const progress = battleBuffProgress(timing);
  if (progress.kind === "conditional") return progress.conditionLabel ?? t("battle.buff.conditional");
  if (progress.kind === "permanent") return t("battle.buff.permanent");
  // 위 두 분기가 실제 타이밍 판별자도 좁혀, 여기서는 시간형 두 종류만 남는다.
  if (timing.kind === "conditional" || timing.kind === "permanent") return t("battle.buff.permanent");
  return progress.remainingRatio <= 0 ? t("battle.buff.ended")
    : t("battle.buff.seconds", { seconds: Math.max(0, timing.remainingSeconds).toFixed(1) });
}
