import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { RATES_BUTTON, RATES_SPOT } from "../../src/ui/ratesButtonLayout";
import { RUNE_SYNTHESIS, runeSynthesisCenter, runeSynthesisInfoBounds, runeSynthesisPlateBounds, runeSynthesisVertices } from "../../src/ui/runeSynthesisLayout";

type Box = { left: number; right: number; top: number; bottom: number };
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("룬 합성대 자리", () => {
  // 전설 룬이 가장 길다 — 주 옵션 둘 + 보조 셋 + 특성 한 줄.
  const LINES = 6;
  const plate = runeSynthesisPlateBounds(BASE_WIDTH);
  const vertices = runeSynthesisVertices(BASE_WIDTH);
  const half = RUNE_SYNTHESIS.slot / 2;
  const frames: Box[] = vertices.map(({ x, y }) => ({ left: x - half, right: x + half, top: y - half, bottom: y + half }));
  const infos = [0, 1, 2].map((index) => runeSynthesisInfoBounds(BASE_WIDTH, index, LINES));

  it("세 칸은 한 줄에 같은 간격으로 서고 판 가운데에 대칭이다", () => {
    expect(vertices[0].y).toBe(vertices[1].y);
    expect(vertices[1].y).toBe(vertices[2].y);
    expect(vertices[1].x - vertices[0].x).toBeCloseTo(vertices[2].x - vertices[1].x);
    expect(vertices[1].x).toBeCloseTo((plate.left + plate.right) / 2);
  });

  it("능력 판은 제 칸 바로 밑에 서고 판 안에 든다", () => {
    infos.forEach((info, index) => {
      expect(info.top).toBeGreaterThanOrEqual(frames[index].bottom);
      expect((info.left + info.right) / 2).toBeCloseTo(vertices[index].x);
      expect(info.left).toBeGreaterThanOrEqual(plate.left);
      expect(info.right).toBeLessThanOrEqual(plate.right);
      expect(info.bottom).toBeLessThanOrEqual(plate.bottom);
      for (const frame of frames) expect(overlaps(info, frame)).toBe(false);
    });
    expect(overlaps(infos[0], infos[1])).toBe(false);
    expect(overlaps(infos[1], infos[2])).toBe(false);
  });

  it("칸 줄은 왼쪽 열의 확률 버튼 밑에서 시작한다(긴 언어에서 버튼이 넓어져도 겹치지 않는다)", () => {
    expect(frames[0].top).toBeGreaterThanOrEqual(RATES_SPOT.screen.y + RATES_BUTTON.height / 2);
    // 그 아래 왼쪽 열은 룬 가방 칩(곁 상점 칩과 같은 폭)뿐이다.
    expect(infos[0].left).toBeGreaterThanOrEqual(RATES_SPOT.bagChip.x + RATES_SPOT.bagChip.size / 2);
  });

  it("가운데 빛은 칸 줄 위 판 안에 서고 칸과 겹치지 않는다", () => {
    const center = runeSynthesisCenter(BASE_WIDTH);
    const core: Box = { left: center.x - RUNE_SYNTHESIS.core / 2, right: center.x + RUNE_SYNTHESIS.core / 2, top: center.y - RUNE_SYNTHESIS.core / 2, bottom: center.y + RUNE_SYNTHESIS.core / 2 };
    expect(core.top).toBeGreaterThanOrEqual(plate.top);
    for (const frame of frames) expect(overlaps(core, frame)).toBe(false);
  });
});
