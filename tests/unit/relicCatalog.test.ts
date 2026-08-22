import { describe, expect, it } from "vitest";
import type { RelicDef } from "../../src/core/types";
import { getRelicCatalogDisclosure } from "../../src/core/relicCatalog";
import { PLAYABLE_RELICS, sortRelicsBySpecimenNumber, validateSpecimenNumbers } from "../../src/data/relics";

describe("relic catalog", () => {
  it("중복 개체번호를 콘텐츠 로드 검증에서 거부한다", () => {
    const duplicate = [{ ...PLAYABLE_RELICS[0], specimenNumber: "001" }, { ...PLAYABLE_RELICS[1], specimenNumber: "001" }];
    expect(() => validateSpecimenNumbers(duplicate)).toThrow("중복 개체번호: 001");
  });

  it("앞자리 0을 보존한 문자열 개체번호순으로 정렬한다", () => {
    const sorted = sortRelicsBySpecimenNumber(PLAYABLE_RELICS);
    // 루카를 포함해 배열 등록 순서와 무관하게 도감 번호가 정렬되는지 고정한다.
    expect(sorted.map((relic) => relic.specimenNumber)).toEqual(["001", "014", "038", "044", "072", "093", "105"]);
  });

  it("4번 Puppet 캐릭터 루카를 플레이 가능 렐릭으로 공개한다", () => {
    // 도감·가챠·정보창이 함께 읽는 단일 정적 정의에 전용 원화 키가 연결되어야 한다.
    expect(PLAYABLE_RELICS.find((relic) => relic.id === "luka")).toMatchObject({
      name: "루카",
      origin: "벨로키랍토르",
      portraitAssetId: "luka",
      role: "assassin",
    });
  });

  it("미보유 개체에는 번호와 실루엣 요약만 공개한다", () => {
    const relic: RelicDef = PLAYABLE_RELICS[0];
    const locked = getRelicCatalogDisclosure(relic, false);
    const owned = getRelicCatalogDisclosure(relic, true);

    expect(locked).toEqual({ access: "silhouette", specimenNumber: relic.specimenNumber, catalogSummary: relic.catalogSummary });
    expect(locked).not.toHaveProperty("record");
    expect(owned).toMatchObject({ access: "full", projectName: relic.projectName, record: relic.unlockRecord.status === "recorded" ? relic.unlockRecord.text : expect.any(String) });
  });
});
