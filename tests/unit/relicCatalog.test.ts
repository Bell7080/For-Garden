import { describe, expect, it } from "vitest";
import type { RelicDef } from "../../src/core/types";
import { compareBookmarkedOwnedRelics, getRelicCatalogDisclosure } from "../../src/core/relicCatalog";
import { PLAYABLE_RELICS, sortRelicsBySpecimenNumber, validateSpecimenNumbers } from "../../src/data/relics";

describe("relic catalog", () => {
  it("렉시아 관찰 기록은 신장·체중과 성장 단계를 단일 측정값으로 공개한다", () => {
    const rex = PLAYABLE_RELICS.find((relic) => relic.id === "rex")!;
    // 도감 카드와 상세 관찰 기록이 서로 다른 신체 수치를 노출하지 않도록 정적 정의를 함께 고정한다.
    expect(rex.observationProfile).toMatchObject({ height: "1.63 m", weight: "54 kg", lifeStage: "성체 초기" });
    expect(rex.catalogSummary).toContain("체중 54kg");
    expect(rex.unlockRecord.status === "recorded" && rex.unlockRecord.text).toContain("체중 54kg");
  });
  it("스피나는 표시 정보와 관찰 신체 수치를 단일 값으로 공개한다", () => {
    const spina = PLAYABLE_RELICS.find((relic) => relic.id === "spino");
    // 저장 호환 ID로 찾은 하나의 정의가 도감의 이름·등급·속성·역할·관찰값을 모두 공급하도록 고정한다.
    expect(spina).toMatchObject({
      name: "스피나",
      rarity: "SSR",
      element: "water",
      role: "assassin",
      observationProfile: { height: "1.74 m", weight: "61 kg", lifeStage: "성체 초기" },
    });
  });

  it("스피나 관찰 기록은 별도 연구원 없이 주인공의 직접 관찰로 서술한다", () => {
    const spina = PLAYABLE_RELICS.find((relic) => relic.id === "spino")!;
    // 유일한 연구원인 주인공의 1인칭 관찰과 답례가 제3의 인물로 되돌아가지 않도록 핵심 문구를 고정한다.
    expect(spina.unlockRecord.status).toBe("recorded");
    if (spina.unlockRecord.status !== "recorded") return;
    expect(spina.unlockRecord.text).not.toContain("연구원 한 명");
    expect(spina.unlockRecord.text).toContain("나는 스피나가");
    expect(spina.unlockRecord.text).toContain("다음 날 내 책상에는 가장 반듯한 조개 하나가 놓여 있었다");
  });

  /** 실제 정의 전체를 복제하지 않고 순수 비교 함수에 필요한 식별자만 만든다. */
  const relics = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  /** 테스트마다 같은 선택 정렬을 쓰되 즐겨찾기 상태와 유대 기록만 바꿔 회귀 원인을 좁힌다. */
  const sortedWith = (bookmarked: readonly string[], bonds: Record<string, { bondLevel: number; bondXp: number }>) => {
    const base = new Map(["a", "b", "c", "d"].map((id, index) => [id, index]));
    return [...relics].sort((a, b) => compareBookmarkedOwnedRelics(a, b, {
      bookmarked: new Set(bookmarked),
      bondOf: (relic) => bonds[relic.id] ?? { bondLevel: 1, bondXp: 0 },
      fallback: (left, right) => base.get(left.id)! - base.get(right.id)!,
    })).map((relic) => relic.id);
  };

  it("즐겨찾기 렐릭을 일반 보유 렐릭보다 먼저 둔다", () => {
    expect(sortedWith(["c"], {})).toEqual(["c", "a", "b", "d"]);
  });

  it("여러 즐겨찾기를 유대 레벨과 유대 경험치 내림차순으로 둔다", () => {
    expect(sortedWith(["a", "b", "c"], { a: { bondLevel: 2, bondXp: 90 }, b: { bondLevel: 3, bondXp: 1 }, c: { bondLevel: 2, bondXp: 120 } })).toEqual(["b", "c", "a", "d"]);
  });

  it("즐겨찾기 유대가 동률이면 현재 선택 정렬 순서를 유지한다", () => {
    expect(sortedWith(["b", "c"], { b: { bondLevel: 4, bondXp: 20 }, c: { bondLevel: 4, bondXp: 20 } })).toEqual(["b", "c", "a", "d"]);
  });

  it("즐겨찾기를 해제하면 기존 선택 정렬 위치로 복귀한다", () => {
    expect(sortedWith([], {})).toEqual(["a", "b", "c", "d"]);
  });

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
