import { describe, expect, it } from "vitest";
import { coverSourceCrop, STRATA_ART, STRATA_BOARD, strataBoardFrame, strataCropPlacement, strataTileCenter, strataTileCrop, type SourceCropRect } from "../../src/ui/strataBoardLayout";

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

/**
 * 칸 하나하나가 배경 한 장을 나눠 깔고 있는지는, 그린 자리에서만 드러난다.
 * crop은 원점을 원화 전체에 두므로 배율과 위치를 함께 검증해야 이음매가 맞는지 알 수 있다.
 */
describe("지층 겉장 조각 배치", () => {
  /** 원점 0.5인 표시 객체가 그 배율·위치로 실제로 그리는 화면 사각형이다. */
  function drawnRect(crop: SourceCropRect, placement: { x: number; y: number; scaleX: number; scaleY: number }) {
    const left = placement.x + placement.scaleX * (crop.x - STRATA_ART.width / 2);
    const top = placement.y + placement.scaleY * (crop.y - STRATA_ART.height / 2);
    return { left, top, right: left + placement.scaleX * crop.width, bottom: top + placement.scaleY * crop.height };
  }

  it("판 전체 크롭을 판 사각형에 남김없이 채운다", () => {
    const frame = strataBoardFrame(5, 5, 1080);
    const crop = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height);
    const drawn = drawnRect(crop, strataCropPlacement(crop, { centerX: 0, centerY: 0, width: frame.width, height: frame.height }));
    expect(drawn.left).toBeCloseTo(-frame.width / 2, 6);
    expect(drawn.top).toBeCloseTo(-frame.height / 2, 6);
    expect(drawn.right).toBeCloseTo(frame.width / 2, 6);
    expect(drawn.bottom).toBeCloseTo(frame.height / 2, 6);
  });

  it.each([[5, 5], [6, 4], [3, 7]])("%d×%d 판의 모든 칸이 제 칸을 꽉 채우고 이웃과 이어진다", (columns, rows) => {
    const frame = strataBoardFrame(columns, rows, 1080);
    const boardCrop = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height);
    for (let index = 0; index < columns * rows; index += 1) {
      const crop = strataTileCrop(index, columns, rows, boardCrop);
      const center = strataTileCenter(index, columns, frame);
      const target = { centerX: center.x, centerY: center.y, width: frame.cellWidth, height: frame.cellHeight };
      const drawn = drawnRect(crop, strataCropPlacement(crop, target));
      expect(drawn.left).toBeCloseTo(center.x - frame.cellWidth / 2, 6);
      expect(drawn.top).toBeCloseTo(center.y - frame.cellHeight / 2, 6);
      expect(drawn.right).toBeCloseTo(center.x + frame.cellWidth / 2, 6);
      expect(drawn.bottom).toBeCloseTo(center.y + frame.cellHeight / 2, 6);
    }
  });

  it("모든 칸이 판 전체와 같은 배율로 서서 조각 사이의 결이 이어진다", () => {
    const frame = strataBoardFrame(5, 5, 1080);
    const boardCrop = coverSourceCrop(STRATA_ART.width, STRATA_ART.height, frame.width, frame.height);
    const board = strataCropPlacement(boardCrop, { centerX: 0, centerY: 0, width: frame.width, height: frame.height });
    for (let index = 0; index < 25; index += 1) {
      const crop = strataTileCrop(index, 5, 5, boardCrop);
      const center = strataTileCenter(index, 5, frame);
      const tile = strataCropPlacement(crop, { centerX: center.x, centerY: center.y, width: frame.cellWidth, height: frame.cellHeight });
      expect(tile.scaleX).toBeCloseTo(board.scaleX, 6);
      expect(tile.scaleY).toBeCloseTo(board.scaleY, 6);
    }
  });
});
