import { describe, expect, it } from "vitest";
import { coverSourceCrop, STRATA_ART, STRATA_BOARD, strataBoardFrame, strataTileCenter, strataTileCrop } from "../../src/ui/strataBoardLayout";

/** 판 좌표는 렌더러 없이도 가변 행·열에서 검증할 수 있어야 한다. */
describe("지층 탐사판 정사각 배치", () => {
  it.each([[5, 5], [6, 4], [3, 7]])("%d×%d 판을 가용 영역 안의 정사각 셀로 만든다", (columns, rows) => {
    const frame = strataBoardFrame(columns, rows, 1080);
    expect(frame.cellWidth).toBeCloseTo(frame.cellHeight, 8);
    expect(frame.width).toBeCloseTo(frame.cellWidth * columns, 8);
    expect(frame.height).toBeCloseTo(frame.cellHeight * rows, 8);
    expect(frame.width).toBeLessThanOrEqual(STRATA_BOARD.maxWidth);
    expect(frame.height).toBeLessThanOrEqual(STRATA_BOARD.bottom - STRATA_BOARD.top);
  });

  it.each([[5, 5], [7, 3], [4, 6]])("%d×%d 판의 첫 칸과 끝 칸 경계를 판 모서리에 맞춘다", (columns, rows) => {
    const frame = strataBoardFrame(columns, rows, 1080);
    const first = strataTileCenter(0, columns, frame);
    const last = strataTileCenter(columns * rows - 1, columns, frame);
    expect(first.x - frame.cellWidth / 2).toBeCloseTo(-frame.width / 2, 8);
    expect(first.y - frame.cellHeight / 2).toBeCloseTo(-frame.height / 2, 8);
    expect(last.x + frame.cellWidth / 2).toBeCloseTo(frame.width / 2, 8);
    expect(last.y + frame.cellHeight / 2).toBeCloseTo(frame.height / 2, 8);
  });

  it("세로 원화를 5×5 판에 cover하고 그 원본 크롭 경계를 남김없이 나눈다", () => {
    const crop = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, 1000, 1000);
    const tiles = Array.from({ length: 25 }, (_, index) => strataTileCrop(index, 5, 5, crop));
    expect(crop.width / crop.height).toBeCloseTo(1, 8);
    expect(tiles[0].x).toBeCloseTo(crop.x, 8);
    expect(tiles[0].y).toBeCloseTo(crop.y, 8);
    expect(tiles[24].x + tiles[24].width).toBeCloseTo(crop.x + crop.width, 8);
    expect(tiles[24].y + tiles[24].height).toBeCloseTo(crop.y + crop.height, 8);
  });
});
