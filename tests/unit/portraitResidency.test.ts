import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("도감 원화 상주", () => {
  const card = readFileSync("src/ui/PortraitCard.ts", "utf8");
  const scene = readFileSync("src/scenes/RelicsScene.ts", "utf8");
  it("도감 카드는 원화를 미뤄 올리고 스크롤마다 보이는 줄만 올린다", () => {
    expect(scene).toContain("deferPortrait: true");
    const scroll = scene.slice(scene.indexOf("private scrollTo"));
    expect(scroll.slice(0, 500)).toContain("syncPortraitResidency()");
    expect(scene).toContain("card.hidePortrait()");
  });
  it("카드는 올릴 때마다 따로 붙잡는 객체를 쓰고, 내릴 때 그것을 부순다", () => {
    expect(card).toContain("loadPortraitTexture(this.scene, asset, holder)");
    const hide = card.slice(card.indexOf("public hidePortrait"));
    expect(hide.slice(0, 900)).toContain("this.portraitHolder?.destroy()");
  });
});
