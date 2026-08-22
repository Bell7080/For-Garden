import type { Stats } from "../core/types";

/**
 * Heart Gem(룬)의 희귀도 단계다.
 *
 * 룬 하트의 색이 이 넷을 그대로 따른다 — 초록 고급, 파랑 희귀, 보라 영웅, 빨강 전설. 색표는
 * `scripts/prepare_icons.py`의 `RUNE_TINTS`와 `src/ui/runeIcons.ts`의 `RUNE_ACCENT` 두 곳에만
 * 있으며 이 넷과 이름이 반드시 같아야 한다.
 */
export type HeartGemRarity = "uncommon" | "rare" | "epic" | "legendary";

/** 능력치별 백분율 보정이다. 10은 해당 능력치를 10% 올린다는 뜻이다. */
export type HeartGemStatEffect = Partial<Record<keyof Stats, number>>;

/** 일반 아이템과 구분되는 Heart Gem의 정적 정의다. */
export interface HeartGemDef {
  id: string;
  name: string;
  rarity: HeartGemRarity;
  /** 렌더러가 실제 이미지와 연결할 때 쓰는 안정적인 키다. */
  iconKey: string;
  statPercent: HeartGemStatEffect;
}

/** 밸런스 수정과 보유/장착 상태가 섞이지 않도록 정의만 보관한다. */
export const HEART_GEMS: readonly HeartGemDef[] = [
  { id: "vital-seed", name: "생명의 Heart Gem", rarity: "uncommon", iconKey: "heart-gem-vital", statPercent: { hp: 10 } },
  { id: "fang-core", name: "송곳니 Heart Gem", rarity: "rare", iconKey: "heart-gem-fang", statPercent: { atk: 12, critChance: 5 } },
  { id: "ancient-pulse", name: "고대의 Heart Gem", rarity: "epic", iconKey: "heart-gem-ancient", statPercent: { hp: 8, def: 8, res: 8 } },
];

/** 저장된 id를 검증하면서 정의를 얻는 공용 조회 함수다. */
export function getHeartGem(id: string): HeartGemDef {
  const gem = HEART_GEMS.find((candidate) => candidate.id === id);
  if (!gem) throw new Error(`알 수 없는 Heart Gem id: ${id}`);
  return gem;
}
