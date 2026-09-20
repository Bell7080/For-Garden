import { registerDataText, type TextKey } from "../i18n";
import { ARCHAEOLOGY_CLERK_ASSET, LOOT_CLERK_ASSET, SHOP_CLERK_ASSET, type PuppetAsset } from "../puppets/assets";
import { BACKGROUND } from "../ui/backgroundAssets";
import type { ProductStorefront } from "./products";

/**
 * 일반 상점 무대에 서는 점원 — **오비**.
 *
 * 이터널 시티 중앙 연구소 1층의 편의점 **A-LAB24**에서 일을 배우는 견습 알바생이다.
 * A-LAB24는 이터널 시티 안의 대기업 **Apex**가 운영하는 프랜차이즈이고, 중앙 연구소 지점은
 * 그중 한 칸이다. 오비는 어린 오비랍토르의 화석을 복원한 개체이며, 소심하고 부끄럼을 타지만
 * 그 일을 하나씩 열심히 익힌다. 폐기 직전의 치즈케이크와 남는 에너지드링크 재고를 몰래
 * 빼 두었다가 먹는 것을 제일 좋아한다.
 *
 * **이름을 여기서 갖는다.** 예전 점원(토리카)은 렐릭이라 이름을 `src/data/relics.ts`가
 * 이미 갖고 있었고, 그때는 여기 한 번 더 적으면 도감에서 고친 뒤 상점만 옛 이름으로
 * 남는 문제가 있었다. 오비는 **도감에 서지 않는 상점 전용 개체**라(전투에 나가지 않아 SD
 * 묶음도 없다) 그 표에 이름이 없다 — 그래서 이 표가 유일한 소유자이고, 다른 언어 표기는
 * 아래 `registerDataText`가 개체 ID로 덮어쓴다.
 */
export const SHOP_MERCHANT: { readonly name: string; readonly asset: PuppetAsset } = {
  name: "오비",
  asset: SHOP_CLERK_ASSET,
};

/** 예전 이름을 읽던 자리를 위해 자산만 그대로 공개한다. */
export const SHOP_MERCHANT_ASSET: PuppetAsset = SHOP_MERCHANT.asset;

// 이름은 화면 문구 표가 아니라 정적 콘텐츠라, 다른 언어만 개체 ID로 덮어쓴다.
registerDataText(SHOP_MERCHANT, "name", "shopClerk.obi.name");

/**
 * 오비가 돌아가며 하는 말.
 *
 * 한 마디만 걸어 두면 눌러 볼 이유가 없어 점원이 배경 그림과 다를 바 없다 — 누를 때마다 다음
 * 마디로 넘어가야 그 자리에 사람이 서 있는 것으로 읽힌다. 문장 자체는 화면 문구라
 * `src/i18n`이 갖고, 여기는 **순서만** 소유한다.
 */
export const SHOP_MERCHANT_LINE_KEYS: readonly TextKey[] = [
  "shop.merchant.line1", "shop.merchant.line2", "shop.merchant.line3",
  "shop.merchant.line4", "shop.merchant.line5",
];

/**
 * 고고학 상점 무대에 서는 점원 — **프로티아**.
 *
 * 프로토케라톱스를 복원한 개체이고, 이터널 시티 바깥 **고비 사막**에서 직접 파고 다니는
 * 발굴 연구가다. 열여덟 언저리의 몸집이지만 현장에서 굴러 온 햇수가 길어 또래로 보이지
 * 않는다 — 지층을 보면 어느 겹인지 바로 말하고, 그만큼 **값도 정확히 안다.** 오비처럼
 * 부끄러워하지 않고, 깎아 달라는 말에는 웃으면서 근거를 댄다.
 *
 * 오비와 **결이 달라야 하는 이유**가 여기 있다. 편의점 견습생과 사막에서 값을 매기는
 * 연구가가 같은 말투로 말하면, 상품표만 바뀐 같은 가게로 읽힌다.
 *
 * 이름은 오비와 같은 이유로 이 표가 소유한다 — 도감에 서지 않는 상점 전용 개체라
 * `src/data/relics.ts`에 이름이 없다.
 */
export const ARCHAEOLOGY_MERCHANT: { readonly name: string; readonly asset: PuppetAsset } = {
  name: "프로티아",
  asset: ARCHAEOLOGY_CLERK_ASSET,
};

registerDataText(ARCHAEOLOGY_MERCHANT, "name", "shopClerk.protia.name");

/** 프로티아가 돌아가며 하는 말. 순서만 여기 있고 문장은 `src/i18n`이 갖는다. */
export const ARCHAEOLOGY_MERCHANT_LINE_KEYS: readonly TextKey[] = [
  "shop.protia.line1", "shop.protia.line2", "shop.protia.line3",
  "shop.protia.line4", "shop.protia.line5",
];

/**
 * 전리품 상점 무대에 서는 점원 — **하이네**.
 *
 * 토벌과 인양에서 돌아온 사람에게 증표를 받고 물건을 내어 주는 **보급 담당**이다. 장부가
 * 곧 그의 일이라 세는 것으로 말을 시작하고, 값을 흥정하지 않는다 — 값은 증표 수가 이미
 * 정해 두었기 때문이다. 돌아온 사람을 매번 다시 보는 자리라 무뚝뚝한 말 끝에 다음에도
 * 살아 오라는 말이 붙는다.
 *
 * 오비·프로티아와 **결이 갈려야 하는 이유**가 여기 있다. 편의점 견습생은 수줍게 권하고,
 * 사막의 연구가는 값의 근거를 대며, 보급 담당은 **세고 건넨다.** 셋이 같은 말투로 말하면
 * 상품표만 바뀐 같은 가게로 읽힌다.
 *
 * 이름은 둘과 같은 이유로 이 표가 소유한다 — 도감에 서지 않는 상점 전용 개체라
 * `src/data/relics.ts`에 이름이 없다.
 */
export const LOOT_MERCHANT: { readonly name: string; readonly asset: PuppetAsset } = {
  name: "하이네",
  asset: LOOT_CLERK_ASSET,
};

registerDataText(LOOT_MERCHANT, "name", "shopClerk.haine.name");

/** 하이네가 돌아가며 하는 말. 순서만 여기 있고 문장은 `src/i18n`이 갖는다. */
export const LOOT_MERCHANT_LINE_KEYS: readonly TextKey[] = [
  "shop.haine.line1", "shop.haine.line2", "shop.haine.line3",
  "shop.haine.line4", "shop.haine.line5",
];

/** 상점 화면 한 자리가 갖는 무대. 점원·배경·대사가 한 덩어리로 갈린다. */
export interface ShopStagePresentation {
  readonly merchant: { readonly name: string; readonly asset: PuppetAsset };
  readonly lineKeys: readonly TextKey[];
  readonly background: string;
  /** 머리글 문구. 같은 씬이 두 자리를 맡으므로 제목도 자리를 따라간다. */
  readonly titleKey: TextKey;
  /**
   * 그 원화만의 자리 보정.
   *
   * **원화마다 머리 관절이 그림 안에서 다른 자리에 있다.** 무대는 머리 관절을 한 점에 고정하고
   * 키로 배율을 정하므로(`computeAnchoredPlacement`), 관절 **오른쪽에 그려진 몫**이 넓은 원화는
   * 같은 자리·같은 키에서 화면 밖으로 넘친다 — 오비는 관절 오른쪽이 303px인데 프로티아는
   * 461px이라, 기본값 그대로면 오른쪽 변을 108px 넘어 들고 있는 두개골이 잘렸다.
   *
   * 화면이 개체 이름으로 분기하지 않도록 그 보정을 **무대표가** 갖는다. 비우면 공용 자리다.
   */
  readonly merchantSpot?: { readonly headX: number; readonly height: number };
}

/**
 * 자리별 무대표.
 *
 * **화면이 storefront로 분기하지 않는다** — 씬이 `if (storefront === "archaeology")`를
 * 쓰기 시작하면 자리가 하나 늘 때마다 씬이 길어지고, 점원만 바꾸고 배경을 빠뜨리는 사고가
 * 난다. 한 자리가 갖는 것 전부가 여기 한 줄이다.
 */
export const SHOP_STAGE_PRESENTATION: Readonly<Record<"shop" | "archaeology" | "raid", ShopStagePresentation>> = {
  shop: {
    merchant: SHOP_MERCHANT,
    lineKeys: SHOP_MERCHANT_LINE_KEYS,
    background: BACKGROUND.shop,
    titleKey: "shop.title",
  },
  archaeology: {
    merchant: ARCHAEOLOGY_MERCHANT,
    lineKeys: ARCHAEOLOGY_MERCHANT_LINE_KEYS,
    background: BACKGROUND.archaeologyShop,
    titleKey: "shop.archaeology.title",
    // 머리 관절은 **대사 띠 오른쪽 끝(730)보다 오른쪽**에 있어야 얼굴이 띠에 덮이지 않고,
    // 관절 오른쪽 461px이 화면 안에 들려면 배율이 0.73 아래여야 한다 — 그 둘을 함께 만족하는
    // 자리다. 키가 오비보다 작은 것은 원화가 넓기 때문이지 인물이 작아서가 아니다.
    merchantSpot: { headX: 744, height: 1010 },
  },
  raid: {
    merchant: LOOT_MERCHANT,
    lineKeys: LOOT_MERCHANT_LINE_KEYS,
    background: BACKGROUND.lootShop,
    titleKey: "shop.raid.title",
    // 프로티아와 등신이 비슷해 같은 자리를 쓴다. 자리는 점원이 정하지 무대가 정하지 않는다.
    merchantSpot: { headX: 744, height: 1010 },
  },
};

/** 무역·프리미엄은 이 씬을 쓰지 않으므로 일반 상점 무대로 떨어뜨린다. */
export function shopStagePresentation(storefront: ProductStorefront): ShopStagePresentation {
  if (storefront === "archaeology") return SHOP_STAGE_PRESENTATION.archaeology;
  if (storefront === "raid") return SHOP_STAGE_PRESENTATION.raid;
  return SHOP_STAGE_PRESENTATION.shop;
}
