import type { ActiveCombatBuff } from "./skirmish";

/** Phaser와 무관한 버프 칩 진행 표시 모델이다. 각도는 12시를 0으로 한 시계 방향 회전수다. */
export interface BattleBuffProgressModel {
  kind: "countdown" | "conditional" | "permanent";
  remainingRatio: number;
  /** 12시부터 시계 방향으로 이미 비워진 회전수다. */
  elapsedTurns: number;
  conditionLabel?: string;
}

/** 색을 보지 못해도 버프의 주효과를 읽을 수 있게 하는 작은 실루엣 분류다. */
export type BattleBuffEffectShape = "attack" | "speed" | "support" | "special";

/** 코어가 제공하는 안정적인 효과 ID를 시각 어휘로 바꾸며, 설명 문자열에는 의존하지 않는다. */
export function battleBuffEffectShape(buff: Pick<ActiveCombatBuff, "id" | "skillId" | "timing">): BattleBuffEffectShape {
  const key = `${buff.id}:${buff.skillId}`.toLowerCase();
  if (key.includes("packhunt") || key.includes("pack-hunt") || key.includes("haste")) return "speed";
  if (key.includes("staccato") || key.includes("crescendo")) return "attack";
  if (buff.timing.kind === "conditional" || buff.timing.kind === "permanent") return "support";
  return "special";
}

/** 잘못된 서버 값도 액자 밖으로 그리지 않도록 남은 시간의 비율을 0~1로 고정한다. */
export function battleBuffRemainingRatio(remainingSeconds: number, totalSeconds: number): number {
  if (!Number.isFinite(remainingSeconds) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, remainingSeconds / totalSeconds));
}

/** 실제 시간이 없는 오라는 가짜 시계 대신 끊김 없는 활성 테두리와 해제 조건을 돌려준다. */
export function battleBuffProgress(timing: ActiveCombatBuff["timing"]): BattleBuffProgressModel {
  if (timing.kind === "conditional") {
    return { kind: "conditional", remainingRatio: 1, elapsedTurns: 0, conditionLabel: "동일 표적 유지 중" };
  }
  if (timing.kind === "permanent") return { kind: "permanent", remainingRatio: 1, elapsedTurns: 0 };
  const remainingRatio = battleBuffRemainingRatio(timing.remainingSeconds, timing.totalSeconds);
  return { kind: "countdown", remainingRatio, elapsedTurns: 1 - remainingRatio };
}

/** 작은 HUD에서는 숨기고 상세 팝업에서만 쓰는 한 자리 초 표기다. */
export function battleBuffTimingLabel(timing: ActiveCombatBuff["timing"]): string {
  const progress = battleBuffProgress(timing);
  if (progress.kind === "conditional") return progress.conditionLabel ?? "조건 유지 중";
  if (progress.kind === "permanent") return "전투 중 유지";
  // 위 두 분기가 실제 타이밍 판별자도 좁혀, 여기서는 시간형 두 종류만 남는다.
  if (timing.kind === "conditional" || timing.kind === "permanent") return "전투 중 유지";
  return progress.remainingRatio <= 0 ? "종료" : `${Math.max(0, timing.remainingSeconds).toFixed(1)}초`;
}
