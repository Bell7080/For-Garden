import { describe, expect, it } from "vitest";
import { LAB_CHROME } from "../../src/ui/labLayout";

describe("연구소 배경 층 순서", () => {
  it("비네트는 녹아 드는 원화와 자리 잡은 원화보다 모두 위에 선다", () => {
    const { art, incomingArt, vignette } = LAB_CHROME.depth;
    expect(incomingArt).toBeGreaterThan(art);
    expect(vignette).toBeGreaterThan(incomingArt);
  });
});

describe("픽업 정보 버튼 자리", () => {
  it("오른쪽 아래 화면 안, 확정 판보다 위에 서고 연구 버튼과 떨어져 있다", async () => {
    const { LAB_TITLE } = await import("../../src/ui/labLayout");
    const { x, y, width, height } = LAB_CHROME.pickupInfo;
    const pityTop = LAB_CHROME.pity.y - LAB_CHROME.pity.height / 2;
    // 누르면 커지므로 여유를 두고 확정 판 윗변보다 위에서 끝난다.
    expect(y + height / 2 + height * 0.08).toBeLessThan(pityTop);
    expect(x + width / 2).toBeLessThanOrEqual(1080 - 30);
    expect(x - width / 2).toBeGreaterThan(540);
    // 오른쪽 배너 넘김 꺾쇠(화면 중단)와도 겹치지 않는다.
    expect(y - height / 2).toBeGreaterThan(LAB_TITLE.arrow.y + LAB_TITLE.arrow.height / 2);
  });
});
