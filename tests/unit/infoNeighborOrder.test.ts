import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("정보창 옆으로 넘기기", () => {
  it("적·소환 전용 개체가 섞이지 않도록 도감에 서는 개체 목록만 순회한다", () => {
    const source = readFileSync(new URL("../../src/ui/info.ts", import.meta.url), "utf8");
    const body = source.slice(source.indexOf("private slideToNeighbor"));
    expect(body.slice(0, 400)).toContain("this.neighborOrder(current.id)");
    expect(source).toContain(": PLAYABLE_RELICS;");
  });

  it("도감은 화면에 선 순서(보유 → 미보유, 정렬·필터 반영)를 넘김 순서로 넘긴다", () => {
    const scene = readFileSync(new URL("../../src/scenes/RelicsScene.ts", import.meta.url), "utf8");
    expect(scene).toContain("this.info.setNeighborOrder([...owned, ...locked]);");
  });
});

describe("정보창 연달아 넘기기", () => {
  const source = readFileSync(new URL("../../src/ui/info.ts", import.meta.url), "utf8");

  it("지나쳐 온 개체의 전신·SD는 모델 생성 전에 취소한다", () => {
    expect(source).toContain("isStale: () => request !== this.portraitRequest");
    expect(source).toContain("isStale: () => request !== this.figureRequest");
    expect(source).toContain("PuppetSpawnCancelled");
  });

  it("앞선 읽기가 남은 채 넘기면 손이 멈출 때까지 새 읽기를 미룬다", () => {
    expect(source).toContain("this.sliding && this.pendingLoads > 0");
  });

  it("넘기는 도중 열기가 던져도 잠금이 남지 않는다", () => {
    const body = source.slice(source.indexOf("private slideToNeighbor"));
    expect(body.slice(0, 1600)).toContain("this.sliding = false;\n          this.chrome.setPosition(0, 0)");
  });
});
