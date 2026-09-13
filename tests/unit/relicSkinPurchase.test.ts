import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import { RELIC_SKINS } from "../../src/data/relicSkins";
import type { RelicSkinId } from "../../src/core/types";

/**
 * 외형 구매는 **화면이 아니라 서버 경계**가 확정한다.
 *
 * 값은 콘텐츠 표(`RELIC_SKINS`의 `price`)가 갖고, 지갑 대조·차감·지급이 한 처리 단위로 돈다 —
 * 전시관은 "이 외형을 사겠다"만 보낸다. 지금 표에는 값이 붙은 외형이 하나도 없어 실제로 치르는
 * 길은 콘텐츠가 들어와야 열리므로, 여기서는 **거절 경로와 계약 모양**을 고정한다.
 */
describe("렐릭 외형 구매 경계", () => {
  const server = new FakeServer();
  const buy = (relicId: string, skinId: string) =>
    server.purchaseRelicSkin({ relicId, skinId: skinId as RelicSkinId, requestId: `t:${relicId}:${skinId}` });

  it("없는 외형과 대상이 어긋난 외형을 거절한다", async () => {
    await expect(buy("anky", "없는-외형")).rejects.toBeInstanceOf(GameApiError);
    // 표에 있는 외형이라도 그 렐릭의 것이 아니면 살 수 없다 — 값만 맞으면 아무나 입는 일이 없다.
    await expect(buy("dodo", RELIC_SKINS[0].id)).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });

  it("값이 붙지 않은 외형은 살 수 있는 것이 아니다", async () => {
    // 보상·이벤트로만 오는 외형(값 없음)과 아직 열리지 않은 외형이 여기로 떨어진다.
    const free = RELIC_SKINS.find((skin) => !skin.price)!;
    await expect(buy(free.relicId, free.id)).rejects.toMatchObject({ code: "ITEM_NOT_USABLE" });
  });

  it("값이 붙은 외형은 콘텐츠 표에만 적는다", () => {
    // 화면이 값을 들고 있으면 그 값을 고친 날 전시대와 실제 차감이 갈린다. 표의 값은
    // 통화 키와 양수 금액이라는 계약만 지키면 된다.
    for (const skin of RELIC_SKINS) {
      if (!skin.price) continue;
      expect(skin.price.amount).toBeGreaterThan(0);
      expect(typeof skin.price.currency).toBe("string");
    }
  });
});
