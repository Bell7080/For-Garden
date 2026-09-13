import { describe, expect, it } from "vitest";
import { fitFontSize, fitScaleX, fitSingleLineSize, fitsIn } from "../../src/core/textFit";

/**
 * 글자가 제 칸을 넘칠 때 무엇을 얼마나 줄일까.
 *
 * **낱말 길이는 언어가 정하고 칸 폭은 화면이 정한다** — 「일반 공격」 네 글자가 영어에서는
 * `Basic Attack` 열두 글자다. 실제로 그 라벨이 액자 밖으로 잘려 나가고 있었다.
 *
 * 재는 일은 화면이 하므로(Phaser Text) 여기서는 잰 값을 주입해 규칙만 돌린다.
 */
describe("칸에 맞추는 규칙", () => {
  describe("한 줄 이름표 가로 누르기", () => {
    it("은 드는 글자를 건드리지 않는다", () => {
      expect(fitScaleX(100, 200, 0.68)).toBe(1);
      expect(fitScaleX(200, 200, 0.68)).toBe(1);
    });

    it("은 넘치는 만큼만 누른다", () => {
      expect(fitScaleX(250, 200, 0.5)).toBe(0.8);
    });

    it("은 읽을 수 없어지기 전에 멈춘다", () => {
      // 하한을 넘겨야 들어가는 글은 거기서 넘치게 둔다 — 그때는 글자가 아니라 칸을 손봐야 한다.
      expect(fitScaleX(1000, 200, 0.68)).toBe(0.68);
    });

    it("은 폭을 모르는 자리에서 아무것도 하지 않는다", () => {
      // 아직 그리지 않은 글자는 폭이 0이다. 그 값으로 나누면 배율이 0이 되어 글자가 사라진다.
      expect(fitScaleX(0, 200, 0.68)).toBe(1);
      expect(fitScaleX(200, 0, 0.68)).toBe(1);
    });
  });

  describe("여러 줄 본문 크기 낮추기", () => {
    /** 크기에 비례해 한 줄이 길어지고, 폭에 맞춰 줄 수가 늘어나는 가짜 글자. */
    const measure = (chars: number) => (size: number) => {
      const perLine = Math.max(1, Math.floor(200 / (size * 0.5)));
      const lines = Math.ceil(chars / perLine);
      return { width: Math.min(200, chars * size * 0.5), height: lines * size * 1.4 };
    };

    it("은 이미 드는 글을 줄이지 않는다", () => {
      expect(fitFontSize({ width: 200, height: 400 }, measure(10), { size: 28, minSize: 18 })).toBe(28);
    });

    it("은 들 때까지만 낮춘다", () => {
      const chosen = fitFontSize({ width: 200, height: 120 }, measure(80), { size: 28, minSize: 12 });
      expect(chosen).toBeLessThan(28);
      expect(fitsIn(measure(80)(chosen), { width: 200, height: 120 })).toBe(true);
      // 한 칸 위 크기는 넘쳐야 한다 — 필요 이상으로 낮추면 같은 판의 다른 글과 위계가 뒤집힌다.
      expect(fitsIn(measure(80)(chosen + 1), { width: 200, height: 120 })).toBe(false);
    });

    it("은 하한까지 낮춰도 넘치면 하한에서 멈춘다", () => {
      // 넘치더라도 읽을 수 있는 글자로 남기는 편이 낫다.
      expect(fitFontSize({ width: 200, height: 10 }, measure(400), { size: 28, minSize: 18 })).toBe(18);
    });

    it("은 높이를 주지 않은 칸에서 폭만 본다", () => {
      // 한 줄 제목은 줄 수가 늘지 않으므로 높이를 보면 영원히 들지 않는다.
      expect(fitsIn({ width: 100, height: 9_999 }, { width: 200 })).toBe(true);
      expect(fitsIn({ width: 300, height: 1 }, { width: 200 })).toBe(false);
    });
  });

  describe("한 줄 제목 크기 낮추기", () => {
    it("은 줄바꿈 없이 폭만 맞춘다", () => {
      const width = (size: number) => size * 20;
      expect(fitSingleLineSize(width, 920, { size: 46, minSize: 28 })).toBe(46);
      expect(fitSingleLineSize(width, 700, { size: 46, minSize: 28 })).toBe(35);
      expect(fitSingleLineSize(width, 100, { size: 46, minSize: 28 })).toBe(28);
    });
  });
});
