import { describe, expect, it } from "vitest";
import { SWEEP_POPUP, sweepCountControlX, sweepPopupHeight } from "../../src/ui/sweepPopupLayout";
import { SWEEP_SKIRMISH, sweepBandSlab, sweepLootArc, sweepLootPoint, sweepSkirmishBeats, sweepSkirmishDurationMs, sweepSkirmishTimeline } from "../../src/ui/sweepSkirmishLayout";

describe("소탕 창 배치표", () => {
  it("배율 줄의 조각은 겹치지 않고 판 안에 든다", () => {
    const { step, plate, max } = SWEEP_POPUP.count;
    const x = sweepCountControlX();
    const spans: [number, number][] = [
      [x.minus - step / 2, x.minus + step / 2], [x.plate - plate / 2, x.plate + plate / 2],
      [x.plus - step / 2, x.plus + step / 2], [x.max - max / 2, x.max + max / 2],
    ];
    for (let index = 1; index < spans.length; index += 1) expect(spans[index][0]).toBeGreaterThan(spans[index - 1][1]);
    expect(spans[0][0]).toBeGreaterThan(-SWEEP_POPUP.width / 2);
    expect(spans[spans.length - 1][1]).toBeLessThan(SWEEP_POPUP.width / 2);
  });

  it("위에서부터 배율 → 드는 것 → 안내 → 받을 것 → 버튼 순으로 겹치지 않고 쌓인다", () => {
    const L = SWEEP_POPUP;
    expect(L.count.y + L.count.height / 2).toBeLessThan(L.cost.top);
    expect(L.cost.top + L.cost.height).toBeLessThan(L.notice.y - L.notice.size);
    expect(L.notice.y + L.notice.size).toBeLessThan(L.reward.titleY - 12);
    expect(L.reward.y + L.reward.frame / 2).toBeLessThan(L.buttons.y - L.buttons.height / 2);
    expect(sweepPopupHeight()).toBe(L.buttons.y + L.buttons.height / 2 + L.bottomPad);
    // 두 버튼은 판 폭 안에 든다.
    expect(L.buttons.width * 2 + L.buttons.gap).toBeLessThan(L.width - 80);
  });
});

describe("소탕 연출", () => {
  it("애착 렐릭이 먼저 치고 마지막 한 방으로 끝나며, 박자는 앞으로만 흐른다", () => {
    const beats = sweepSkirmishBeats();
    expect(beats[0].attacker).toBe("hero");
    expect(beats.filter((beat) => beat.finisher)).toHaveLength(1);
    expect(beats[beats.length - 1]).toMatchObject({ attacker: "hero", finisher: true });
    for (let index = 1; index < beats.length; index += 1) expect(beats[index].atMs).toBeGreaterThan(beats[index - 1].atMs);
    // 적도 한 번은 받아친다 — 한쪽만 때리면 주고받는 것이 아니다.
    expect(beats.some((beat) => beat.attacker === "enemy")).toBe(true);
  });

  it("한 판을 짧은 만화로 대신한다 — 볼거리는 늘었지만 영수증까지 7초를 넘지 않는다", () => {
    expect(sweepSkirmishDurationMs()).toBeGreaterThan(4000);
    expect(sweepSkirmishDurationMs()).toBeLessThan(7000);
  });

  it("주고받기 → 먼지구름 → 몰아치기 → 날려 보내기 → 뿅뿅 → 정산 순으로 겹치지 않고 흐른다", () => {
    const line = sweepSkirmishTimeline();
    const before = line.beats.filter((beat) => beat.atMs < line.scuffle.startMs);
    const after = line.beats.filter((beat) => beat.atMs > line.scuffle.endMs);
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    expect(before.length + after.length).toBe(line.beats.length);
    // 구름 속 불꽃은 구름이 떠 있는 동안에만 튄다.
    expect(line.scuffle.pops.length).toBeGreaterThan(3);
    for (const pop of line.scuffle.pops) expect(pop).toBeGreaterThan(line.scuffle.startMs), expect(pop).toBeLessThan(line.scuffle.endMs);
    // 몰아치는 박자는 주고받는 박자보다 짧다 — 「투다다닥」.
    expect(after[1].atMs - after[0].atMs).toBeLessThan(before[1].atMs - before[0].atMs);
    const finisher = line.beats[line.beats.length - 1];
    expect(line.blastOff.startMs).toBeGreaterThan(finisher.atMs);
    expect(line.blastOff.twinkleAtMs).toBeGreaterThan(line.blastOff.startMs);
    expect(line.victory.startMs).toBeGreaterThanOrEqual(line.blastOff.twinkleAtMs);
    expect(line.settle.startMs).toBeGreaterThanOrEqual(line.victory.endMs);
    expect(line.endMs).toBe(line.settle.endMs);
  });

  it("전리품은 난수 없이 늘 같은 궤적으로 튀고, 띠 밖이 아니라 발밑 언저리에 떨어진다", () => {
    const L = SWEEP_SKIRMISH;
    const half = L.band.width / 2 - L.band.bevel;
    for (let index = 0; index < L.loot.maxPieces; index += 1) {
      const arc = sweepLootArc(index, L.enemy.x);
      expect(arc).toEqual(sweepLootArc(index, L.enemy.x));
      expect(Math.abs(arc.landX)).toBeLessThanOrEqual(half);
      expect(arc.landY).toBeGreaterThanOrEqual(L.groundY);
      expect(arc.landY).toBeLessThan(L.band.height / 2);
      // 곡사 — 가운데에서 출발점과 떨어지는 자리보다 높이 솟는다.
      const from = { x: L.enemy.x, y: L.groundY - L.sdHeight * 0.45 };
      const middle = sweepLootPoint(from.x, from.y, arc, 0.5);
      expect(middle.y).toBeLessThan(Math.min(from.y, arc.landY));
      expect(sweepLootPoint(from.x, from.y, arc, 1)).toEqual({ x: arc.landX, y: arc.landY });
    }
    // 크고 작은 조각이 섞이고, 대부분은 이긴 쪽(왼쪽)으로 떨어진다.
    const arcs = Array.from({ length: 12 }, (_, index) => sweepLootArc(index, L.enemy.x));
    expect(arcs.some((arc) => arc.big)).toBe(true);
    expect(arcs.some((arc) => !arc.big)).toBe(true);
    expect(arcs.filter((arc) => arc.landX < L.enemy.x).length).toBeGreaterThan(arcs.length / 2);
  });

  it("지층은 띠를 빈틈없이 채우고 층의 도형은 깎인 모서리 밖으로 나가지 않는다", () => {
    const { width, height, bevel } = SWEEP_SKIRMISH.band;
    expect(SWEEP_SKIRMISH.strata.reduce((sum, layer) => sum + layer.ratio, 0)).toBeCloseTo(1, 6);
    let top = -height / 2;
    for (const layer of SWEEP_SKIRMISH.strata) {
      const bottom = top + height * layer.ratio;
      const flat = sweepBandSlab(top, bottom);
      for (let index = 0; index < flat.length; index += 2) {
        const [x, y] = [flat[index], flat[index + 1]];
        expect(Math.abs(x)).toBeLessThanOrEqual(width / 2 + 1e-6);
        // 왼쪽 위 빗변 안쪽.
        if (y < -height / 2 + bevel) expect(x).toBeGreaterThanOrEqual(-width / 2 + (-height / 2 + bevel - y) - 1e-6);
        // 오른쪽 아래 빗변 안쪽.
        if (y > height / 2 - bevel) expect(x).toBeLessThanOrEqual(width / 2 - (y - (height / 2 - bevel)) + 1e-6);
      }
      top = bottom;
    }
    // 발이 서는 선은 첫 지층의 밑변이다.
    expect(SWEEP_SKIRMISH.groundY).toBeCloseTo(-height / 2 + height * SWEEP_SKIRMISH.strata[0].ratio, 6);
  });
});
