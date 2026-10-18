import { describe, expect, it } from "vitest";
import { QA_TOOLS_ENABLED } from "../../src/core/buildFlavor";
import { presentRewardedAd, setTempAdPlayer } from "../../src/platform/rewardedAds";
import { platformPayment } from "../../src/platform/payment";
import { PRODUCTS } from "../../src/data/shopCatalog";

describe("QA 빌드의 광고·결제 우회", () => {
  it("테스트 환경(QA 도구 켜짐)에서는 광고를 본 것으로 치고 결제를 한 것으로 친다", async () => {
    expect(QA_TOOLS_ENABLED).toBe(true);
    expect(await presentRewardedAd("gem-ad")).toEqual({ status: "completed", verificationToken: "verified:gem-ad" });
    const product = PRODUCTS.find(({ acquisition }) => acquisition.kind === "platform_payment");
    if (!product || product.acquisition.kind !== "platform_payment") throw new Error("platform product missing");
    const result = await platformPayment().requestPayment(product.acquisition.platformProductId);
    expect(result.status).toBe("completed");
    if (result.status === "completed") expect(result.receipt.payload.startsWith(`verified-receipt:${product.id}:`)).toBe(true);
  });

  it("임시 광고 팝업이 걸려 있으면 그것이 끝난 뒤에야 광고 완료와 같은 토큰을 돌려준다", async () => {
    let finished = false;
    setTempAdPlayer(async () => { await Promise.resolve(); finished = true; return true; });
    try {
      const result = await presentRewardedAd("gold-ad");
      expect(finished).toBe(true);
      expect(result).toEqual({ status: "completed", verificationToken: "verified:gold-ad" });
    } finally {
      setTempAdPlayer(undefined);
    }
  });

  it("임시 광고 팝업이 보상을 받기 전에 닫히면 보상 없이 닫힘으로 끝난다", async () => {
    setTempAdPlayer(async () => false);
    try {
      expect(await presentRewardedAd("gold-ad")).toEqual({ status: "dismissed", reason: "temp_ad_closed" });
    } finally {
      setTempAdPlayer(undefined);
    }
  });
});
