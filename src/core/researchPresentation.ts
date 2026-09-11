import type { QuantityRewardKind, ResearchGrade } from "./gacha";
import type { RelicRarity } from "./types";
import type { PullResultDto } from "../api/contracts";

/**
 * 서버 확정 뒤 재생되는 연구소 획득 연구의 연출 순서. 결과 화면 전에는 카드 내용을 노출하지 않는다.
 * CLAUDE.md의 용어 경계에 따라 이 런타임 전용 단계는 배치형 자원 `idleExcavation`과 이름을 공유하지 않는다.
 *
 * `chips`는 뒤집힌 칸이 깔린 결과판이고 `cards`는 그 칸이 전부 열린 상태다. **첫 대면은 단계가
 * 아니다** — 새로 만난 렐릭이 든 칸을 여는 그 순간의 연출이라, 자동으로 흘러가는 이 목록에
 * 끼우면 어느 칸에서 나왔는지와 무관하게 먼저 재생되어 칸을 열 이유가 사라진다.
 */
export const RESEARCH_PRESENTATION_STAGES = ["research", "crack", "rarityReveal", "chips", "cards"] as const;
export type ResearchPresentationStage = typeof RESEARCH_PRESENTATION_STAGES[number];

/**
 * 결과판의 칸 하나가 보여 주는 것.
 *
 * 뒤집힌 칸의 색은 `grade`가 정하고, 열었을 때 서는 것은 `kind`가 정한다 — 새로 만난 렐릭만
 * 카드로 서고 나머지는 전부 같은 액자 한 장이다. 렐릭 정의를 직접 읽지 않는 이유는 이 규칙이
 * 데이터 표가 늘어도 그대로여야 하기 때문이다.
 */
export type ResearchSlotView =
  | { kind: "relic"; relicId: string; grade: RelicRarity }
  | { kind: "fragment"; relicId: string; amount: number; grade: RelicRarity }
  | { kind: "dna"; amount: number; grade: "GRAY" }
  | { kind: "currency"; currency: QuantityRewardKind; amount: number; grade: "GRAY" };

/** 서버 슬롯을 결과판이 그대로 그릴 수 있는 표시 계약으로 바꾼다. 순서는 추첨 순서 그대로다. */
export function researchSlotViews(
  results: readonly PullResultDto[],
  rarityOf: (relicId: string) => RelicRarity,
): ResearchSlotView[] {
  return results.map((result) => {
    if (result.type === "currency") {
      return { kind: "currency", currency: result.currency, amount: result.amount, grade: "GRAY" } as const;
    }
    const grade = rarityOf(result.relicId);
    if (result.kind === "new") return { kind: "relic", relicId: result.relicId, grade } as const;
    // 별 다섯에 닿은 개체의 중복만 공용 DNA 조각이 된다. 그 칸은 개체가 아니라 재화를 말한다.
    if (result.kind === "overflow") return { kind: "dna", amount: result.overflowFragments, grade: "GRAY" } as const;
    return { kind: "fragment", relicId: result.relicId, amount: result.fragments, grade } as const;
  });
}

const RARITY_WEIGHT: Record<ResearchGrade, number> = { GRAY: 0, R: 1, SR: 2, SSR: 3 };

/** 서버가 준 렐릭의 등급만 비교한다. 이 함수는 난수를 쓰거나 결과를 다시 추첨하지 않는다. */
export function highestRarity(rarities: readonly ResearchGrade[]): ResearchGrade {
  return rarities.reduce<ResearchGrade>((best, rarity) =>
    RARITY_WEIGHT[rarity] > RARITY_WEIGHT[best] ? rarity : best, "GRAY");
}

/** 10연에서 신규 렐릭은 슬롯 순서를 지키고 같은 id의 첫 대면은 한 번만 재생한다. */
export function firstMeetingRelicIds(results: readonly PullResultDto[]): string[] {
  const seen = new Set<string>();
  return results.filter((result): result is Extract<PullResultDto, { type: "relic" }> => result.type === "relic")
    .filter((result) => result.kind === "new" && !seen.has(result.relicId) && seen.add(result.relicId))
    .map((result) => result.relicId);
}

/**
 * Phaser와 분리한 작은 상태 기계. `request`는 showcaseRequest처럼 늦게 끝난 비동기 단계가
 * 새 연출을 덮지 못하게 하며, invalidate 책임은 새 요청 시작과 씬 종료에 있다.
 */
export class ResearchPresentationController {
  private request = 0;
  private index = 0;
  private skipped = false;

  begin(): number {
    this.request += 1;
    this.index = 0;
    this.skipped = false;
    return this.request;
  }

  get stage(): ResearchPresentationStage { return RESEARCH_PRESENTATION_STAGES[this.index]; }
  isCurrent(request: number): boolean { return request === this.request; }

  /** 현재 대기만 끝내고 다음 단계로 이동한다. 마지막 단계에서는 그대로 머문다. */
  advance(): ResearchPresentationStage {
    this.index = Math.min(this.index + 1, RESEARCH_PRESENTATION_STAGES.length - 1);
    return this.stage;
  }

  /** 저장된 결과에는 손대지 않고 남은 연출만 카드 단계까지 생략한다. */
  skipAll(): ResearchPresentationStage {
    this.skipped = true;
    this.index = RESEARCH_PRESENTATION_STAGES.length - 1;
    return this.stage;
  }

  get wasSkipped(): boolean { return this.skipped; }
  invalidate(): void { this.request += 1; }
}
