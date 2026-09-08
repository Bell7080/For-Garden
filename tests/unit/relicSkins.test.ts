import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultUnlockedRelicSkinIds, RELIC_SKINS, getRelicSkin, skinsForRelic, validateRelicSkins } from "../../src/data/relicSkins";

describe("relic skins", () => {
  it("토리카 외형은 정적 정책에서 기본 해금된다", () => {
    // 상태 코드가 특정 ID를 복제하지 않도록 공개 헬퍼의 계산 결과를 계약으로 고정한다.
    expect(defaultUnlockedRelicSkinIds()).toEqual(["torika-skin-001"]);
  });
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

  it("정적 정의의 전신·SD ZIP이 배포 디렉터리에 실제 파일로 존재한다", () => {
    // 논리 키만 등록되고 파일이 빠지는 배포 회귀를 막으며, 빈 자리표시자도 ZIP으로 인정하지 않는다.
    const filesByAssetId: Readonly<Record<string, string>> = {
      "torika-skin-001-portrait": "char_001_skin001.zip",
      "torika-skin-001-sd": "charSD_001_skin001.zip",
    };
    for (const skin of RELIC_SKINS) {
      for (const assetId of [skin.portraitAssetId, skin.sdAssetId]) {
        const file = filesByAssetId[assetId];
        expect(file, `${assetId} 배포 파일 매핑`).toBeDefined();
        const path = resolve(process.cwd(), "public", "puppets", file);
        expect(existsSync(path), path).toBe(true);
        expect(readFileSync(path).subarray(0, 4).toString("hex"), `${path} ZIP header`).toBe("504b0304");
      }
    }
  });

  it("알 수 없는 스킨 ID를 조용히 다른 외형으로 바꾸지 않는다", () => {
    // 손상되었거나 미래 버전인 저장값은 첫 스킨이나 기본 외형으로 암묵 변환하지 않는다.
    expect(getRelicSkin("unknown-skin-id")).toBeUndefined();
    expect(getRelicSkin("unknown-skin-id")).not.toBe(RELIC_SKINS[0]);
  });
});
