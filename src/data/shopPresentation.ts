import { registerDataText } from "../i18n";
import { SHOP_CLERK_ASSET, type PuppetAsset } from "../puppets/assets";

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
