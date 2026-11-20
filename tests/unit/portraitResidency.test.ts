import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cullGridCards } from "../../src/ui/portraitGrid";

describe("도감 원화 상주", () => {
  const card = readFileSync("src/ui/PortraitCard.ts", "utf8");
  const scene = readFileSync("src/scenes/RelicsScene.ts", "utf8");
  it("도감 카드는 원화를 미뤄 올리고 스크롤마다 보이는 줄만 올린다", () => {
    expect(scene).toContain("deferPortrait: true");
    const scroll = scene.slice(scene.indexOf("private scrollTo"));
    expect(scroll.slice(0, 500)).toContain("syncPortraitResidency(");
  });
  it("카드는 올릴 때마다 따로 붙잡는 객체를 쓰고, 내릴 때 그것을 부순다", () => {
    expect(card).toContain("loadPortraitTexture(this.scene, asset, holder)");
    const hide = card.slice(card.indexOf("public hidePortrait"));
    expect(hide.slice(0, 900)).toContain("this.portraitHolder?.destroy()");
  });
  it("편성·원정 목록도 같은 규칙으로 보이는 줄만 올린다", () => {
    for (const file of ["src/scenes/PartyScene.ts", "src/scenes/ExpeditionScene.ts"]) {
      const src = readFileSync(file, "utf8");
      expect(src).toContain("deferPortrait: true");
      expect(src).toContain("syncPortraitResidency(");
    }
  });
});

describe("화면 밖 카드 그리지 않기", () => {
  const make = (y: number) => {
    const card = { y, visible: true, calls: 0, setVisible(v: boolean) { this.visible = v; this.calls += 1; } };
    return card;
  };
  it("뷰포트 위아래 카드 한 장 여유 안만 보이고, 바뀐 카드만 건드린다", () => {
    const cards = [make(-500), make(150), make(500), make(1250), make(2200)];
    cullGridCards(cards, 0, { top: 100, bottom: 1000 }, 300);
    expect(cards.map((c) => c.visible)).toEqual([false, true, true, true, false]);
    cullGridCards(cards, 0, { top: 100, bottom: 1000 }, 300);
    expect(cards.map((c) => c.calls)).toEqual([1, 0, 0, 0, 1]);
    cullGridCards(cards, -1500, { top: 100, bottom: 1000 }, 300);
    expect(cards.map((c) => c.visible)).toEqual([false, false, false, false, true]);
  });
  it("도감·편성·원정 목록이 스크롤마다 화면 밖 카드를 끈다", () => {
    for (const file of ["src/scenes/RelicsScene.ts", "src/scenes/PartyScene.ts", "src/scenes/ExpeditionScene.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("cullGridCards(");
    }
  });
});
