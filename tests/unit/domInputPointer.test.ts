import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 캔버스 위에 띄우는 DOM 입력은 손을 받지 않는다 — 초점은 Phaser 입력면이 준다.
 * DOM 요소는 판에 가려지지 않아, 뒤 화면의 검색 칸이 위에 열린 판의 버튼 자리에서 손을 받아 자판을 올렸다
 * (룬 정비 창, 응태 2026-11-18). `scene.add.dom`을 쓰는 파일은 그 요소의 `pointerEvents`를 끈다.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("DOM 입력의 손", () => {
  it("scene.add.dom으로 세운 요소는 pointerEvents를 끈다", () => {
    const offenders = files("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes(".add.dom(") && !source.includes('pointerEvents = "none"');
    });
    expect(offenders).toEqual([]);
  });
});
