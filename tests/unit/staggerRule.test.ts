import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import { EXPEDITION_TAG_AUGMENTS, EXPEDITION_TAG_PLANS } from "../../src/data/expeditionTagAugments";
import { RUNE_TRAIT_DEFS } from "../../src/data/runeTraits";
import { applyStagger, createSkirmish, STAGGER_SECONDS, type Arena } from "../../src/core/skirmish";

/*
 * **경직은 0.1초 기절을 뜻하는 고유 디버프다**(응태 결정, 2026-11-12). 0.1초를 넘는 경직은 존재할 수 없고,
 * 더 길게 막아야 하는 기술은 경직이 아니라 기절을 건다. 데이터 어디에도 0.1초를 넘는 경직을 적지 못하게
 * 막고, 상태 위력이 곱해져도 전투가 0.1초를 넘기지 않는지 함께 본다.
 */

/** 데이터를 훑어 경직 값이 적힌 자리를 모두 모은다 — `{ kind: "stagger", seconds }`와 `staggerSeconds` 필드. */
function staggerValues(value: unknown, path: string, into: { path: string; seconds: number }[], depth = 0): void {
  if (depth > 8 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => staggerValues(item, `${path}[${index}]`, into, depth + 1));
    return;
  }
  const record = value as Record<string, unknown>;
  if (record.kind === "stagger" && typeof record.seconds === "number") into.push({ path, seconds: record.seconds });
  for (const [key, child] of Object.entries(record)) {
    if (key === "staggerSeconds" && typeof child === "number") into.push({ path: `${path}.${key}`, seconds: child });
    staggerValues(child, `${path}.${key}`, into, depth + 1);
  }
}

describe("경직은 0.1초 기절이다", () => {
  it("경직의 길이는 0.1초다", () => {
    expect(STAGGER_SECONDS).toBe(0.1);
  });

  it("렐릭·적·한계 돌파·폭주·원정 증강·룬 특성 어디에도 0.1초를 넘는 경직이 없다", () => {
    const found: { path: string; seconds: number }[] = [];
    for (const def of RELICS) staggerValues(def, def.id, found);
    staggerValues(EXPEDITION_TAG_PLANS, "expeditionTagPlans", found);
    staggerValues(EXPEDITION_TAG_AUGMENTS.map((augment) => augment.effect), "expeditionTagAugments", found);
    staggerValues(RUNE_TRAIT_DEFS, "runeTraits", found);
    expect(found.length).toBeGreaterThan(0);
    const over = found.filter((entry) => entry.seconds > STAGGER_SECONDS + 1e-9);
    expect(over, `0.1초를 넘는 경직은 기절로 바꾼다: ${over.map((entry) => `${entry.path}=${entry.seconds}`).join(", ")}`).toEqual([]);
  });

  it("0.1초를 넘겨 걸어도 경직은 0.1초에서 멈춘다(상태 위력 포함)", () => {
    const arena: Arena = { left: 0, right: 1000, top: 0, bottom: 1600 };
    const torika = RELICS.find((def) => def.id === "torika")!;
    const state = createSkirmish([torika], [torika], arena);
    const target = state.fighters.find((fighter) => fighter.side === "enemy")!;
    target.tenacity = 0;
    applyStagger(target, 0.5, state);
    expect(target.staggeredFor).toBeLessThanOrEqual(STAGGER_SECONDS + 1e-9);
    expect(target.stunnedFor).toBe(0);
  });
});
