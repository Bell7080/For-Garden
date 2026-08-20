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
    expect(sorted.map((relic) => relic.specimenNumber)).toEqual(["001", "014", "044", "072", "093", "105"]);
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
