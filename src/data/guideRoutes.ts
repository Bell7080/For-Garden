import type { ContentId } from "../core/contentUnlock";
import { STAMINA_REGEN_AMOUNT, STAMINA_REGEN_INTERVAL_MS } from "../core/stamina";
import { nextStaminaGemCost } from "../core/staminaGemPricing";
import { RESEARCH_TICKET_GEM_PRICE } from "../core/gacha";
import { RAID_RUN_STAMINA } from "./raid";
import { MILEAGE_PER_PULL } from "../core/mileage";
import { DUEL_DAILY_ATTEMPTS, DUEL_EXTRA_ATTEMPT_PRICES } from "../core/duelArena";
import { GUILD_CREATE_GEMS } from "../core/guild";
import { PLAYER_LEVEL_UP_REWARD } from "../core/playerLevel";
import { RAID_TICKET_DROP } from "../core/raidTicketDrops";
import { STAMINA_RECHARGE_SOURCES } from "./staminaRecharge";
import { AD_REWARD_SLOTS, type AdRewardSlot } from "./adRewards";
import { PRODUCTS, type PremiumCategory, type ProductStorefront } from "./products";

/**
 * 재화·아이템 안내창의 「획득처」·「사용처」 한 줄.
 *
 * 예전에는 줄마다 문장을 손으로 적어 두어, 값이 바뀌어도 문장은 옛 수를 말했고(「3시간마다」·「다섯 장」)
 * 실제로는 없는 쓰임(화석으로 상점 보급품을 산다)까지 적혀 있었다. 지금은 **줄이 ID**이고, 문장은
 * 문구 표(`guide.route.<id>`)가, 수는 그 규칙을 가진 상수가(`guideRouteParams`) 채운다. 갈 곳이 있는 줄은
 * 옆의 화살표를 눌러 그 화면으로 곧장 간다(`destination`).
 */
export type GuideRouteId =
  | "excavation" | "archaeology" | "archaeologyShop" | "archaeologyAd" | "story" | "expedition" | "missions" | "attendance"
  | "premiumGem" | "premiumGemAd" | "premiumPackage" | "premiumDaily" | "raidPass"
  | "shop" | "shopGoldExchange" | "shopGoldAd" | "trade" | "lootShop" | "lootAd" | "duelShop" | "mileageShop"
  | "researchGray" | "researchMileage" | "researchDuplicate" | "cakeOperation" | "bounty" | "raidRun" | "duelBattle"
  | "runeSell" | "levelUp" | "dungeonDrop" | "strataDrop" | "sweepAd"
  | "staminaRegen" | "staminaDrink" | "staminaGem" | "staminaAd" | "staminaBattles" | "raidEntry"
  | "duelDaily" | "duelBuy" | "duelAd"
  | "labFossil" | "labAmber" | "labFill" | "staminaRecharge" | "guildCreate" | "relicFeed" | "runeCraft" | "shopGoldBuy" | "runeTrait";

/** 줄 옆 화살표가 가는 곳. 잠긴 콘텐츠는 `content`로 개방을 먼저 묻는다. */
export type GuideDestination =
  | { readonly kind: "scene"; readonly scene: "lab" | "archaeology" | "duel" | "raid" | "expedition" | "stageMap" | "cakeOperation" | "bounty" | "relics" | "guild" | "interaction" | "ancientStrata"; readonly content?: ContentId }
  | { readonly kind: "premium"; readonly tab?: PremiumCategory }
  | { readonly kind: "shop"; readonly storefront: Extract<ProductStorefront, "shop" | "archaeology" | "loot" | "mileage" | "duel">; readonly content?: ContentId }
  /** 로비 위에 뜨는 판 — 로비가 아닌 화면에서는 로비로 돌아가 그 판을 연다. */
  | { readonly kind: "lobby"; readonly panel: "excavation" | "trade" | "missions" | "sortie" | "codex" | "inventory"; readonly content?: ContentId }
  /**
   * 관찰 질문 — 아직 답하지 않은 열린 질문이 있는 렐릭의 관찰 일지를 그 질문 쪽으로 곧장 연다(없으면 도감).
   * 어느 렐릭인지는 누르는 순간의 상태가 정하므로 목적지에 적지 않는다.
   */
  | { readonly kind: "observation" }
  /** 스테미나 창 — 화면을 떠나지 않고 그 자리에서 연다. */
  | { readonly kind: "stamina" };

export const SCENE = (scene: Extract<GuideDestination, { kind: "scene" }>["scene"], content?: ContentId): GuideDestination => ({ kind: "scene", scene, content });
export const SHOP = (storefront: Extract<GuideDestination, { kind: "shop" }>["storefront"], content?: ContentId): GuideDestination => ({ kind: "shop", storefront, content });
export const LOBBY = (panel: Extract<GuideDestination, { kind: "lobby" }>["panel"], content?: ContentId): GuideDestination => ({ kind: "lobby", panel, content });

/** 줄마다 갈 곳. 갈 화면이 없는 줄(시간 회복·출석·룬 판매)은 비워 화살표를 세우지 않는다. */
export const GUIDE_ROUTE_DESTINATION: Readonly<Record<GuideRouteId, GuideDestination | undefined>> = {
  excavation: LOBBY("excavation", "excavation"),
  archaeology: SCENE("archaeology", "archaeology"),
  archaeologyShop: SHOP("archaeology", "archaeology"),
  archaeologyAd: SHOP("archaeology", "archaeology"),
  story: SCENE("stageMap"),
  expedition: SCENE("expedition", "expedition"),
  missions: LOBBY("missions"),
  attendance: undefined,
  premiumGem: { kind: "premium", tab: "gem" },
  premiumGemAd: { kind: "premium", tab: "gem" },
  premiumPackage: { kind: "premium" },
  premiumDaily: { kind: "premium", tab: "daily" },
  raidPass: { kind: "premium", tab: "pass" },
  shop: SHOP("shop", "shop"),
  shopGoldExchange: SHOP("shop", "shop"),
  shopGoldAd: SHOP("shop", "shop"),
  shopGoldBuy: SHOP("shop", "shop"),
  trade: LOBBY("trade", "trade"),
  lootShop: SHOP("loot", "raid"),
  lootAd: SHOP("loot", "raid"),
  duelShop: SHOP("duel", "duel"),
  mileageShop: SHOP("mileage", "lab"),
  researchGray: SCENE("lab", "lab"),
  researchMileage: SCENE("lab", "lab"),
  researchDuplicate: SCENE("lab", "lab"),
  cakeOperation: SCENE("cakeOperation", "cakeOperation"),
  bounty: SCENE("bounty", "bounty"),
  raidRun: SCENE("raid", "raid"),
  duelBattle: SCENE("duel", "duel"),
  runeSell: undefined,
  levelUp: undefined,
  dungeonDrop: LOBBY("sortie"),
  strataDrop: SCENE("archaeology", "archaeology"),
  sweepAd: LOBBY("sortie"),
  staminaRegen: undefined,
  staminaDrink: { kind: "stamina" },
  staminaGem: { kind: "stamina" },
  staminaAd: { kind: "stamina" },
  staminaBattles: LOBBY("sortie"),
  raidEntry: SCENE("raid", "raid"),
  duelDaily: SCENE("duel", "duel"),
  duelBuy: SCENE("duel", "duel"),
  duelAd: SCENE("duel", "duel"),
  labFossil: SCENE("lab", "lab"),
  labAmber: SCENE("lab", "lab"),
  labFill: SCENE("lab", "lab"),
  staminaRecharge: { kind: "stamina" },
  guildCreate: SCENE("guild", "guild"),
  relicFeed: SCENE("relics"),
  runeCraft: undefined,
  runeTrait: undefined,
};

/** 광고 슬롯 하나의 보상 수와 하루 횟수. 슬롯이 사라지면 0으로 서서 테스트가 잡는다. */
function adSlot(id: string): { amount: number; count: number } {
  const slot: AdRewardSlot | undefined = AD_REWARD_SLOTS.find((entry) => entry.id === id);
  if (!slot) return { amount: 0, count: 0 };
  const reward = slot.reward as { kind: string; amount?: number; quantity?: number; grants?: readonly { amount: number }[] };
  // 무료 칸 뒷면의 광고(상점 세 곳)는 무료 몫까지 합쳐 하루 몇 번 받는지를 말한다 — 같은 칸·같은 묶음이다.
  const free = slot.requiresClaimedProductId ? PRODUCTS.find((product) => product.id === slot.requiresClaimedProductId) : undefined;
  return { amount: reward.amount ?? reward.quantity ?? reward.grants?.[0]?.amount ?? 0, count: slot.dailyLimitUtc + (free?.acquisition.kind === "free" ? free.purchaseLimit : 0) };
}

/**
 * 줄 문장의 자리에 들어갈 수. **여기서 수를 적지 않는다** — 전부 그 규칙을 가진 상수에서 읽는다.
 * 값이 바뀌면 안내창의 문장이 함께 바뀐다.
 */
export function guideRouteParams(id: GuideRouteId): Readonly<Record<string, string | number>> {
  switch (id) {
    case "staminaRegen": return { minutes: Math.round(STAMINA_REGEN_INTERVAL_MS / 60_000), amount: STAMINA_REGEN_AMOUNT };
    case "staminaGem":
    case "staminaRecharge": {
      const gem = STAMINA_RECHARGE_SOURCES.find((source) => source.kind === "currency");
      return { amount: gem?.kind === "currency" ? gem.amount : 0, gems: nextStaminaGemCost(0) };
    }
    case "staminaAd": return adSlot("daily-stamina");
    case "raidEntry": return { amount: RAID_RUN_STAMINA };
    case "premiumGemAd": return adSlot("gem-ad");
    case "shopGoldAd": return adSlot("gold-ad");
    case "archaeologyAd": return adSlot("archaeology-ad");
    case "lootAd": return adSlot("loot-ad");
    case "sweepAd": return adSlot("sweep-tickets");
    case "duelAd": return adSlot("duel-attempt");
    case "duelDaily": return { count: DUEL_DAILY_ATTEMPTS };
    case "duelBuy": return { gems: DUEL_EXTRA_ATTEMPT_PRICES[0] ?? 0, count: DUEL_EXTRA_ATTEMPT_PRICES.length };
    case "labFill": return { gems: RESEARCH_TICKET_GEM_PRICE };
    case "researchMileage": return { amount: MILEAGE_PER_PULL };
    case "guildCreate": return { gems: GUILD_CREATE_GEMS };
    case "levelUp": return { amount: PLAYER_LEVEL_UP_REWARD.quantity, days: PLAYER_LEVEL_UP_REWARD.expiresInDays };
    case "dungeonDrop": return { count: RAID_TICKET_DROP.dailyNormalCap };
    default: return {};
  }
}
