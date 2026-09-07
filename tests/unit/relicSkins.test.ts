import { describe, expect, it } from "vitest";
import { RELIC_SKINS, getRelicSkin, skinsForRelic, validateRelicSkins } from "../../src/data/relicSkins";

describe("relic skins", () => {
  it("토리카 추가 외형은 anky에만 연결된다", () => {
    // 표시명이나 파일 번호가 아니라 저장 호환 렐릭 ID로 소유 대상을 고정한다.
    expect(skinsForRelic("anky").map(({ id }) => id)).toEqual(["torika-skin-001"]);
    expect(RELIC_SKINS.filter(({ id }) => id === "torika-skin-001").map(({ relicId }) => relicId)).toEqual(["anky"]);
    expect(skinsForRelic("rex")).toEqual([]);
  });

  it("모든 추가 외형은 전신과 SD 에셋을 한 벌로 가진다", () => {
    // 어느 한 화면만 기본 외형으로 폴백하지 않도록 공개 표 전체의 두 키를 검사한다.
    for (const skin of RELIC_SKINS) {
      expect(skin.portraitAssetId, `${skin.id} portrait`).not.toBe("");
      expect(skin.sdAssetId, `${skin.id} SD`).not.toBe("");
    }
    expect(() => validateRelicSkins(RELIC_SKINS)).not.toThrow();
  });

  it("알 수 없는 스킨 ID를 조용히 다른 외형으로 바꾸지 않는다", () => {
    // 손상되었거나 미래 버전인 저장값은 첫 스킨이나 기본 외형으로 암묵 변환하지 않는다.
    expect(getRelicSkin("unknown-skin-id")).toBeUndefined();
    expect(getRelicSkin("unknown-skin-id")).not.toBe(RELIC_SKINS[0]);
  });
});
