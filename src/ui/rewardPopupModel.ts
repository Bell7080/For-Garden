import type { RuneInstance } from "../core/runes";
import { findItem } from "../data/items";
import type { ProductGrant } from "../data/shopCatalog";
import type { CurrencyIconKey } from "./currencyIcons";
import type { GlyphName } from "./glyphs";

/** Phaser 없이 검증할 수 있는 공용 보상 액자 한 칸의 표시 계약이다. */
export interface RewardPopupItem {
  /** 텍스처가 없는 계정 장식도 공용 선 아이콘으로 안전하게 표시한다. */
  icon: CurrencyIconKey | string | { kind: "glyph"; key: GlyphName };
  amount: number;
  /** 이름이 필요한 보상만 짧게 붙인다. 재화는 아이콘과 숫자만으로도 구분되므로 생략할 수 있다. */
  label?: string;
}

/** 서버 재화 레코드를 공용 보상 액자 키로 바꾼다. 알 수 없는 운영 재화는 안전하게 생략한다. */
export function currencyRecordToRewardItems(rewards: Readonly<Record<string, number>>): RewardPopupItem[] {
  const icons: Partial<Record<string, CurrencyIconKey>> = {
    cheesecake: "currency-cheesecake", gold: "currency-gold", fossil: "currency-fossil",
    gems: "currency-gems", amber: "currency-amber", stamina: "currency-stamina", dnaFragments: "currency-dna",
  };
  return Object.entries(rewards).flatMap(([currency, amount]) => {
    const icon = icons[currency];
    return icon && amount > 0 ? [{ icon, amount: Math.floor(amount) }] : [];
  });
}

/** 서버가 확정한 상품 지급 결과를 정의 재계산 없이 보상 액자 표시 모델로만 변환한다. */
export function productGrantsToRewardItems(grants: readonly ProductGrant[], grantedRunes: readonly RuneInstance[] = []): RewardPopupItem[] {
  // 같은 재화 행이 여러 개여도 Object 변환으로 덮어쓰지 않고 영수증의 각 확정 행을 보존한다.
  const currencyIcons = grants.flatMap((grant) => grant.kind === "currency" ? currencyRecordToRewardItems({ [grant.currency]: grant.amount }) : []);
  const otherItems = grants.flatMap((grant): RewardPopupItem[] => {
    if (grant.kind === "currency") return [];
    if (grant.kind === "profile_decoration") return [{ icon: { kind: "glyph", key: "costume" }, amount: 1, label: grant.name }];
    if (grant.kind === "rune") return [{ icon: `rune-${grant.rarity}-${grant.part}`, amount: grant.amount, label: grant.name }];
    const definition = findItem(grant.itemId);
    if (!definition) return [{ icon: { kind: "glyph", key: "scroll" }, amount: grant.amount, label: grant.name }];
    if (definition.icon.kind === "asset") return [{ icon: definition.icon.key, amount: grant.amount, label: grant.name }];
    if (definition.icon.kind === "currency") return currencyRecordToRewardItems({ [definition.icon.key]: grant.amount }).map((item) => ({ ...item, label: grant.name }));
    return [{ icon: { kind: "glyph", key: definition.icon.key }, amount: grant.amount, label: grant.name }];
  });
  // 완성 룬 인스턴스가 별도 배열로 내려오면 각 서버 결과의 희귀도·파츠를 그대로 그린다.
  const runeItems = grantedRunes.map((rune) => ({ icon: `rune-${rune.rarity}-${rune.part}`, amount: 1, label: rune.customName ?? rune.baseName }));
  return [...currencyIcons, ...otherItems, ...runeItems];
}
