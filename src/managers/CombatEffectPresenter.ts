import type { ActiveCombatDisplayEffect, CombatEffectCue } from "../core/combatEffects";
import type { SkirmishEvent } from "../core/skirmish";
import { COLOR } from "../ui/theme";
import type { EffectManager } from "./EffectManager";

/** 표현 계층이 코어 전투원의 화면 좌표를 읽기 위한 최소 계약이다. */
export interface CombatEffectTarget {
  id: string; x: number; y: number; height: number; alive: boolean;
  /** 유지 여부와 효과 ID는 코어 상태가 소유한다. presenter는 수명 타이머를 만들지 않는다. */
  activeEffects: readonly ActiveCombatDisplayEffect[];
  /** 속성·직군 혼합색은 UI의 단일 규칙인 `skillArtTint()`에서 계산해 주입한다. */
  effectTint: number;
}

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
    if (cue.tag === "stealthActive" || cue.tag === "metteStaccatoActive" || cue.tag === "lukaSharedTargetHasteActive") return;
    const rule = TRANSIENT_EFFECT[cue.tag];
    this.effects.combat(rule.method, target.x, target.y - target.height * 0.5, { color: rule.color, intensity: cue.intensity });
  }

  /** 유지형 표시는 타이머가 아니라 매 프레임 코어가 준 활성 목록으로 생성·이동·회수한다. */
  sync(targets: readonly CombatEffectTarget[]): void {
    const byId = new Map(targets.map((target) => [target.id, target]));
    this.effects.syncSustained(targets.flatMap((target) => target.alive ? target.activeEffects.map((effect) => {
      const aim = effect.aimTargetId ? byId.get(effect.aimTargetId) : undefined;
      return { fighterId: target.id, effectId: effect.id, tag: effect.tag, x: target.x, y: target.y - target.height * 0.5,
        aimX: aim?.x, aimY: aim ? aim.y - aim.height * 0.5 : undefined, color: target.effectTint };
    }) : []));
  }

  /** Puppet 교체나 사망 직후 남은 유지 오브젝트를 즉시 제거한다. */
  remove(id: string): void { this.effects.removeSustainedForFighter(id); }
}
