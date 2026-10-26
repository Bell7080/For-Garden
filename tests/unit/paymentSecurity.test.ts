import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import type { GameApi } from "../../src/api/contracts";
import { runPlatformPurchase } from "../../src/api/platformPurchase";
import { confirmPlatformProduct } from "../../src/core/productConfirmation";

const product={storefront:"premium" as const,id:"premium-gems-small",acquisition:{kind:"platform_payment" as const,platformProductId:"store.gems",basePriceKrw:1000}};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetModules()});
describe("과금 보상 경계", () => {
  it("다른 SKU 영수증은 확인 콜백으로 보내지 않는다",async()=>{
    const confirm=vi.fn();
    const payment={requestPayment:async()=>({status:"completed" as const,receipt:{platform:"google",productId:"other",transactionId:"tx",payload:"receipt"}})};
    expect(await confirmPlatformProduct(product.acquisition,payment,confirm)).toEqual({status:"unavailable"});expect(confirm).not.toHaveBeenCalled();
  });
  it("긴 스토어 거래 ID도 안정적인 64자 이내 멱등 키를 쓰고 플랫폼을 구분한다",async()=>{
    const verify=vi.fn(async()=>({verificationId:"proof",productId:product.id,transactionId:"tx",verified:true}));
    const fulfill=vi.fn(async()=>({productId:product.id}));
    const api={getProducts:async()=>({products:[{...product,purchasable:true}]}),verifyPurchaseReceipt:verify,fulfillPlatformPurchase:fulfill} as unknown as GameApi;
    const payment=(platform:string)=>({requestPayment:async()=>({status:"completed" as const,receipt:{platform,productId:"store.gems",transactionId:"x".repeat(1000),payload:"receipt"}})});
    await runPlatformPurchase(api,payment("google"),product);await runPlatformPurchase(api,payment("google"),product);await runPlatformPurchase(api,payment("apple"),product);
    const ids=verify.mock.calls.map(c=>(c as unknown as [{requestId:string}])[0].requestId);
    expect(ids[0]).toBe(ids[1]);expect(ids[0]).not.toBe(ids[2]);expect(ids.every(id=>id.length<=64)).toBe(true);
    expect(fulfill.mock.calls.every(c=>(c as unknown as [{requestId:string}])[0].requestId.length<=64)).toBe(true);
  });
  it("영수증 본문이 갱신돼도 같은 검증 거래의 지급 키는 유지하고 SDK 오류 원문을 노출하지 않는다",async()=>{
    const verify=vi.fn(async()=>({verificationId:"proof",productId:product.id,transactionId:"store-transaction",verified:true}));
    const fulfill=vi.fn(async()=>({productId:product.id}));
    const api={getProducts:async()=>({products:[{...product,purchasable:true}]}),verifyPurchaseReceipt:verify,fulfillPlatformPurchase:fulfill} as unknown as GameApi;
    for(const payload of ["old-receipt","refreshed-receipt"])await runPlatformPurchase(api,{requestPayment:async()=>({status:"completed",receipt:{platform:"google",productId:"store.gems",transactionId:"sdk-transaction",payload}})},product);
    const v=verify.mock.calls as unknown as [{requestId:string}][];const f=fulfill.mock.calls as unknown as [{requestId:string}][];
    expect(v[0][0].requestId).not.toBe(v[1][0].requestId);expect(f[0][0].requestId).toBe(f[1][0].requestId);
    const failed=await runPlatformPurchase(api,{requestPayment:async()=>{throw Error("sensitive SDK receipt payload")}},product);
    expect(failed).toEqual({status:"failed",message:""});
  });
  it("WebView에 WebCrypto가 없으면 결제 SDK를 호출하기 전에 중단한다",async()=>{
    vi.stubGlobal("crypto",{});
    const charge=vi.fn();
    const result=await runPlatformPurchase({} as GameApi,{requestPayment:charge},product);
    expect(result.status).toBe("unsupported");expect(charge).not.toHaveBeenCalled();
  });
  it("검증자가 잘못된 형태의 거래 ID를 반환하면 저장·지급하지 않는다",async()=>{
    const state=createDefaultSession();const before={...state.wallet};
    const server=new FakeServer(state,{latencyMs:0,persistSession:()=>undefined,verifyPurchaseReceipt:()=>({}) as unknown as string});
    await expect(server.verifyPurchaseReceipt({platform:"google",productId:"premium-gems-small",receipt:"provider-payload",requestId:"invalid-provider-result"})).rejects.toMatchObject({code:"RECEIPT_INVALID"});
    expect(state.wallet).toEqual(before);
  });
  it("검증·지급 사이 서버 객체가 재생성돼도 복구하고 구 패스 API와 중복 지급하지 않는다",async()=>{
    let state=createDefaultSession();
    const options={latencyMs:0,persistSession:()=>undefined,now:()=>new Date("2026-10-25T00:00:00Z")};
    const receipt=await new FakeServer(state,options).verifyPurchaseReceipt({platform:"test",productId:"premium-adfree",receipt:"verified-receipt:premium-adfree:security-tx",requestId:"verify-security"});
    state=saveManager.parse(saveManager.exportData(state));
    await new FakeServer(state,options).activatePass({verificationId:receipt.verificationId,requestId:"activate-security"});
    const wallet={...state.wallet};state=saveManager.parse(saveManager.exportData(state));
    await new FakeServer(state,options).fulfillPlatformPurchase({verificationId:receipt.verificationId,requestId:"fulfill-security"});
    expect(state.wallet).toEqual(wallet);
  });
  it("네이티브 빌드는 웹 토큰 저장소를 기본값으로 사용할 수 없다",async()=>{
    vi.resetModules();vi.stubEnv("VITE_APP_TARGET","ios");
    const {createWebTokenStore}=await import("../../src/api/webTokenStore");
    expect(createWebTokenStore({getItem:()=>null,setItem:vi.fn(),removeItem:vi.fn()})).toBeNull();
  });
});
