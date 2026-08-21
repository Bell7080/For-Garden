import type { AcquisitionResult } from "./gacha";
import type { RelicRarity } from "./types";

/** 서버 확정 뒤 재생되는 발굴 연출 순서. 결과 화면 전에는 카드 내용을 노출하지 않는다. */
export const EXCAVATION_STAGES = ["excavation", "crack", "rarityReveal", "firstMeeting", "cards"] as const;
export type ExcavationStage = typeof EXCAVATION_STAGES[number];

const RARITY_WEIGHT: Record<RelicRarity, number> = { R: 0, SR: 1, SSR: 2 };

/** 서버가 준 렐릭의 등급만 비교한다. 이 함수는 난수를 쓰거나 결과를 다시 추첨하지 않는다. */
export function highestRarity(rarities: readonly RelicRarity[]): RelicRarity {
  return rarities.reduce<RelicRarity>((best, rarity) =>
    RARITY_WEIGHT[rarity] > RARITY_WEIGHT[best] ? rarity : best, "R");
}

/** 10연에서 신규 렐릭은 슬롯 순서를 지키고 같은 id의 첫 대면은 한 번만 재생한다. */
export function firstMeetingRelicIds(results: readonly AcquisitionResult[]): string[] {
  const seen = new Set<string>();
  return results.filter((result) => result.kind === "new" && !seen.has(result.relicId) && seen.add(result.relicId))
    .map((result) => result.relicId);
}

/**
 * Phaser와 분리한 작은 상태 기계. `request`는 showcaseRequest처럼 늦게 끝난 비동기 단계가
 * 새 연출을 덮지 못하게 하며, invalidate 책임은 새 요청 시작과 씬 종료에 있다.
 */
export class ExcavationPresentationController {
  private request = 0;
  private index = 0;
  private skipped = false;

  begin(): number {
    this.request += 1;
    this.index = 0;
    this.skipped = false;
    return this.request;
  }

  get stage(): ExcavationStage { return EXCAVATION_STAGES[this.index]; }
  isCurrent(request: number): boolean { return request === this.request; }

  /** 현재 대기만 끝내고 다음 단계로 이동한다. 마지막 단계에서는 그대로 머문다. */
  advance(): ExcavationStage {
    this.index = Math.min(this.index + 1, EXCAVATION_STAGES.length - 1);
    return this.stage;
  }

  /** 저장된 결과에는 손대지 않고 남은 연출만 카드 단계까지 생략한다. */
  skipAll(): ExcavationStage {
    this.skipped = true;
    this.index = EXCAVATION_STAGES.length - 1;
    return this.stage;
  }

  get wasSkipped(): boolean { return this.skipped; }
  invalidate(): void { this.request += 1; }
}
