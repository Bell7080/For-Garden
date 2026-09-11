import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  BREAK_CONFIRM,
  BREAK_STEPS,
  breakthroughStepsLayout,
  stepsFirstRowClearsBevel,
} from "../../src/ui/breakthroughLayout";
import { BACK_BUTTON_SIZE, BACK_SLOT, POPUP_TITLE_SIZE, popupTitleBand } from "../../src/ui/popupGeometry";
import { BREAKTHROUGH_STEPS } from "../../src/core/relicProgression";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";
import { getRelic } from "../../src/data/relics";

/** `info.ts`는 Phaser를 들여오므로 node 환경에서는 소스 문자열로만 읽는다. */
const INFO_SOURCE = Object.values(import.meta.glob("../../src/ui/info.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>)[0];

const LAYOUT = breakthroughStepsLayout(BREAKTHROUGH_STEPS.length);

describe("한계 돌파 표", () => {
  it("은 네 단계가 모두 제 줄을 갖는다", () => {
    expect(LAYOUT.rows).toHaveLength(BREAKTHROUGH_STEPS.length);
  });

  it("은 줄끼리 겹치지 않는다", () => {
    for (let index = 1; index < LAYOUT.rows.length; index += 1) {
      const gap = LAYOUT.rows[index] - LAYOUT.rows[index - 1];
      expect(gap).toBeGreaterThan(BREAK_STEPS.row.height);
    }
  });

  it("은 화면 가운데에 서고 판이 화면 안에 든다", () => {
    // 돋보기 자리에 붙이지 않는다 — 네 줄이 설명을 이고 있어 판이 한쪽으로 쏠리면 잘린다.
    expect(BREAK_STEPS.centerY).toBe(BASE_HEIGHT / 2);
    expect(BREAK_STEPS.centerY - LAYOUT.height / 2).toBeGreaterThanOrEqual(24);
    expect(BREAK_STEPS.centerY + LAYOUT.height / 2).toBeLessThanOrEqual(BASE_HEIGHT - 24);
    expect(BREAK_STEPS.width).toBeLessThanOrEqual(BASE_WIDTH - 80);
  });

  it("은 예전 판보다 크다", () => {
    // 설명이 잘 보이게 넓히고 길게 가져가는 것이 이번 변경의 요점이다(예전 900 × 700).
    expect(BREAK_STEPS.width).toBeGreaterThan(900);
    expect(LAYOUT.height).toBeGreaterThan(700);
  });

  it("은 첫 줄이 제목표 띠와 깎인 모서리를 함께 피한다", () => {
    const rowTop = LAYOUT.rows[0] - BREAK_STEPS.row.height / 2;
    expect(rowTop).toBeGreaterThan(popupTitleBand(POPUP_TITLE_SIZE.workboard));
    expect(stepsFirstRowClearsBevel(LAYOUT)).toBe(true);
  });

  it("은 별 표식·액자·설명이 줄 안에서 차례로 서고 겹치지 않는다", () => {
    const half = LAYOUT.rowWidth / 2;
    const starLeft = BREAK_STEPS.star.x - BREAK_STEPS.star.size;
    const starRight = BREAK_STEPS.star.x + BREAK_STEPS.star.size;
    const iconLeft = BREAK_STEPS.icon.x - BREAK_STEPS.icon.size / 2;
    const iconRight = BREAK_STEPS.icon.x + BREAK_STEPS.icon.size / 2;
    expect(starLeft).toBeGreaterThan(-half);
    expect(iconLeft).toBeGreaterThan(starRight);
    expect(BREAK_STEPS.textX).toBeGreaterThan(iconRight);
    // 설명이 줄 오른쪽 변을 넘지 않는다.
    expect(BREAK_STEPS.textX + LAYOUT.textWrap).toBeLessThanOrEqual(half);
  });

  it("은 액자가 줄 안에 온전히 든다", () => {
    expect(BREAK_STEPS.icon.size).toBeLessThan(BREAK_STEPS.row.height);
  });

  it("은 설명이 줄 높이에 담기는 줄 수로 끊긴다", () => {
    // 한 줄에 들어갈 수 있는 글 줄 수. 넘치면 설명이 줄 판 밖으로 흘러 아래 줄과 겹친다.
    const lineHeight = BREAK_STEPS.textSize + 8;
    const maxLines = Math.floor((BREAK_STEPS.row.height - 16) / lineHeight);
    expect(maxLines).toBeGreaterThanOrEqual(3);
    // 실제 문구가 그 안에 드는지 글자 수로 가늠한다 — 한 줄에 대략 `wrap / 글자폭`자가 들어간다.
    const perLine = Math.floor(LAYOUT.textWrap / (BREAK_STEPS.textSize * 0.92));
    for (const step of BREAKTHROUGH_STEPS) {
      const text = breakthroughEffectText(getRelic("anky"), step.slot);
      expect(text).toBeDefined();
      expect(Math.ceil(text!.length / perLine), `${step.slot}: ${text}`).toBeLessThanOrEqual(maxLines);
    }
  });

  it("은 판이 화면 공용 뒤로가기 자리를 덮지 않는다", () => {
    expect(BREAK_STEPS.centerY + LAYOUT.height / 2).toBeLessThan(BACK_SLOT.y - BACK_BUTTON_SIZE / 2);
  });
});

describe("한계 돌파 확정 창", () => {
  it("은 「돌파하기」가 액자 밑 두 줄과 겹치지 않는다", () => {
    // 액자 아래에는 이름 줄(+26)과 `필요 N` 줄(+58)이 선다. 버튼 윗변이 그보다 아래여야 한다.
    const needRowBottom = BREAK_CONFIRM.costY + BREAK_CONFIRM.costFrame / 2 + 58 + BREAK_CONFIRM.action.height / 4;
    expect(BREAK_CONFIRM.actionY - BREAK_CONFIRM.action.height / 2).toBeGreaterThan(needRowBottom);
  });

  it("은 액자 셋이 판 안에 나란히 든다", () => {
    const span = BREAK_CONFIRM.costStep * 2 + BREAK_CONFIRM.costFrame;
    expect(span).toBeLessThan(BREAK_CONFIRM.width);
  });

  it("은 효과 줄이 있을 때만 판이 길어지고 그 줄이 판 안에 든다", () => {
    const tall = BREAK_CONFIRM.height + BREAK_CONFIRM.effectExtra;
    expect(BREAK_CONFIRM.effectY).toBeGreaterThan(BREAK_CONFIRM.actionY + BREAK_CONFIRM.action.height / 2);
    expect(BREAK_CONFIRM.effectY).toBeLessThan(tall);
  });

  it("은 두 창이 같은 별 수를 말한다", () => {
    // 표의 줄 수와 확정 창이 뚫는 단계 수가 갈리면 한 창에만 있는 별이 생긴다.
    expect(LAYOUT.rows).toHaveLength(BREAKTHROUGH_STEPS.length);
  });
});

describe("한계 돌파 표의 열림 표시", () => {
  const { reached, locked } = BREAK_STEPS.tone;

  /** 24비트 색의 대략적인 밝기. 두 결의 면을 견줄 때만 쓴다. */
  function luminance(color: number): number {
    return 0.2126 * ((color >> 16) & 0xff) + 0.7152 * ((color >> 8) & 0xff) + 0.0722 * (color & 0xff);
  }

  it("은 아직 안 열린 줄도 또렷하게 읽힌다", () => {
    // 별 하나로 시작하는 개체는 **네 줄이 모두** 안 열린 줄이다. 어둡게 누르면 이 창을 처음
    // 여는 사람이 캄캄한 판 넷을 본다 — 예전에는 면이 0.7, 윗선이 0.2, 액자가 0.42였다.
    expect(locked.alpha).toBeGreaterThanOrEqual(0.9);
    expect(locked.edgeAlpha).toBeGreaterThanOrEqual(0.4);
    expect(BREAK_STEPS.lockedIconAlpha).toBeGreaterThanOrEqual(0.8);
  });

  it("은 두 줄의 면 진하기가 거의 같다", () => {
    // 가르는 것은 밝기가 아니라 결이다. 면 진하기까지 벌리면 안 열린 줄이 다시 가라앉는다.
    expect(Math.abs(reached.alpha - locked.alpha)).toBeLessThanOrEqual(0.05);
  });

  it("은 열린 줄이 따뜻하고 안 열린 줄이 차갑다", () => {
    const warm = (color: number): number => ((color >> 16) & 0xff) - (color & 0xff);
    // 열린 줄은 붉은빛이 파란빛보다 세고(호박), 안 열린 줄은 그 반대(남색)다.
    expect(warm(reached.fill)).toBeGreaterThan(0);
    expect(warm(locked.fill)).toBeLessThan(0);
  });

  it("은 안 열린 줄의 면이 캄캄하지 않다", () => {
    // 예전 면(0x121820)보다 밝아야 그 위의 흰 글자가 판에서 떠오른다.
    expect(luminance(locked.fill)).toBeGreaterThan(luminance(0x121820));
  });

  it("은 어디까지 왔는지를 별 표식이 말한다", () => {
    // 글과 그림을 누르지 않는 대신 이 표식만 흐려진다.
    expect(locked.star).toBeLessThan(reached.star);
    expect(reached.star).toBe(1);
  });

  it("은 설명을 두 줄 다 같은 잉크로 적는다", () => {
    // 어느 쪽이든 읽으러 온 내용이라 안 열린 줄의 설명도 흐리게 적지 않는다.
    expect(INFO_SOURCE).toContain("color: COLOR.ink, wrap: layout.textWrap");
    expect(INFO_SOURCE).not.toContain("reached ? COLOR.ink : COLOR.inkDim");
  });
});
