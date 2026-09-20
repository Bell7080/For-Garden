import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRODUCTS, SHOP_PRODUCT_ICON_ASSETS } from "../../src/data/shopCatalog";
import { SHOP_STAGE_PRESENTATION, shopStagePresentation } from "../../src/data/shopPresentation";
import { SHOP_DIALOGUE, SHOP_ENTRANCE, SHOP_STAGE, shopDialogueSpot, shopStageSettleMs } from "../../src/ui/shopLayout";
import { BASE_WIDTH } from "../../src/config/gameConfig";

/** 카탈로그 탭과 상품 메타데이터가 화면 코드 없이 완결되는지 검증한다. */
describe("shop catalog", () => {
  it("owns the requested tab order and gives every product a valid category", () => {
    // 탭 순서는 그 자리의 무대표가 갖는다 — 씬이 한 표를 고정으로 그리면 자리가 늘어도
    // 탭이 늘 「일반·강화·룬」이 된다.
    expect(shopStagePresentation("shop").tabs.map(({ id }) => id)).toEqual(["general", "enhancement", "rune"]);
    const categories = new Set(shopStagePresentation("shop").tabs.map(({ id }) => id));
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

describe("상점 등장 순서", () => {
  it("의 기다림을 씬의 시계에서 재지 않는다", () => {
    /*
     * **`create()`가 도는 동안 씬의 시계는 아직 0이다.**
     *
     * 거기에 더해 둔 시각(`time.now + settle`)으로 기다림을 재던 때는, 점원 묶음이 도착할
     * 즈음이면 그 시각이 이미 지나 있어 기다림이 통째로 0으로 접혔다 — 점원이 전시대와 함께
     * 미끄러져 들어와 잘린 하반신이 드러났고, 첫 마디도 화면이 조립되는 중에 떴다가 플레이어가
     * 무대를 보기 전에 사라졌다. 기다림은 시각이 아니라 **타이머**가 연다.
     */
    const scene = readFileSync(new URL("../../src/scenes/ShopScene.ts", import.meta.url), "utf8");
    expect(scene).not.toMatch(/this\.time\.now/);
    expect(scene).toContain("await this.stageSettled");
  });

  it("점원은 전시대가 다 올라온 뒤에 들어온다", () => {
    // 점원은 전시대 윗변에서 잘려 있어, 함께 움직이면 그 절단면이 빈 배경 위에 드러난다.
    const settle = shopStageSettleMs();
    expect(settle).toBeGreaterThanOrEqual(SHOP_ENTRANCE.board.duration);
    expect(settle).toBeGreaterThanOrEqual(SHOP_ENTRANCE.grid.delay + SHOP_ENTRANCE.grid.duration);
  });
});
