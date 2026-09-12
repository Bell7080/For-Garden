import { describe, expect, it } from "vitest";
import { pickParticle } from "../../src/core/koreanParticle";
import { t } from "../../src/i18n/catalog";

/**
 * 받침에 따라 갈리는 조사를 규칙으로 고정한다.
 *
 * 표에 `을` 한 글자를 적어 두면 이름이 바뀌는 순간 그 문장이 틀린다 — 「지각 붕괴」**을**이
 * 그랬다. 값의 마지막 소리를 보고 고르는 일은 이 규칙 하나가 맡는다.
 */
describe("한국어 조사", () => {
  it("받침 있는 이름과 없는 이름을 가른다", () => {
    expect(pickParticle("지각 붕괴", "을")).toBe("를");
    expect(pickParticle("온화한 방패", "이")).toBe("가");
    expect(pickParticle("각인", "을")).toBe("을");
    expect(pickParticle("파편", "이")).toBe("이");
  });

  it("따옴표는 소리로 세지 않는다", () => {
    // 이름을 묶는 괄호는 언어마다 다르고 읽히지도 않는다 — 그 앞의 글자가 받침을 정한다.
    expect(pickParticle("「지각 붕괴」", "을")).toBe("를");
    expect(pickParticle("「각인」", "을")).toBe("을");
  });

  it("ㄹ 받침은 `으로`가 아니라 `로`를 쓴다", () => {
    expect(pickParticle("서울", "으로")).toBe("로");
    expect(pickParticle("각인", "으로")).toBe("으로");
    expect(pickParticle("바다", "으로")).toBe("로");
  });

  it("문구 표의 `{name!조사}`는 조사만 남긴다", () => {
    // 값은 그 앞의 `{name}`이 이미 세운다 — 값에 괄호를 미리 붙여 넘기면 영어 문장 한가운데에
    // `「」`가 서므로, 묶는 일은 언어마다 제 표가 맡는다.
    expect(t("skill.breakthrough.effect.ultimate", { percent: "25", name: "지각 붕괴", seconds: "1.5", casts: "두" }))
      .toBe("피해량의 25%에 해당하는 「지각 붕괴」를 1.5초 간격으로 두 번 더 시전한다.");
    expect(t("skill.breakthrough.effect.passive", { name: "온화한 방패", percent: "25" }))
      .toBe("「온화한 방패」가 발동될 때 모든 아군에게 그 회복량의 25%를 나눈다.");
  });
});
