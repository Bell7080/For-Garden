import { describe, expect, it } from "vitest";
import { runePartOfTexture } from "../../src/ui/runePieceContent";

describe("runePartOfTexture", () => {
  it("룬 조각 그림 키에서만 자리를 되짚는다", () => {
    expect(runePartOfTexture("rune-legendary-2")).toBe(2);
    expect(runePartOfTexture("rune-uncommon-0")).toBe(0);
    expect(runePartOfTexture("rune-empty-1")).toBe(1);
    expect(runePartOfTexture("currency-gold")).toBeUndefined();
    expect(runePartOfTexture("rune-rare-3")).toBeUndefined();
  });
});
