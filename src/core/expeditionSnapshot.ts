import { calculateFinalStats } from "./relicProgression";
import type { RuneInstance } from "./runes";
import type { RelicDef, RelicProgress, RelicSkinId, Stats } from "./types";

/**
 * 원정을 떠난 순간의 렐릭 한 기 — **런이 끝날 때까지 이 값으로 싸운다.**
 *
 * 원정은 스무 층을 한 번에 오르는 콘텐츠라, 도중에 급여·한계 돌파·룬·외형을 바꾸면 막판에
 * 다른 개체가 싸우게 된다. 출발할 때 성장 결과를 통째로 굳혀 두고 전투·지도·서버 재현·정보창이
 * 모두 이 값을 읽는다. 편성 화면은 아직 떠나지 않았으므로 지금 값을 그대로 읽는다.
 */
export interface ExpeditionRelicSnapshot {
  level: number;
  breakthrough: number;
  bondLevel: number;
  /** 레벨·돌파·룬까지 반영한 최종 능력치. */
  stats: Stats;
  /** 끼고 떠난 룬의 사본. 룬 특성도 이 목록에서 돈다. */
  runes: RuneInstance[];
  /** 입고 떠난 외형. 없으면 기본 외형이다. */
  skinId: RelicSkinId | null;
}

/** 지금 성장을 굳힌다. 룬은 사본이라 떠난 뒤 세공·판매해도 런의 몫은 그대로다. */
export function captureExpeditionRelicSnapshot(
  def: RelicDef,
  progress: RelicProgress,
  runeInventory: readonly RuneInstance[],
  skinId: RelicSkinId | null | undefined,
): ExpeditionRelicSnapshot {
  const runes = progress.heartGemSlots.flatMap((id) => {
    const rune = id === null ? undefined : runeInventory.find((candidate) => candidate.instanceId === id);
    return rune ? [structuredClone(rune)] : [];
  });
  return {
    level: progress.level,
    breakthrough: progress.breakthrough,
    bondLevel: progress.bondLevel,
    stats: { ...calculateFinalStats(def.stats, progress, runes, def.rarity) },
    runes,
    skinId: skinId ?? null,
  };
}

/** 저장에서 읽은 스냅샷이 쓸 수 있는 모양인지. 아니면 버리고 다시 굳힌다. */
export function isExpeditionRelicSnapshot(value: unknown): value is ExpeditionRelicSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ExpeditionRelicSnapshot>;
  const whole = (n: unknown): boolean => Number.isInteger(n) && (n as number) >= 0;
  return whole(snapshot.level) && (snapshot.level as number) >= 1 && whole(snapshot.breakthrough) && whole(snapshot.bondLevel)
    && !!snapshot.stats && typeof snapshot.stats === "object" && Object.values(snapshot.stats).every((stat) => Number.isFinite(stat))
    && Array.isArray(snapshot.runes)
    && (snapshot.skinId === null || typeof snapshot.skinId === "string");
}
