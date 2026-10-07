import { BREAKTHROUGH_CAP, relicLevelCap } from "./relicProgression";
import { canEngraveRune, type RuneInstance } from "./runes";

/**
 * 진 판 뒤에 서는 **강해지는 길** — 결과판의 세 칸.
 *
 * 길은 개체나 모드가 아니라 **지금 편성의 상태**가 정한다. 렐릭 강화·룬 세공·연구소가 기본이고,
 * 렐릭 강화나 룬 세공을 더 할 것이 없으면 그 칸은 꺼지고 **편성 바꾸기**, 그다음 **고고학**이 그
 * 자리를 채운다. 모드마다 제 버튼을 다시 나열하면 같은 패배가 화면마다 다른 말을 한다.
 */
export type GrowthPathId = "relicEnhance" | "runeCraft" | "lab" | "party" | "archaeology";

export interface GrowthPath {
  id: GrowthPathId;
  /** 정보창으로 곧바로 열어 줄 편성 속 렐릭. 렐릭 강화·룬 세공만 갖는다. */
  relicId?: string;
}

export interface GrowthPathInput {
  party: readonly string[];
  relicProgress: Readonly<Record<string, { level: number; breakthrough: number; heartGemSlots: readonly (string | null)[] }>>;
  runeInventory: readonly RuneInstance[];
  /** 고고학이 열려 있는가. 잠긴 콘텐츠를 길로 세우지 않는다. */
  archaeologyOpen: boolean;
}

/** 편성 중 레벨이 가장 낮고 아직 급여로 올릴 수 있는 렐릭. 같으면 편성 순서가 앞선 쪽이다. */
export function weakestFeedableRelic(input: GrowthPathInput): string | undefined {
  let target: { id: string; level: number } | undefined;
  for (const id of input.party) {
    const progress = input.relicProgress[id];
    if (!progress || progress.level >= relicLevelCap(Math.min(BREAKTHROUGH_CAP, Math.max(0, progress.breakthrough)))) continue;
    if (!target || progress.level < target.level) target = { id, level: progress.level };
  }
  return target?.id;
}

/** 편성 중 낀 룬에 세공이나 각인이 남은 렐릭. 편성 순서가 앞선 쪽이다. */
export function relicWithUnfinishedRune(input: GrowthPathInput): string | undefined {
  const runes = new Map(input.runeInventory.map((rune) => [rune.instanceId, rune] as const));
  return input.party.find((id) => (input.relicProgress[id]?.heartGemSlots ?? []).some((slot) => {
    const rune = slot ? runes.get(slot) : undefined;
    return rune !== undefined && (!rune.enhancementComplete || canEngraveRune(rune));
  }));
}

export function growthPaths(input: GrowthPathInput): GrowthPath[] {
  const relicId = weakestFeedableRelic(input);
  const runeRelicId = relicWithUnfinishedRune(input);
  const fillers: GrowthPath[] = [{ id: "party" }, ...(input.archaeologyOpen ? [{ id: "archaeology" } as GrowthPath] : [])];
  const paths: GrowthPath[] = [];
  paths.push(relicId !== undefined ? { id: "relicEnhance", relicId } : fillers.shift() ?? { id: "lab" });
  paths.push(runeRelicId !== undefined ? { id: "runeCraft", relicId: runeRelicId } : fillers.shift() ?? { id: "lab" });
  paths.push({ id: "lab" });
  // 채울 길이 모자라 연구소가 겹치면 겹친 칸은 뺀다.
  return paths.filter((path, index) => path.id !== "lab" || index === paths.findIndex(({ id }) => id === "lab"));
}
