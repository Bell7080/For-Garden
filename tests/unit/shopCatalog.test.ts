import { describe, expect, it } from "vitest";
import { PRODUCTS, SHOP_PRODUCT_ICON_ASSETS, SHOP_TABS } from "../../src/data/shopCatalog";
import { SHOP_STAGE_PRESENTATION } from "../../src/data/shopPresentation";
import { SHOP_DIALOGUE, SHOP_STAGE, shopDialogueSpot } from "../../src/ui/shopLayout";
import { BASE_WIDTH } from "../../src/config/gameConfig";

/** 카탈로그 탭과 상품 메타데이터가 화면 코드 없이 완결되는지 검증한다. */
describe("shop catalog", () => {
  it("owns the requested tab order and gives every product a valid category", () => {
    // 기획 순서는 배열 순서 자체이며 상품은 반드시 그중 한 탭에 속해야 한다.
    expect(SHOP_TABS.map(({ id }) => id)).toEqual(["general", "enhancement", "rune"]);
    const categories = new Set(SHOP_TABS.map(({ id }) => id));
    expect(PRODUCTS.every(({ category }) => categories.has(category))).toBe(true);
  });

  it("registers every product icon key in the temporary asset table", () => {
    // 최종 원화 경로가 바뀌어도 데이터가 가리키는 key 누락은 로딩 전에 잡는다.
    const iconKeys = new Set(SHOP_PRODUCT_ICON_ASSETS.map(([key]) => key));
    expect(PRODUCTS.every(({ iconKey }) => iconKeys.has(iconKey))).toBe(true);
  });
});

describe("상점 무대", () => {
  it("의 점원은 얼굴이 대사 띠에 덮이지 않고 화면 안에 선다", () => {
    // 무대는 머리 관절을 한 점에 고정하고 키로 배율을 정한다. 관절 **오른쪽에 그려진 몫**이
    // 넓은 원화는 같은 자리에서 화면 밖으로 넘친다 — 프로티아가 그래서 두개골이 잘렸다.
    const dialogueRight = shopDialogueSpot().centerX + SHOP_DIALOGUE.width / 2;
    for (const key of ["shop", "archaeology"] as const) {
      const stage = SHOP_STAGE_PRESENTATION[key];
      const { headX, height } = stage.merchantSpot ?? SHOP_STAGE.merchant;
      const art = stage.merchant.asset;
      const scale = height / (art.content.bottom - art.content.top);
      const head = art.joints?.head;
      expect(head, key).toBeDefined();
      const right = headX + (art.content.right - head![0]) * scale;
      const left = headX - (head![0] - art.content.left) * scale;
      // 얼굴은 대사 띠 오른쪽에 선다. 띠 안에 들어가면 말풍선이 제 얼굴을 덮는다.
      expect(headX, key).toBeGreaterThan(dialogueRight);
      // 실루엣은 화면 안에서 끝난다 — 변에서 잘리면 들고 있는 것이 잘린 것처럼 보인다.
      expect(right, key).toBeLessThanOrEqual(BASE_WIDTH);
      expect(left, key).toBeGreaterThanOrEqual(0);
    }
  });
});
