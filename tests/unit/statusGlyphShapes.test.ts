import { describe, expect, it } from "vitest";
import { BUFF_GLYPHS, STATUS_GLYPHS } from "../../src/ui/statusGlyphShapes";
import { battleBuffVisual, type BattleBuffGlyphId } from "../../src/core/battleBuffPresentation";
import { UNIT_STATUS_COLOR } from "../../src/ui/unitStatusModel";

/**
 * 머리 위 상태 칩의 그림. 색만 다르던 마름모로 되돌아가지 않도록, 모든 상태가 제 그림을 갖고
 * 칩 밖으로 나가지 않으며 두 상태가 같은 그림을 쓰지 않는지 고정한다.
 */
describe("상태 칩 그림", () => {
  const ids = Object.keys(UNIT_STATUS_COLOR) as (keyof typeof UNIT_STATUS_COLOR)[];

  it("은 모든 상태가 하나 이상의 조각을 갖는다", () => {
    for (const id of ids) expect(STATUS_GLYPHS[id].length, id).toBeGreaterThan(0);
  });

  it("은 단위 좌표(−1~1) 안에 든다", () => {
    for (const id of ids) {
      for (const part of STATUS_GLYPHS[id]) {
        expect(part.points.length, id).toBeGreaterThanOrEqual(part.kind === "fill" ? 3 : 2);
        for (const [x, y] of part.points) {
          expect(Math.abs(x), id).toBeLessThanOrEqual(1);
          expect(Math.abs(y), id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("은 두 상태가 같은 그림을 쓰지 않는다", () => {
    // 늑대 둘은 같은 머리에 색과 주둥이 표식만 다르다 — 그래도 그림 자체가 갈린다.
    const seen = new Map<string, string>();
    for (const id of ids) {
      const key = JSON.stringify(STATUS_GLYPHS[id]);
      expect(seen.get(key), `${id}와 ${seen.get(key)}가 같은 그림`).toBeUndefined();
      seen.set(key, id);
    }
  });
});

/**
 * 프로필 버프 칩의 공용 문양. 예전에는 증강 버프가 모두 렐릭의 폭주 그림 한 장을 함께 써서 가속·지속
 * 회복·연타 강화가 같은 그림이었다 — 문양끼리 겹치지 않고, 코어가 고르는 모든 문양이 표에 있는지 고정한다.
 */
describe("버프 칩 문양", () => {
  const ids = Object.keys(BUFF_GLYPHS) as BattleBuffGlyphId[];

  it("은 단위 좌표(−1~1) 안에 든다", () => {
    for (const id of ids) {
      expect(BUFF_GLYPHS[id].length, id).toBeGreaterThan(0);
      for (const part of BUFF_GLYPHS[id]) for (const [x, y] of part.points) {
        expect(Math.abs(x), id).toBeLessThanOrEqual(1);
        expect(Math.abs(y), id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("은 두 문양이 같은 그림을 쓰지 않는다", () => {
    const seen = new Map<string, string>();
    for (const id of ids) {
      const key = JSON.stringify(BUFF_GLYPHS[id]);
      expect(seen.get(key), `${id}와 ${seen.get(key)}가 같은 그림`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("은 코어가 고르는 문양을 모두 갖는다", () => {
    for (const head of ["trait-haste", "kill-haste", "trait-regen", "augment-guard", "augment-low-hp-attack", "augment-streak", "augment-warm-up",
      "augment-opening-crit", "augment-nth-basic", "augment-current-hp-strike", "augment-bleed-on-attack", "augment-curse-on-attack", "focus", "hit-count", "unknown"]) {
      const visual = battleBuffVisual({ id: `${head}:player-0` });
      const glyph = visual.glyph === "skill" ? visual.fallback : visual.glyph;
      expect(BUFF_GLYPHS[glyph], head).toBeDefined();
    }
  });
});
