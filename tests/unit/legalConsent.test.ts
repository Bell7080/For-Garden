import { describe, expect, it } from "vitest";
import { LEGAL_VERSIONS, legalConsentCurrent, legalConsentKey } from "../../src/core/legalConsent";
import { LegalConsentApi } from "../../src/api/LegalConsentApi";
import { normalizeSettings } from "../../src/core/settings";
import { legalConsentRowY, LEGAL_CONSENT_POPUP as L } from "../../src/ui/legalConsentLayout";

describe("약관 동의", () => {
  it("동의 키는 두 문서의 판을 담고 현재 판만 통과한다", () => {
    expect(legalConsentKey()).toBe(`terms:${LEGAL_VERSIONS.terms}|privacy:${LEGAL_VERSIONS.privacy}`);
    expect(legalConsentCurrent(legalConsentKey())).toBe(true);
    expect(legalConsentCurrent("")).toBe(false);
    expect(legalConsentCurrent("terms:old|privacy:old")).toBe(false);
  });
  it("설정은 동의 키를 보존하고 모르는 모양은 동의하지 않은 것으로 읽는다", () => {
    expect(normalizeSettings(undefined).game.legalConsent).toBe("");
    const ok = normalizeSettings({ ...normalizeSettings(undefined), game: { ...normalizeSettings(undefined).game, legalConsent: legalConsentKey() } });
    expect(ok.game.legalConsent).toBe(legalConsentKey());
    const bad = normalizeSettings({ ...normalizeSettings(undefined), game: { ...normalizeSettings(undefined).game, legalConsent: "<script>" } as never });
    expect(bad.game.legalConsent).toBe("");
  });
  it("서버 기록은 문서 판과 만 14세 확인을 싣고, 연결이 없으면 unsupported다", async () => {
    const calls: unknown[] = [];
    const api = new LegalConsentApi({ callRpc: async (name, args) => { calls.push([name, args]); return { ok: true, value: { ok: true } }; } });
    expect(await api.record()).toEqual({ ok: true });
    expect(calls).toEqual([["record_legal_consent", { p_terms_version: LEGAL_VERSIONS.terms, p_privacy_version: LEGAL_VERSIONS.privacy, p_age_14: true }]]);
    expect(await new LegalConsentApi(null).record()).toEqual({ ok: false, error: "unsupported" });
  });
  it("체크 줄 셋과 동의 버튼이 판 안에 겹치지 않고 선다", () => {
    const half = L.height / 2;
    const last = legalConsentRowY(2) + L.row.height / 2;
    expect(last).toBeLessThan(L.underAgeY);
    expect(L.underAgeY).toBeLessThan(L.submitY - L.submit.height / 2);
    expect(L.submitY + L.submit.height / 2).toBeLessThan(half);
    expect(legalConsentRowY(0) - L.row.height / 2).toBeGreaterThan(L.noteY);
  });
});
