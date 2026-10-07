import { describe, expect, it } from "vitest";
import { growthPaths, type GrowthPathInput } from "../../src/core/growthPaths";
import { relicLevelCap } from "../../src/core/relicProgression";
import type { RuneInstance } from "../../src/core/runes";

const rune = (id: string, done: boolean, engraved: boolean): RuneInstance => ({ instanceId: id, enhancementComplete: done, engravings: engraved ? [{}] : [] } as unknown as RuneInstance);
const progress = (level: number, slots: (string | null)[] = [null, null, null], breakthrough = 0) => ({ level, breakthrough, heartGemSlots: slots });
const base = (over: Partial<GrowthPathInput>): GrowthPathInput => ({ party: ["a", "b", "c"], relicProgress: {}, runeInventory: [], archaeologyOpen: true, ...over });

describe("강해지는 길", () => {
  it("렐릭 강화는 편성 중 가장 레벨이 낮은 렐릭으로, 룬 세공은 세공이 남은 룬을 낀 렐릭으로 열린다", () => {
    const paths = growthPaths(base({
      relicProgress: { a: progress(9), b: progress(3, ["r1", null, null]), c: progress(5) },
      runeInventory: [rune("r1", false, false)],
    }));
    expect(paths).toEqual([{ id: "relicEnhance", relicId: "b" }, { id: "runeCraft", relicId: "b" }, { id: "lab" }]);
  });

  it("만렙 렐릭은 건너뛰고, 끝까지 세공한 룬은 길이 아니다 — 비는 칸은 편성 바꾸기, 고고학 차례로 채운다", () => {
    const cap = relicLevelCap(0);
    const paths = growthPaths(base({
      relicProgress: { a: progress(cap, ["r1", null, null]), b: progress(cap), c: progress(cap) },
      runeInventory: [rune("r1", true, true)],
    }));
    expect(paths).toEqual([{ id: "party" }, { id: "archaeology" }, { id: "lab" }]);
  });

  it("렐릭만 더 키울 게 없으면 그 자리에 편성 바꾸기가 서고, 각인이 남은 룬도 룬 세공 길이다", () => {
    const cap = relicLevelCap(0);
    const paths = growthPaths(base({
      relicProgress: { a: progress(cap, ["r1", null, null]), b: progress(cap), c: progress(cap) },
      runeInventory: [rune("r1", true, false)],
    }));
    expect(paths).toEqual([{ id: "party" }, { id: "runeCraft", relicId: "a" }, { id: "lab" }]);
  });

  it("고고학이 잠겨 있으면 길로 세우지 않고 연구소가 겹치지 않는다", () => {
    const cap = relicLevelCap(0);
    const paths = growthPaths(base({ archaeologyOpen: false, relicProgress: { a: progress(cap), b: progress(cap), c: progress(cap) } }));
    expect(paths.map(({ id }) => id)).toEqual(["party", "lab"]);
  });
});
