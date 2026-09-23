import { describe, expect, it } from "vitest";
import { normalizePartyContent, partyPreview } from "../../src/data/partyContent";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import { CHAPTERS } from "../../src/data/stages";
import { RAID_SEASON_BOSS } from "../../src/data/raid";
import type { BattleStageDef } from "../../src/core/types";
import { isGrowthReachable } from "../../src/core/relicProgression";

const STAGE = CHAPTERS.flatMap(({ stages }) => stages).find((stage): stage is BattleStageDef => stage.kind === "battle")!;

describe("편성 화면의 콘텐츠", () => {
  it("정보창에 서는 적의 레벨은 제 돌파 상한을 넘지 않는다", () => {
    // 레이드 보스가 LV.48에 돌파 2(상한 40)로 서 있었다 — 만들 수 없는 성장을 화면이 말했다.
    const contents = [
      { content: "raid" } as const,
      ...BOUNTY_TIERS.map((tier) => ({ content: "bounty", tierId: tier.id, multiplier: 1 }) as const),
      ...CAKE_OPERATION_TIERS.map((tier) => ({ content: "cake", tierId: tier.id, multiplier: 1 }) as const),
    ];
    for (const content of contents) {
      for (const { def, level, breakthrough } of partyPreview(content, STAGE).shown) {
        expect(isGrowthReachable(level, breakthrough), `${content.content} ${def.id} LV.${level} 돌파 ${breakthrough}`).toBe(true);
      }
    }
  });

  it("모르는 값·없는 단계는 스토리로 수렴하고 배율은 표에 있는 값으로 좁힌다", () => {
    expect(normalizePartyContent(undefined)).toEqual({ content: "stage" });
    expect(normalizePartyContent({ content: "cake", tierId: "없는-단계", multiplier: 2 })).toEqual({ content: "stage" });
    expect(normalizePartyContent({ content: "bounty", tierId: BOUNTY_TIERS[0].id, multiplier: 9 })).toEqual({ content: "bounty", tierId: BOUNTY_TIERS[0].id, multiplier: 1 });
    expect(normalizePartyContent({ content: "raid" })).toEqual({ content: "raid" });
  });

  it("현상수배는 세 라운드의 정예가 라운드 번호를 달고 선다", () => {
    const preview = partyPreview({ content: "bounty", tierId: BOUNTY_TIERS[0].id, multiplier: 1 }, STAGE);
    expect(preview.shown.map(({ round }) => round)).toEqual([1, 2, 3]);
    expect(preview.shown.map(({ def }) => def.id)).toEqual(BOUNTY_TIERS[0].rounds.map(({ relicId }) => relicId));
    expect(preview.role).toBe("normal");
  });

  it("대작전은 대표 얼굴 다섯만 세우고 몰려오는 수 전부를 따로 든다", () => {
    const tier = CAKE_OPERATION_TIERS[4];
    const preview = partyPreview({ content: "cake", tierId: tier.id, multiplier: 1 }, STAGE);
    expect(preview.shown).toHaveLength(5);
    expect(new Set(preview.shown.map(({ def }) => def.element)).size).toBe(5);
    expect(preview.all).toHaveLength(tier.enemyCount);
    expect(preview.hordeCount).toBe(tier.enemyCount);
    expect(preview.role).toBe("swarm");
  });

  it("레이드는 시즌 보스 하나가 레이드 유형으로 선다", () => {
    const preview = partyPreview({ content: "raid" }, STAGE);
    expect(preview.shown).toHaveLength(1);
    expect(preview.shown[0].def.id).toBe(RAID_SEASON_BOSS.relicId);
    expect(preview.shown[0].level).toBe(RAID_SEASON_BOSS.level);
    expect(preview.role).toBe("endless");
  });
});
