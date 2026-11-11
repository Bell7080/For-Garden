import { describe, expect, it } from "vitest";
import {
  RELIC_SELECT, relicSelectCardX, relicSelectMinOffset, relicSelectOffsetFor, relicSelectStageRect,
  relicSelectStep, relicSelectStripViewport, relicSelectSwipeDelta, relicSelectFrames, relicSelectArrowX,
} from "../../src/ui/relicSelectLayout";

describe("렐릭 선택권 고르기 창 배치", () => {
  it("무대·이름·띠·버튼이 위에서부터 겹치지 않고 몸판 안에 선다", () => {
    const stage = relicSelectStageRect();
    const strip = relicSelectStripViewport();
    const half = RELIC_SELECT.height / 2;
    expect(stage.top).toBeGreaterThan(RELIC_SELECT.hint.y);
    expect(RELIC_SELECT.name.y - RELIC_SELECT.name.size / 2).toBeGreaterThan(stage.bottom);
    expect(strip.top).toBeGreaterThan(RELIC_SELECT.state.y + RELIC_SELECT.state.size / 2);
    expect(RELIC_SELECT.holdHint.y).toBeGreaterThan(strip.bottom);
    expect(RELIC_SELECT.action.y - RELIC_SELECT.action.height / 2).toBeGreaterThan(RELIC_SELECT.holdHint.y + RELIC_SELECT.holdHint.size / 2);
    expect(RELIC_SELECT.action.y + RELIC_SELECT.action.height / 2).toBeLessThan(half);
    expect(-half).toBeLessThan(RELIC_SELECT.hint.y - RELIC_SELECT.hint.size);
  });

  it("무대는 외형처럼 세 칸으로 갈리고, 띠 꺾쇠는 창 밖·몸판 안에 선다", () => {
    const { hero, face, sd } = relicSelectFrames();
    const stage = relicSelectStageRect();
    expect(hero.right).toBeLessThan(face.left);
    expect(face.bottom).toBeLessThan(sd.top);
    expect(hero.right - hero.left).toBeGreaterThan(face.right - face.left);
    expect(face.bottom - face.top).toBeGreaterThan(sd.bottom - sd.top);
    expect(sd.bottom).toBe(stage.bottom);
    const view = relicSelectStripViewport();
    const { arrow, width } = RELIC_SELECT;
    expect(relicSelectArrowX(1) - arrow.width / 2).toBeGreaterThan(view.right);
    expect(relicSelectArrowX(-1) + arrow.width / 2).toBeLessThan(view.left);
    expect(relicSelectArrowX(1) + arrow.width / 2).toBeLessThan(width / 2);
  });

  it("칸이 창을 못 채우면 가운데로 모이고, 넘치면 고른 칸이 창 안으로 들어온다", () => {
    expect(relicSelectCardX(0, 1)).toBeCloseTo(0);
    expect(relicSelectMinOffset(3)).toBe(0);
    const count = 10;
    const view = relicSelectStripViewport();
    const offset = relicSelectOffsetFor(count - 1, count, 0);
    expect(offset).toBe(relicSelectMinOffset(count));
    expect(relicSelectCardX(count - 1, count) + RELIC_SELECT.strip.card / 2 + offset).toBeLessThanOrEqual(view.right + 0.01);
    expect(relicSelectOffsetFor(0, count, offset)).toBe(0);
  });

  it("넘김은 양 끝에서 돌고, 짧은 밀기는 넘기지 않는다", () => {
    expect(relicSelectStep(0, -1, 5)).toBe(4);
    expect(relicSelectStep(4, 1, 5)).toBe(0);
    expect(relicSelectSwipeDelta(-20)).toBe(0);
    expect(relicSelectSwipeDelta(-120)).toBe(1);
    expect(relicSelectSwipeDelta(120)).toBe(-1);
  });
});
