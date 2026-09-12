import { TORIKA_ASSET, type PuppetAsset } from "../puppets/assets";

/**
 * 일반 상점 무대에 서는 점원.
 *
 * 토리카는 현재 임시 배치다. 최종 점원이 확정되면 씬 코드를 고치지 않고 이 표만 교체하도록
 * 운영 데이터 경계에 둔다.
 *
 * **이름을 여기 적지 않는다.** 점원은 개체이고 개체 이름은 `src/data/relics.ts`가 이미 갖는다 —
 * 여기에 한 번 더 적으면 도감에서 이름을 고친 뒤 상점만 옛 이름으로 남는다.
 */
export const SHOP_MERCHANT: { readonly relicId: string; readonly asset: PuppetAsset } = {
  relicId: "anky",
  asset: TORIKA_ASSET,
};

/** 예전 이름을 읽던 자리를 위해 자산만 그대로 공개한다. */
export const SHOP_MERCHANT_ASSET: PuppetAsset = SHOP_MERCHANT.asset;
