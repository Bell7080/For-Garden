import { describe, expect, it } from "vitest";
import { QA_TOOLS_ENABLED } from "../../src/core/buildFlavor";
import { PLACEHOLDER_AD_ENABLED, TEMP_AD_REWARD_ENABLED, placeholderAdToken, tempAdToken } from "../../src/core/tempAd";
import { presentRewardedAd, releaseAdWait, setTempAdPlayer } from "../../src/platform/rewardedAds";
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
    setTempAdPlayer(async () => { await Promise.resolve(); finished = true; return { release: () => undefined }; });
    try {
      const result = await presentRewardedAd("gold-ad");
      expect(finished).toBe(true);
      expect(result).toEqual({ status: "completed", verificationToken: "verified:gold-ad" });
    } finally {
      setTempAdPlayer(undefined);
    }
  });

  it("임시 광고 팝업이 보상을 받기 전에 닫히면 보상 없이 닫힘으로 끝난다", async () => {
    setTempAdPlayer(async () => undefined);
    try {
      expect(await presentRewardedAd("gold-ad")).toEqual({ status: "dismissed", reason: "temp_ad_closed" });
    } finally {
      setTempAdPlayer(undefined);
    }
  });

  it("보상 받기를 누른 팝업은 지급이 끝나 releaseAdWait가 불릴 때까지 쥐고 있다가 한 번만 놓는다", async () => {
    let released = 0;
    setTempAdPlayer(async () => ({ release: () => { released += 1; } }));
    try {
      await presentRewardedAd("gold-ad");
      expect(released).toBe(0);
      releaseAdWait();
      releaseAdWait();
      expect(released).toBe(1);
    } finally {
      setTempAdPlayer(undefined);
    }
  });

  it("임시 광고 토큰은 슬롯마다 따로 만들어진다", () => {
    expect(TEMP_AD_REWARD_ENABLED).toBe(true);
    expect(tempAdToken("gold-ad")).toBe("temp-ad:gold-ad");
    expect(tempAdToken("gold-ad")).not.toBe(tempAdToken("gem-ad"));
  });
});

describe("출시 전 자리표시 광고", () => {
  it("QA 토큰과 접두사가 다르고 슬롯마다 갈린다", () => {
    expect(PLACEHOLDER_AD_ENABLED).toBe(true);
    expect(placeholderAdToken("gold-ad")).toBe("placeholder-ad:gold-ad");
    expect(placeholderAdToken("gold-ad")).not.toBe(tempAdToken("gold-ad"));
  });
});
