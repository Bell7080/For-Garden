import { describe, expect, it } from "vitest";
import { LAB_AURORA, LAB_AURORA_PALETTE, labAuroraDue, labAuroraPlan } from "../../src/core/labAurora";

describe("연구소 오로라 작업량", () => {
  it("낮음 품질은 세우지 않는다", () => {
    expect(labAuroraPlan({ quality: "low", powerSaving: false, reduceMotion: false }).enabled).toBe(false);
  });

  it("움직임 줄이기는 멈춘 한 장만 둔다", () => {
    expect(labAuroraPlan({ quality: "high", powerSaving: false, reduceMotion: true })).toEqual({ enabled: true, animate: false, hz: 0 });
  });

  it("절전은 다시 그리는 박자를 절반으로 줄인다", () => {
    const normal = labAuroraPlan({ quality: "high", powerSaving: false, reduceMotion: false });
    const saving = labAuroraPlan({ quality: "high", powerSaving: true, reduceMotion: false });
    expect(normal.hz).toBe(30);
    expect(saving.hz).toBe(15);
  });

  it("박자가 되었을 때만 다시 그리고, 0이면 그리지 않는다", () => {
    expect(labAuroraDue(10, 30)).toBe(false);
    expect(labAuroraDue(33, 30)).toBe(true);
    expect(labAuroraDue(10_000, 0)).toBe(false);
  });

  it("버퍼는 화면 띠보다 훨씬 작다", () => {
    const { buffer, band } = LAB_AURORA;
    expect(buffer.width * buffer.height * 30).toBeLessThan(band.width * band.height);
  });

  it("상시는 반짝이지 않고 한정이 더 세다", () => {
    expect(LAB_AURORA_PALETTE.standard.sparkle).toBe(0);
    for (const tone of ["limited", "moonlit"] as const) {
      expect(LAB_AURORA_PALETTE[tone].intensity).toBeGreaterThan(LAB_AURORA_PALETTE.standard.intensity);
      expect(LAB_AURORA_PALETTE[tone].sparkle).toBeGreaterThan(0);
    }
    for (const palette of Object.values(LAB_AURORA_PALETTE)) {
      expect(palette.intensity).toBeLessThanOrEqual(0.8);
      for (const c of palette.colors) for (const v of c) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
    }
  });
});
