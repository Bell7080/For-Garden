import type { CombatEffectCue } from "../core/combatEffects";
import type { SkirmishEvent } from "../core/skirmish";
import { COLOR } from "../ui/theme";
import type { EffectManager } from "./EffectManager";

/** 표현 계층이 코어 전투원의 화면 좌표를 읽기 위한 최소 계약이다. */
export interface CombatEffectTarget { id: string; x: number; y: number; height: number; activeStealth: boolean; alive: boolean }

/**
 * 순수 태그를 기존 홀로그램 시각 언어로 번역하는 유일한 표다.
 * 스킬 이름 대신 강도만 배율로 받아 여러 스킬이 같은 메커니즘 표현을 공유한다.
 */
const TRANSIENT_EFFECT = {
  heal: { method: "heal", color: COLOR.hpFill },
  shieldGain: { method: "shieldGain", color: COLOR.energy },
  shieldHit: { method: "shieldHit", color: COLOR.energy },
  shieldBreak: { method: "shieldBreak", color: COLOR.danger },
  stealthEnter: { method: "stealthEnter", color: COLOR.inkDimHex },
  stealthExit: { method: "stealthExit", color: COLOR.inkDimHex },
} as const;

/** BattleScene의 사건 조건문과 Phaser 표현 세부사항 사이를 끊는 전투 표현 매퍼다. */
export class CombatEffectPresenter {
  constructor(private readonly effects: EffectManager) {}

  /** 태그가 실린 사건만 소비하며 숫자/HUD 갱신은 기존 정보 표현에 남긴다. */
  play(event: SkirmishEvent, target: CombatEffectTarget | undefined): boolean {
    if (!("effect" in event) || !target || !target.alive) return false;
    this.playCue(event.effect, target);
    return event.kind === "combatEffect";
  }

  private playCue(cue: CombatEffectCue, target: CombatEffectTarget): void {
    if (cue.tag === "stealthActive") return;
    const rule = TRANSIENT_EFFECT[cue.tag];
    this.effects.combat(rule.method, target.x, target.y - target.height * 0.5, { color: rule.color, intensity: cue.intensity });
  }

  /** 유지형 은신은 타이머가 아니라 매 프레임 실제 Fighter 상태로 생성·회수한다. */
  sync(targets: readonly CombatEffectTarget[]): void {
    this.effects.syncStealth(targets.map((target) => ({ id: target.id, x: target.x, y: target.y - target.height * 0.5, active: target.alive && target.activeStealth })));
  }

  /** Puppet 교체나 사망 직후 남은 유지 오브젝트를 즉시 제거한다. */
  remove(id: string): void { this.effects.removeStealth(id); }
}
