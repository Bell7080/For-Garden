import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { ARCHAEOLOGY_SITES } from "../../src/data/archaeologySites";
import { strataBoardFrame } from "../../src/ui/strataBoardLayout";
import { SIDE_DRAWER, sideDrawerBounds, sideDrawerHandleX, sideDrawerOffsetX } from "../../src/ui/sideDrawerLayout";

/**
 * 고고학 발굴 중 뒤의 상점이 눌리던 회귀(응태 2026-11-24).
 * 판이 서 있는 동안 상점 칩은 서랍으로 들어가고, 서랍은 열려 있든 닫혀 있든 판 무대·굴착 게이지 판과 겹치지 않아야 한다.
 */
describe("곁 버튼 서랍", () => {
  /** 굴착 게이지 판(`ARCHAEOLOGY.digsPanel` — 가운데 정렬 폭 620)의 왼쪽 끝. */
  const digsPanelLeft = BASE_WIDTH / 2 - 620 / 2;

  it("열려도 닫혀도 모든 유적의 판 칸·굴착 게이지 판과 겹치지 않는다", () => {
    for (const open of [false, true]) {
      const box = sideDrawerBounds(1, open);
      for (const site of ARCHAEOLOGY_SITES) {
        const frame = strataBoardFrame(site.board.columns, site.board.rows, BASE_WIDTH);
        const boardLeft = frame.centerX - frame.width / 2;
        const boardTop = frame.centerY - frame.height / 2;
        // 칸과 위아래 또는 좌우로 갈린다 — 같은 자리를 나눠 쓰지 않는다.
        expect(box.bottom < boardTop || box.right < boardLeft, `${site.id} ${open ? "열림" : "닫힘"}`).toBe(true);
      }
      expect(box.right).toBeLessThan(digsPanelLeft);
    }
  });

  it("닫힌 손잡이는 어떤 판 칸보다도 왼쪽에 선다", () => {
    const box = sideDrawerBounds(1, false);
    for (const site of ARCHAEOLOGY_SITES) {
      const frame = strataBoardFrame(site.board.columns, site.board.rows, BASE_WIDTH);
      expect(box.right).toBeLessThan(frame.centerX - frame.width / 2);
    }
  });

  it("닫히면 손잡이만 화면 왼쪽 끝에 남는다", () => {
    const handleCenter = sideDrawerHandleX(1) + sideDrawerOffsetX(1, false);
    expect(handleCenter - SIDE_DRAWER.handle.width / 2).toBe(0);
    expect(sideDrawerOffsetX(1, true)).toBe(0);
  });

  it("발굴판 무대는 손을 삼키고, 판이 서면 상점 칩이 숨는다", () => {
    const source = readFileSync("src/scenes/ArchaeologyScene.ts", "utf8");
    expect(source).toMatch(/stage\.add\(this\.add\.rectangle\(0, 0, width, height, 0xffffff, 0\)\.setInteractive\(\)\)/);
    expect(source).toMatch(/this\.shopLink\?\.setVisible\(!boardShown\)/);
  });
});
