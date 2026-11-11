import { describe, expect, it } from "vitest";
import { canonicalJson, sameJsonShape } from "../../src/core/jsonShape";
import { isValidSituationalOfferState } from "../../src/core/situationalOffers";
import { isValidAttendanceState, normalizeAttendanceState } from "../../src/core/attendance";

/** Postgres `jsonb`가 돌려주는 순서 — 키 길이가 짧은 것부터, 같은 길이는 사전순. */
function jsonbOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbOrder);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, jsonbOrder(item)]));
}

describe("저장 모양 비교는 키 순서를 보지 않는다", () => {
  it("canonicalJson은 키 순서와 무관하고 undefined는 JSON.stringify처럼 빠진다", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: undefined }], c: 2 } })).toBe(canonicalJson({ a: { c: 2, d: [1, { y: 2 }] }, b: 1 }));
    expect(sameJsonShape([1, 2], [2, 1])).toBe(false);
  });

  it("jsonb가 키를 다시 늘어놓은 상황 특가도 올바른 저장이다(v0.424.0 corrupt_state 회귀)", () => {
    const stored = {
      active: [{ key: "level:30", trigger: "playerLevel", issuedAt: "2026-11-11T02:59:39.619Z", expiresAt: "2026-11-14T02:59:39.619Z", productId: "offer-level-30" }],
      issuedKeys: ["level:10", "level:20", "level:30"],
      lastIssuedAt: { playerLevel: "2026-11-11T02:59:39.619Z" },
    };
    expect(isValidSituationalOfferState(stored)).toBe(true);
    expect(isValidSituationalOfferState(jsonbOrder(stored))).toBe(true);
    expect(isValidSituationalOfferState({ ...stored, active: [{ ...stored.active[0], expiresAt: "어제" }] })).toBe(false);
  });

  it("출석도 jsonb 순서로 돌아와 통과한다", () => {
    const state = normalizeAttendanceState({});
    expect(isValidAttendanceState(jsonbOrder(state))).toBe(true);
  });
});
