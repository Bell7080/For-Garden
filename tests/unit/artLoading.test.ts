import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { idlePrefetchAllowed } from "../../src/core/idleFilePrefetch";

describe("원화 로딩 고리", () => {
  it("교류 도시 원화·상점 점원은 도착 전까지 그 자리에 로딩 고리를 세운다", () => {
    const interaction = readFileSync("src/scenes/InteractionScene.ts", "utf8");
    expect(interaction).toContain("showArtLoadingRing(");
    expect(interaction).toContain("() => loading?.done()");
    const shop = readFileSync("src/scenes/ShopScene.ts", "utf8");
    expect(shop).toContain("showArtLoadingRing(");
    expect(shop).toContain(".finally(() => loading.done())");
  });
  it("못 읽은 원화도 기다림을 끝낸다(고리가 남지 않는다)", () => {
    const src = readFileSync("src/ui/backgrounds.ts", "utf8");
    expect(src).toContain("if (!ok || !image.active || !image.scene) { onSettled?.(); return; }");
  });
});

describe("로비 유휴 미리 받기", () => {
  it("셀룰러로 알려진 연결·데이터 절약만 건너뛰고, 모르는 연결(iOS)은 받는다", () => {
    expect(idlePrefetchAllowed({ type: "wifi" })).toBe(true);
    expect(idlePrefetchAllowed({ type: "ethernet" })).toBe(true);
    expect(idlePrefetchAllowed({})).toBe(true);
    expect(idlePrefetchAllowed(undefined)).toBe(true);
    expect(idlePrefetchAllowed({ type: "cellular" })).toBe(false);
    expect(idlePrefetchAllowed({ type: "wifi", saveData: true })).toBe(false);
  });
});
