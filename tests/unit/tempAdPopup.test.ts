import { describe, expect, it } from "vitest";
import { TEMP_AD } from "../../src/ui/tempAdLayout";

/** 카드 안 세로 자리(가운데 0)의 위·아래 끝. 글자는 가운데에서 위아래로 반 줄씩 선다. */
const { lay, card } = TEMP_AD;
const bands = [
  { name: "제목", top: lay.titleY - 42, bottom: lay.titleY + 42 },
  { name: "SD", top: lay.sdGroundY - TEMP_AD.sdHeight, bottom: lay.sdGroundY + 20 },
  { name: "게이지", top: lay.barY - TEMP_AD.bar.height / 2, bottom: lay.barY + TEMP_AD.bar.height / 2 },
  { name: "퍼센트", top: lay.percentY - 22, bottom: lay.percentY + 22 },
  { name: "버튼", top: lay.buttonY - lay.buttonHeight / 2 * 1.06, bottom: lay.buttonY + lay.buttonHeight / 2 * 1.06 },
];

describe("임시 광고 팝업 배치", () => {
  it("위에서 아래로 놓인 칸이 서로 겹치지 않는다", () => {
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i - 1]!.bottom, `${bands[i - 1]!.name} → ${bands[i]!.name}`).toBeLessThanOrEqual(bands[i]!.top);
    }
  });

  it("모든 칸이 카드 안에 든다", () => {
    for (const band of bands) {
      expect(band.top, band.name).toBeGreaterThanOrEqual(-card.height / 2);
      expect(band.bottom, band.name).toBeLessThanOrEqual(card.height / 2);
    }
  });
});
