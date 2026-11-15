import type { WalletItemKey } from "./items";
import type { GuideRouteId } from "./guideRoutes";
import { registerDataText } from "../i18n";

/**
 * 지갑 재화 한 종류의 세계관 설명과 획득·소비 경로.
 *
 * 경로는 문장이 아니라 **줄 ID**다(`guideRoutes.ts`) — 문장은 문구 표가, 수는 규칙의 상수가 채우고, 갈 곳이 있는
 * 줄은 안내창에서 화살표로 곧장 간다. 여기에는 **실제로 그 재화를 주거나 받는 경계가 있는 것만** 적는다 —
 * `tests/unit/guideRoutes.test.ts`가 상점 값·발굴 생산·광고 슬롯과 대조한다.
 */
export interface CurrencyGuideEntry {
  readonly key: WalletItemKey;
  readonly name: string;
  readonly lore: string;
  readonly sources: readonly GuideRouteId[];
  readonly uses: readonly GuideRouteId[];
}

export const CURRENCY_GUIDE = {
  fossil: { key: "fossil", name: "화석", lore: "복원 가능한 생명의 흔적이 잠든 표본입니다.", sources: ["story", "missions", "expedition", "archaeologyShop", "lootShop", "trade"], uses: ["labFossil"] },
  amber: { key: "amber", name: "호박석", lore: "희귀한 복원 신호를 온전히 품은 결정입니다.", sources: ["missions", "archaeologyShop", "lootShop", "duelShop", "mileageShop", "trade"], uses: ["labAmber"] },
  gems: { key: "gems", name: "젬", lore: "도시의 연구 시설과 보급망이 인정하는 결정 화폐입니다.", sources: ["premiumGem", "premiumGemAd", "excavation", "story", "missions", "expedition"], uses: ["labFill", "staminaRecharge", "duelBuy", "trade", "shopGoldExchange", "guildCreate"] },
  gold: { key: "gold", name: "골드", lore: "정비와 세공 현장에서 쓰이는 표준 작업 화폐입니다.", sources: ["excavation", "bounty", "story", "researchGray", "shopGoldExchange", "shopGoldAd"], uses: ["runeCraft", "shopGoldBuy"] },
  stamina: { key: "stamina", name: "스테미나", lore: "조사대가 현장에 진입할 수 있는 작전 여력입니다.", sources: ["staminaRegen", "staminaDrink", "staminaGem", "staminaAd"], uses: ["staminaBattles", "raidEntry"] },
  dnaFragments: { key: "dnaFragments", name: "DNA 마일리지", lore: "복원 연구가 쌓아 두는 공용 유전 표본의 반출 증서입니다.", sources: ["researchMileage", "researchDuplicate", "missions", "expedition"], uses: ["mileageShop"] },
  cheesecake: { key: "cheesecake", name: "치즈케이크", lore: "복원체와 신뢰를 쌓는 연구소의 특별 급여입니다.", sources: ["cakeOperation", "excavation", "story", "researchGray", "missions", "shopGoldBuy"], uses: ["relicFeed"] },
  raidSigil: { key: "raidSigil", name: "토벌 증표", lore: "보스를 밀어낸 몫만큼 발급되는 토벌 증서입니다.", sources: ["raidRun", "lootAd"], uses: ["lootShop"] },
  salvageRecord: { key: "salvageRecord", name: "인양 기록", lore: "수장된 지부에서 무엇을 건졌는지 적어 둔 기록입니다.", sources: ["expedition", "raidRun", "lootAd"], uses: ["lootShop"] },
  duelEmblem: { key: "duelEmblem", name: "투사의 휘장", lore: "결투장의 깃발 아래 싸운 몫만큼 내려 주는 휘장입니다.", sources: ["duelBattle"], uses: ["duelShop"] },
  rawStone: { key: "rawStone", name: "원석", lore: "지층 깊이 잠들어 있던, 아직 아무도 손대지 않은 광물입니다.", sources: ["archaeology", "excavation", "archaeologyAd", "runeSell", "lootShop"], uses: ["archaeologyShop", "runeTrait"] },
} as const satisfies Record<WalletItemKey, CurrencyGuideEntry>;

/** 외부 입력도 항상 완전성 검사를 통과한 카탈로그에서만 조회한다. */
export function currencyGuide(key: WalletItemKey): CurrencyGuideEntry { return CURRENCY_GUIDE[key]; }

/** 재화 안내의 이름·설명을 언어별로 덮어쓸 수 있게 등록한다. 경로 문장은 문구 표(`guide.route.*`)가 갖는다. */
for (const entry of Object.values(CURRENCY_GUIDE)) {
  registerDataText(entry, "name", `currency.${entry.key}.name`);
  registerDataText(entry, "lore", `currency.${entry.key}.lore`);
}
