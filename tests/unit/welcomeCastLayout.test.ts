import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { getBanner, WELCOME_SSR_POOL } from "../../src/data/banners";
import { labPityTop, WELCOME_CAST, welcomeCastBottom } from "../../src/ui/welcomeCastLayout";
import { LAB_TITLE } from "../../src/ui/labLayout";

describe("첫 복원 연구 SD 자리", () => {
  it("은 배너가 SSR 풀 넷을 그대로 세운다", () => {
    expect(getBanner("welcome").castRelicIds).toEqual(WELCOME_SSR_POOL);
    expect(WELCOME_CAST.spots).toHaveLength(WELCOME_SSR_POOL.length);
  });

  it("의 이름판은 SSR 확정 판보다 위에서 끝나고 화면 밖으로 나가지 않는다", () => {
    expect(welcomeCastBottom()).toBeLessThan(labPityTop());
    for (const spot of WELCOME_CAST.spots) {
      expect(spot.x - WELCOME_CAST.plate.width / 2).toBeGreaterThan(0);
      expect(spot.x + WELCOME_CAST.plate.width / 2).toBeLessThan(BASE_WIDTH);
    }
  });

  it("은 바깥 둘이 앞(크게·낮게), 안쪽 둘이 뒤에 서고 이웃 이름판이 겹치지 않는다", () => {
    const [a, b, c, d] = WELCOME_CAST.spots;
    expect(a.groundY).toBeGreaterThan(b.groundY);
    expect(d.groundY).toBeGreaterThan(c.groundY);
    expect(a.height).toBeGreaterThan(b.height);
    // 같은 줄의 두 이름판(뒤 둘)은 폭보다 멀리 떨어져 선다.
    expect(c.x - b.x).toBeGreaterThan(WELCOME_CAST.plate.width);
  });

  it("의 머리는 제목 라벨 줄 아래에서 시작한다", () => {
    for (const spot of WELCOME_CAST.spots) expect(spot.groundY - spot.height).toBeGreaterThan(LAB_TITLE.tagY + LAB_TITLE.tagHeight);
  });
});
