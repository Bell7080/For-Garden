import { describe, expect, it } from "vitest";
import { getBanner, WELCOME_SSR_POOL } from "../../src/data/banners";
import {
  labPityTop, labTitleTagsBottom, WELCOME_CAST, WELCOME_SPARKLE, welcomeCastBottom, welcomeCastTop, welcomeSparkle,
} from "../../src/ui/welcomeCastLayout";

describe("첫 복원 연구 SD 자리", () => {
  it("은 배너가 SSR 풀 넷을 그대로 세운다", () => {
    expect(getBanner("welcome").castRelicIds).toEqual(WELCOME_SSR_POOL);
    expect(WELCOME_CAST.spots).toHaveLength(WELCOME_SSR_POOL.length);
  });

  it("은 이름줄이 SSR 확정 판보다 위에서 끝나고 머리가 제목 라벨 줄 아래에서 시작한다", () => {
    expect(welcomeCastBottom()).toBeLessThan(labPityTop());
    expect(welcomeCastTop()).toBeGreaterThan(labTitleTagsBottom());
  });

  it("은 바깥 둘이 앞(크게·낮게) 서서 가운데를 향하고, 안쪽 둘이 뒤에 선다", () => {
    const [a, b, c, d] = WELCOME_CAST.spots;
    expect(a.groundY).toBeGreaterThan(b.groundY);
    expect(d.groundY).toBeGreaterThan(c.groundY);
    expect(a.height).toBeGreaterThan(b.height);
    expect(a.flipX).not.toBe(d.flipX);
  });

  it("의 복제 그림자는 겹마다 더 멀고 옅다", () => {
    const [near, far] = WELCOME_CAST.echo;
    expect(Math.abs(far.dx)).toBeGreaterThan(Math.abs(near.dx));
    expect(far.alpha).toBeLessThan(near.alpha);
    expect(near.alpha).toBeLessThan(0.5);
  });
});

describe("첫 복원 연구 반짝임", () => {
  it("은 난수 없이 같은 번호가 늘 같은 자리·같은 박자다", () => {
    expect(welcomeSparkle(7)).toEqual(welcomeSparkle(7));
  });

  it("은 정해진 사각 안에 고르게 흩어진다", () => {
    const { area, count } = WELCOME_SPARKLE;
    const spots = Array.from({ length: count }, (_, index) => welcomeSparkle(index));
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(area.left);
      expect(spot.x).toBeLessThanOrEqual(area.right);
      expect(spot.y).toBeGreaterThanOrEqual(area.top);
      expect(spot.y).toBeLessThanOrEqual(area.bottom);
    }
    // 좌우 절반, 위아래 절반에 모두 떨어진다 — 한쪽에 몰리면 방이 풍성해 보이지 않는다.
    const midX = (area.left + area.right) / 2;
    const midY = (area.top + area.bottom) / 2;
    for (const [inside, label] of [
      [(s: { x: number }) => s.x < midX, "left"], [(s: { x: number }) => s.x >= midX, "right"],
    ] as const) expect(spots.filter(inside).length, label).toBeGreaterThan(count / 4);
    expect(spots.filter((s) => s.y < midY).length).toBeGreaterThan(count / 4);
    expect(spots.filter((s) => s.y >= midY).length).toBeGreaterThan(count / 4);
  });
});
