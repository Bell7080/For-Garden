import { describe, expect, it } from "vitest";
import { LAB_CHROME } from "../../src/ui/labLayout";
import { WELCOME_CAST } from "../../src/ui/welcomeCastLayout";

describe("연구소 배너 넘김 화살표", () => {
  /**
   * 첫 복원 연구의 SD 넷 중 바깥 둘이 화살표 자리까지 걸쳐 서서, 같은 깊이면 SD가 먼저 눌려
   * 배너가 넘어가지 않았다. 손을 받는 순서는 깊이가 정하므로 화살표가 SD보다 위여야 한다.
   */
  it("는 모집판의 SD보다 위에서 손을 받는다", () => {
    expect(LAB_CHROME.depth.arrows).toBeGreaterThan(WELCOME_CAST.depth + 0.4);
  });
});
