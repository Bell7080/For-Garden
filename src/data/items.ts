import { registerDataText } from "../i18n";
/** 인벤토리가 표시하고 서버가 해석하는 정적 아이템 분류다. */
export type ItemCategory = "rune" | "currency" | "consumable" | "material";

/** 함수 대신 판별 합집합을 사용해 저장·서버 경계를 안전하게 통과시키는 사용 효과다. */
export type ItemUseEffect =
  | { readonly kind: "restore_stamina"; readonly amount: number }
  | { readonly kind: "none" };

/** 아이콘은 기존 glyph 또는 구운 재화 이미지 키를 가리키며 임의 SVG를 만들지 않는다. */
export type ItemIcon =
  | { readonly kind: "glyph"; readonly key: "scroll" | "heart" }
  | { readonly kind: "currency"; readonly key: WalletItemKey }
  /** 소비품·재료가 구운 전용 이미지를 얻을 때 쓰며, 로드 실패 때만 기존 glyph로 돌아간다. */
  | { readonly kind: "asset"; readonly key: string };

/** 정적 아이콘 파일 하나가 빠져도 가방 전체가 그리기를 계속할 수 있게 하는 공용 표식이다. */
export const ITEM_ICON_FALLBACK = "scroll" as const;

/**
 * 지갑에서만 소유량을 유지하는 재화 키다.
 *
 * **전리품 증표 둘도 여기 있다.** 한 콘텐츠에서만 도는 교환 재료라 재료 칸에 두었던 때는
 * `maxStack`(9,999)이 걸려 **몇 주 안 턴 사람의 몫이 조용히 버려졌고**, 상단 줄에 세울
 * 수도 없었다 — "가끔 들어가서 많이 모였네" 하고 터는 것이 그 상점의 경험이라 상한이
 * 있으면 안 된다. 지갑이라고 늘 보이는 것은 아니다: 어느 화면에 어느 재화를 세우는지는
 * `TopBar`의 `SLOTS`가 따로 정하므로, 증표는 전리품 상점과 그 콘텐츠에서만 선다.
 */
export type WalletItemKey =
  | "fossil" | "amber" | "gems" | "gold" | "stamina" | "dnaFragments" | "cheesecake" | "rawStone"
  | "raidSigil" | "salvageRecord";

/** 소비품 회복이 넘지 못하는 현재 계정의 행동력 상한이다. */

/** 운영 데이터 한 행. maxStack은 서버 수량 검증의 단일 기준이다. */
export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: ItemCategory;
  readonly icon: ItemIcon;
  readonly maxStack: number;
  readonly useEffect: ItemUseEffect;
}

/** 초기 인벤토리 카탈로그. 룬은 인스턴스 데이터이므로 가상 정의 한 행으로 표시한다. */
export const ITEMS = [
  { id: "rune", name: "룬", description: "렐릭의 하트 젬 슬롯에 장착하는 개별 룬입니다.", category: "rune", icon: { kind: "glyph", key: "heart" }, maxStack: 1, useEffect: { kind: "none" } },
  { id: "fossil", name: "화석", description: "연구소의 캐릭터 획득 연구에 사용합니다.", category: "currency", icon: { kind: "currency", key: "fossil" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
  { id: "amber", name: "호박석", description: "희귀 연구에 사용하는 재화입니다.", category: "currency", icon: { kind: "currency", key: "amber" }, maxStack: 999_999, useEffect: { kind: "none" } },
  { id: "gems", name: "보석", description: "도시 전역에서 통용되는 재화입니다.", category: "currency", icon: { kind: "currency", key: "gems" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
  { id: "gold", name: "골드", description: "룬 세공과 성장에 사용하는 재화입니다.", category: "currency", icon: { kind: "currency", key: "gold" }, maxStack: 999_999_999, useEffect: { kind: "none" } },
  { id: "stamina", name: "스테미나", description: "탐사에 필요한 행동력입니다.", category: "currency", icon: { kind: "currency", key: "stamina" }, maxStack: 9_999, useEffect: { kind: "none" } },
  { id: "dnaFragments", name: "DNA 조각", description: "복원 연구의 교환 재화입니다.", category: "currency", icon: { kind: "currency", key: "dnaFragments" }, maxStack: 99_999, useEffect: { kind: "none" } },
  { id: "cheesecake", name: "치즈케이크", description: "렐릭에게 급여해 성장시킵니다.", category: "currency", icon: { kind: "currency", key: "cheesecake" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
  { id: "rawStone", name: "원석", description: "지층 탐사로 캐낸 미가공 광물입니다. 룬 특성 재해석에 사용합니다.", category: "currency", icon: { kind: "currency", key: "rawStone" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
  // 에너지 드링크는 **기본과 쎈 것 둘**이다. 회복량만 다른 같은 물건이라 한 칸에서 좌우로
  // 갈아 끼우고(`StaminaPopup`), 그래서 둘의 이름도 같은 낱말에 표시만 다르게 붙인다.
  { id: "stamina-tonic", name: "에너지 드링크", description: "스테미나를 60 회복합니다.", category: "consumable", icon: { kind: "asset", key: "item-stamina-tonic" }, maxStack: 99, useEffect: { kind: "restore_stamina", amount: 60 } },
  { id: "stamina-tonic-large", name: "에너지 드링크+", description: "스테미나를 120 회복합니다.", category: "consumable", icon: { kind: "asset", key: "item-stamina-tonic-large" }, maxStack: 99, useEffect: { kind: "restore_stamina", amount: 120 } },
  { id: "ancient-core", name: "미지의 고대 핵", description: "룬에 특성 한 줄을 새로 부여합니다. 이미 특성이 있으면 지우고 다시 부여합니다.", category: "material", icon: { kind: "asset", key: "item-ancient-core" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "refined-core", name: "정제된 고대 핵", description: "영웅 이상 등급의 특성을 확정으로 부여합니다. 이미 영웅 이상인 특성에는 사용할 수 없습니다.", category: "material", icon: { kind: "asset", key: "item-refined-core" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "restoration-crystal", name: "완전 복원 결정", description: "특성의 종류는 그대로 두고 등급을 전설로 확정 상승시킵니다. 이미 전설인 특성에는 사용할 수 없습니다.", category: "material", icon: { kind: "asset", key: "item-restoration-crystal" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "rune-dust", name: "룬 가루", description: "룬 연구에 쓰이는 정제 재료입니다.", category: "material", icon: { kind: "asset", key: "item-rune-dust" }, maxStack: 999, useEffect: { kind: "none" } },
  // 레이드를 여는 두 토벌권. 소모하는 입장권이라 지갑이 아니라 가방의 재료다 — 상단 줄에 늘
  // 서는 재화가 아니고, 레이드 목록 머리에서만 몇 장 남았는지 말한다.
  { id: "raid-ticket", name: "토벌권", description: "친구와 함께 치는 레이드를 엽니다. 보스와 난이도는 무작위로 정해집니다.", category: "material", icon: { kind: "asset", key: "item-raid-ticket" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "raid-select-ticket", name: "선택 토벌권", description: "친구와 함께 치는 레이드를 엽니다. 보스와 난이도를 골라서 엽니다.", category: "material", icon: { kind: "asset", key: "item-raid-select-ticket" }, maxStack: 999, useEffect: { kind: "none" } },
  // 소탕 한 번에 한 장. 멤버십이 없을 때만 들고, 던전 입구에서 광고를 보면 다섯 장씩 채워진다.
  { id: "sweep-ticket", name: "소탕권", description: "이미 이긴 던전 단계를 전투 없이 한 번 소탕합니다.", category: "material", icon: { kind: "glyph", key: "scroll" }, maxStack: 999, useEffect: { kind: "none" } },
  // 전리품 상점의 두 증표. 상한을 두지 않는 이유가 곧 지갑에 둔 이유다 — 가끔 들어가 터는
  // 자리라 몇 주치가 쌓여도 버려지면 안 된다.
  { id: "raidSigil", name: "토벌 증표", description: "레이드 보스를 밀어낸 몫으로 받는 증표입니다. 전리품 상점에서 교환합니다.", category: "currency", icon: { kind: "currency", key: "raidSigil" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
  { id: "salvageRecord", name: "인양 기록", description: "수장된 지부에서 건져 올린 것을 적어 둔 기록입니다. 전리품 상점에서 교환합니다.", category: "currency", icon: { kind: "currency", key: "salvageRecord" }, maxStack: 9_999_999, useEffect: { kind: "none" } },
] as const satisfies readonly ItemDefinition[];

/** 외부 입력 ID는 반드시 정적 카탈로그를 통과한다. */
export function findItem(id: string): ItemDefinition | undefined { return ITEMS.find((item) => item.id === id); }

/** 아이템 이름과 설명을 언어별로 덮어쓸 수 있게 등록한다. */
for (const item of ITEMS) {
  registerDataText(item, "name", `item.${item.id}.name`);
  registerDataText(item, "description", `item.${item.id}.description`);
}
