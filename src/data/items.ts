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

/** 지갑에서만 소유량을 유지하는 재화 키다. */
export type WalletItemKey = "fossil" | "amber" | "gems" | "gold" | "stamina" | "dnaFragments" | "cheesecake" | "rawStone";

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
  { id: "stamina-tonic", name: "에너지 드링크", description: "스테미나를 30 회복합니다.", category: "consumable", icon: { kind: "asset", key: "item-stamina-tonic" }, maxStack: 99, useEffect: { kind: "restore_stamina", amount: 30 } },
  { id: "ancient-core", name: "미지의 고대 핵", description: "룬에 특성 한 줄을 새로 부여합니다. 이미 특성이 있으면 지우고 다시 부여합니다.", category: "material", icon: { kind: "glyph", key: "scroll" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "refined-core", name: "정제된 고대 핵", description: "영웅 이상 등급의 특성을 확정으로 부여합니다.", category: "material", icon: { kind: "glyph", key: "scroll" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "restoration-crystal", name: "완전 복원 결정", description: "특성의 등급을 한 단계 확정으로 올립니다. 전설 특성에는 사용할 수 없습니다.", category: "material", icon: { kind: "glyph", key: "scroll" }, maxStack: 999, useEffect: { kind: "none" } },
  { id: "rune-dust", name: "룬 가루", description: "룬 연구에 쓰이는 정제 재료입니다.", category: "material", icon: { kind: "asset", key: "item-rune-dust" }, maxStack: 999, useEffect: { kind: "none" } },
  // 교류 표본의 등급 설명은 교환 화면에 반복하지 않고 정적 도감 데이터에만 보존한다.
  { id: "sr-psychic-sample", name: "SR 심령 샘플", description: "나이트 시티에서 회수한 SR급 교류 표본입니다.", category: "material", icon: { kind: "glyph", key: "scroll" }, maxStack: 999, useEffect: { kind: "none" } },
] as const satisfies readonly ItemDefinition[];

/** 외부 입력 ID는 반드시 정적 카탈로그를 통과한다. */
export function findItem(id: string): ItemDefinition | undefined { return ITEMS.find((item) => item.id === id); }

/** 아이템 이름과 설명을 언어별로 덮어쓸 수 있게 등록한다. */
for (const item of ITEMS) {
  registerDataText(item, "name", `item.${item.id}.name`);
  registerDataText(item, "description", `item.${item.id}.description`);
}
