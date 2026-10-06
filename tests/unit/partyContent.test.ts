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
      ...(["easy", "normal", "hard", "rampage"] as const).map((difficulty) => ({ content: "raid", raidId: `r-${difficulty}`, bossRelicId: RAID_SEASON_BOSS.relicId, difficulty }) as const),
      ...BOUNTY_TIERS.map((tier) => ({ content: "bounty", tierId: tier.id }) as const),
      ...CAKE_OPERATION_TIERS.map((tier) => ({ content: "cake", tierId: tier.id }) as const),
    ];
    for (const content of contents) {
      for (const { def, level, breakthrough } of partyPreview(content, STAGE).shown) {
        expect(isGrowthReachable(level, breakthrough), `${content.content} ${def?.id} LV.${level} 돌파 ${breakthrough}`).toBe(true);
      }
    }
  });

  it("모르는 값·없는 단계는 스토리로 수렴하고 옛 배율 값은 버린다", () => {
    expect(normalizePartyContent(undefined)).toEqual({ content: "stage" });
    expect(normalizePartyContent({ content: "cake", tierId: "없는-단계" })).toEqual({ content: "stage" });
    expect(normalizePartyContent({ content: "bounty", tierId: BOUNTY_TIERS[0].id, multiplier: 9 })).toEqual({ content: "bounty", tierId: BOUNTY_TIERS[0].id });
    // 레이드는 어느 판인지까지 있어야 한다 — 판 ID나 난이도가 빠지면 어느 체력을 깎을지 모른다.
    expect(normalizePartyContent({ content: "raid" })).toEqual({ content: "stage" });
    expect(normalizePartyContent({ content: "raid", raidId: "r1", bossRelicId: "sukusuino", difficulty: "nope" })).toEqual({ content: "stage" });
    const raid = { content: "raid", raidId: "r1", bossRelicId: "sukusuino", difficulty: "hard" } as const;
    expect(normalizePartyContent(raid)).toEqual(raid);
  });

  it("현상수배는 세 라운드의 정예가 라운드 번호를 달고 선다", () => {
    const preview = partyPreview({ content: "bounty", tierId: BOUNTY_TIERS[0].id}, STAGE);
    expect(preview.shown.map(({ round }) => round)).toEqual([1, 2, 3]);
    expect(preview.shown.map(({ def }) => def?.id)).toEqual(BOUNTY_TIERS[0].rounds.map(({ relicId }) => relicId));
    expect(preview.role).toBe("normal");
  });

  it("대작전은 대표 얼굴 다섯만 세우고 몰려오는 수 전부를 따로 든다", () => {
    const tier = CAKE_OPERATION_TIERS[4];
    const preview = partyPreview({ content: "cake", tierId: tier.id}, STAGE);
    expect(preview.shown).toHaveLength(5);
    expect(new Set(preview.shown.map(({ def }) => def?.element)).size).toBe(5);
    expect(preview.all).toHaveLength(tier.enemyCount);
    expect(preview.hordeCount).toBe(tier.enemyCount);
    expect(preview.role).toBe("swarm");
  });

  it("레이드는 그 판의 보스 하나가 그 난이도의 레벨로 보스 유형으로 선다", () => {
    const preview = partyPreview({ content: "raid", raidId: "r1", bossRelicId: RAID_SEASON_BOSS.relicId, difficulty: "normal" }, STAGE);
    expect(preview.shown).toHaveLength(1);
    expect(preview.shown[0].def?.id).toBe(RAID_SEASON_BOSS.relicId);
    expect(preview.shown[0].level).toBe(30);
    expect(partyPreview({ content: "raid", raidId: "w", bossRelicId: RAID_SEASON_BOSS.relicId, difficulty: "rampage" }, STAGE).shown[0].level).toBe(RAID_SEASON_BOSS.level);
    // 판 안에서 눕지 않아도 공유 체력은 끝내 깎여 죽는다 — 불사가 아니라 보스(강인함만)다.
    expect(preview.role).toBe("boss");
    expect(preview.shown[0].def?.encounterRole).toBe("boss");
  });

  it("결투는 가려진 칸을 비워 두고 보이는 칸만 상성 계산에 넣는다", () => {
    const opponent = { id: "duel-npc-1", displayName: "x", score: 1500, totalPower: 9_999, units: [
      { relicId: "torika", level: 30, breakthrough: 1, power: 3000 },
      { relicId: null, level: 30, breakthrough: 1, power: 3300 },
      { relicId: "dodo", level: 30, breakthrough: 1, power: 3699 },
    ] };
    const content = normalizePartyContent({ content: "duel", opponent, attack: ["rex", 3] });
    expect(content).toMatchObject({ content: "duel", attack: ["rex"] });
    const preview = partyPreview(content, STAGE);
    expect(preview.shown.map(({ def }) => def?.id ?? null)).toEqual(["torika", null, "dodo"]);
    expect(preview.all).toHaveLength(2);
    expect(preview.totalPower).toBe(9_999);
    // 상대가 셋이 아니면 어느 판인지 모른다 — 스토리로 수렴한다.
    expect(normalizePartyContent({ content: "duel", opponent: { ...opponent, units: [] } })).toEqual({ content: "stage" });
  });

  it("방어덱 편성은 편성에 없는 가림을 버린다", () => {
    expect(normalizePartyContent({ content: "duelDefense", defense: ["a", "b", "c"], blindChoice: ["c", "z", "a"] }))
      .toEqual({ content: "duelDefense", defense: ["a", "b", "c"], blindChoice: ["c", "a"] });
    expect(partyPreview({ content: "duelDefense", defense: [], blindChoice: [] }, STAGE).shown).toEqual([]);
  });
});
