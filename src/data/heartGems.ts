import type { RuneInstance, RuneRarity, RuneStatKey } from "../core/runes";

/**
 * 이전 이름을 쓰는 화면의 점진적 이전을 위한 희귀도 별칭이다.
 *
 * 희귀도 자체는 룬 도메인만 소유한다.
 * 룬 하트의 색이 이 넷을 그대로 따른다 — 초록 고급, 파랑 희귀, 보라 영웅, 빨강 전설. 색표는
 * `scripts/prepare_icons.py`의 `RUNE_TINTS`와 `src/ui/runeIcons.ts`의 `RUNE_ACCENT` 두 곳에만
 * 있으며 이 넷과 이름이 반드시 같아야 한다.
 */
export type HeartGemRarity = RuneRarity;

/** 능력치별 백분율 보정이다. 10은 해당 능력치를 10% 올린다는 뜻이다. */
export type HeartGemStatEffect = Partial<Record<RuneStatKey, number>>;

/** 일반 아이템과 구분되는 Heart Gem의 정적 정의다. */
export interface HeartGemDef {
  id: string;
  name: string;
  rarity: HeartGemRarity;
  /** 렌더러가 실제 이미지와 연결할 때 쓰는 안정적인 키다. */
  iconKey: string;
  statPercent: HeartGemStatEffect;
}

/** 시작 계정의 고정 젬을 신규 랜덤 인스턴스로 옮길 때 쓰는 레거시 표시·밸런스 템플릿이다. */
export interface LegacyHeartGemTemplate extends HeartGemDef {
  /** 마이그레이션에서 우선 보존할 기존 옵션 키다. 신규 인스턴스 규칙에 맞춘 뒤 나머지는 밸런스 표에서 뽑는다. */
  legacyStatKeys: readonly RuneStatKey[];
}

/** 밸런스 수정과 보유/장착 상태가 섞이지 않도록 정의만 보관한다. */
export const LEGACY_HEART_GEM_TEMPLATES: readonly LegacyHeartGemTemplate[] = [
  { id: "vital-seed", name: "생명의 Heart Gem", rarity: "uncommon", iconKey: "heart-gem-vital", statPercent: { hp: 10 }, legacyStatKeys: ["hp"] },
  { id: "fang-core", name: "송곳니 Heart Gem", rarity: "rare", iconKey: "heart-gem-fang", statPercent: { atk: 12, critChance: 5 }, legacyStatKeys: ["atk", "critChance"] },
  { id: "ancient-pulse", name: "고대의 Heart Gem", rarity: "epic", iconKey: "heart-gem-ancient", statPercent: { hp: 8, def: 8, res: 8 }, legacyStatKeys: ["hp", "def", "res"] },
];

/** 기존 장착·표시 코드가 읽는 정적 카탈로그다. 랜덤 보유 상태는 포함하지 않는다. */
export const HEART_GEMS: readonly HeartGemDef[] = LEGACY_HEART_GEM_TEMPLATES;

/** v12 정적 젬을 신규 계정과 저장 마이그레이션에서 동일하게 재현하는 결정적 어댑터다. */
export function createLegacyHeartGemRune(definitionId: string): RuneInstance {
  const template = LEGACY_HEART_GEM_TEMPLATES.find(({ id }) => id === definitionId);
  if (!template) throw new Error(`알 수 없는 레거시 Heart Gem id: ${definitionId}`);
  const common = { instanceId: `legacy-v12-${template.id}`, baseName: template.name, customName: null, rarity: template.rarity, enhancementHistory: {}, currentSuccessChance: 0.75, enhancementComplete: false, engravings: [] } as const;
  // 레거시 효과는 가능한 같은 분류에 보존하고, 신규 계약이 요구하는 빈 옵션은 0으로 채운다.
  if (template.id === "vital-seed") return { ...common, mainStats: [{ key: "hp", value: 10 }, { key: "def", value: 0 }], subStats: [] };
  if (template.id === "fang-core") return { ...common, mainStats: [{ key: "atk", value: 12 }, { key: "hp", value: 0 }], subStats: [{ key: "critChance", value: 5 }] };
  return { ...common, mainStats: [{ key: "hp", value: 8 }, { key: "def", value: 8 }], subStats: [{ key: "ferocityGain", value: 0 }, { key: "energyGain", value: 0 }] };
}

/** 저장된 id를 검증하면서 정의를 얻는 공용 조회 함수다. */
export function getHeartGem(id: string): HeartGemDef {
  const gem = HEART_GEMS.find((candidate) => candidate.id === id);
  if (!gem) throw new Error(`알 수 없는 Heart Gem id: ${id}`);
  return gem;
}
