import { describe, expect, it } from "vitest";
import { compositePortraitEffectAlpha } from "../../src/core/portraitAlpha";

/** Phaser/WebGL 없이 초상 오버레이의 세 알파가 각각 한 번만 적용되는지 고정한다. */
describe("compositePortraitEffectAlpha", () => {
  it("원본 픽셀, 효과, 카드 전체 알파를 순서와 무관한 한 번의 곱으로 합성한다", () => {
    // 반투명 머리 가장자리(0.5)에 효과(0.4)와 사망 카드 명도(0.45)를 각각 한 번 적용한다.
    expect(compositePortraitEffectAlpha({ sourcePixelAlpha: 0.5, effectAlpha: 0.4, cardAlpha: 0.45 })).toBeCloseTo(0.09);
  });

  it("원본이 투명하면 홈 도형이나 효과 알파와 관계없이 계속 투명하다", () => {
    // 머리 옆 빈 공간이 검은 사다리꼴로 나타나는 회귀를 막는 핵심 계약이다.
    expect(compositePortraitEffectAlpha({ sourcePixelAlpha: 0, effectAlpha: 1, cardAlpha: 1 })).toBe(0);
  });

  it("각 입력을 WebGL 알파 범위로 제한한다", () => {
    // 외부 트윈의 초과값도 두 번 감쇠하거나 불투명도를 1보다 키우지 않는다.
    expect(compositePortraitEffectAlpha({ sourcePixelAlpha: 2, effectAlpha: 0.5, cardAlpha: -1 })).toBe(0);
  });
});
