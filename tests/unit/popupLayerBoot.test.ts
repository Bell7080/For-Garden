import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 팝업 층은 씬 생성자 안에서 만들어질 수 있다 — 상점·프리미엄·환경설정이 필드 초기화로 둔다.
 * 그때 `scene.events`는 아직 없으므로, 생성자가 그걸 건드리면 게임이 부팅되며 모든 씬을 만드는
 * 순간 통째로 죽는다(v0.55.8에서 실제로 그랬다). 씬 이벤트는 첫 팝업을 열 때 늦게 건다.
 */
describe("PopupLayer 부팅 계약", () => {
  const source = readFileSync(new URL("../../src/ui/PopupLayer.ts", import.meta.url), "utf8");

  it("생성자는 씬 이벤트를 건드리지 않는다", () => {
    const start = source.indexOf("constructor(private readonly scene: Phaser.Scene");
    expect(start).toBeGreaterThan(-1);
    const open = source.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
    }
    expect(source.slice(open, end + 1)).not.toContain("events");
  });

  it("팝업 층을 필드 초기화로 두는 씬이 실제로 있다 — 그래서 위 계약이 필요하다", () => {
    const shop = readFileSync(new URL("../../src/scenes/ShopScene.ts", import.meta.url), "utf8");
    expect(shop).toMatch(/private readonly popups = new PopupLayer\(this/);
  });
});
