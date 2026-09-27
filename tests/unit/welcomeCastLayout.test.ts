import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { getBanner, WELCOME_SSR_POOL } from "../../src/data/banners";
import { labPityTop, labTitleTagsBottom, WELCOME_CAST, welcomeCastBottom, welcomeCastTagReach, welcomeCastTop } from "../../src/ui/welcomeCastLayout";
import { LAB_TITLE } from "../../src/ui/labLayout";

describe("첫 복원 연구 SD 자리", () => {
  it("은 배너가 SSR 풀 넷을 그대로 세운다", () => {
    expect(getBanner("welcome").castRelicIds).toEqual(WELCOME_SSR_POOL);
    expect(WELCOME_CAST.spots).toHaveLength(WELCOME_SSR_POOL.length);
  });

  it("은 발끝이 SSR 확정 판보다 위에서 끝나고 이름표가 제목 라벨 줄 아래에서 시작한다", () => {
    expect(welcomeCastBottom()).toBeLessThan(labPityTop());
    expect(welcomeCastTop()).toBeGreaterThan(labTitleTagsBottom());
  });

  it("의 이름표는 화면 밖으로 나가지 않고 배너 넘김 꺾쇠를 덮지 않는다", () => {
    const reach = welcomeCastTagReach();
    const arrowReach = LAB_TITLE.arrow.x + LAB_TITLE.arrow.width / 2;
    for (const spot of WELCOME_CAST.spots) {
      expect(spot.x - reach).toBeGreaterThan(arrowReach);
      expect(spot.x + reach).toBeLessThan(BASE_WIDTH - arrowReach);
    }
  });

  it("은 바깥 둘이 앞(크게·낮게) 서서 가운데를 향하고, 안쪽 둘이 뒤에 선다", () => {
    const [a, b, c, d] = WELCOME_CAST.spots;
    expect(a.groundY).toBeGreaterThan(b.groundY);
    expect(d.groundY).toBeGreaterThan(c.groundY);
    expect(a.height).toBeGreaterThan(b.height);
    // 같은 줄의 두 이름표는 뱃지·돋보기까지 서로 겹치지 않는다.
    expect(c.x - b.x).toBeGreaterThan(welcomeCastTagReach() * 2);
  });
});
