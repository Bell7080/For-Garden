import { describe, expect, it } from "vitest";
import type { RelicDef } from "../../src/core/types";
import { compareBookmarkedOwnedRelics, getRelicCatalogDisclosure } from "../../src/core/relicCatalog";
import { PLAYABLE_RELICS, RELICS, sortRelicsBySpecimenNumber, validateSpecimenNumbers } from "../../src/data/relics";

/** 현재 시점의 다른 인간 연구원을 암시하는 표현만 탐지해, 일반적인 '연구원' 용례는 과도하게 막지 않는다. */
const FORBIDDEN_PRESENT_RESEARCHER_PHRASES = ["연구원 한 명", "다른 연구원", "연구원들"] as const;

/**
 * 과거 복제 연구원처럼 설정상 필요한 문구가 생길 때, 렐릭 ID와 개별 표현 및 사유만 좁게 허용한다.
 * 문자열 전체를 면제하지 않으므로 같은 기록에 새로 유입된 금지 표현은 계속 검출된다.
 */
const ALLOWED_RESEARCHER_REFERENCES: Readonly<Record<string, Readonly<{
  phrase: (typeof FORBIDDEN_PRESENT_RESEARCHER_PHRASES)[number];
  reason: string;
}[]>>> = {};

describe("relic catalog", () => {
  it("모든 렐릭의 발굴 기록과 확정된 관찰 기록은 비어 있지 않다", () => {
    // 적 개체를 포함한 정적 정의 전체가 짧은 발굴 이력을 갖고, recorded 판별 뒤에는 실제 관찰 본문을 제공해야 한다.
    for (const relic of RELICS) {
      expect(relic.fossilRecord.trim(), `${relic.id} fossilRecord`).not.toBe("");
      if (relic.unlockRecord.status === "recorded") {
        expect(relic.unlockRecord.text.trim(), `${relic.id} unlockRecord.text`).not.toBe("");
      }
    }
  });

  it("복원 이후 관찰 기록에 신장·체중이나 화석 상태가 다시 섞이지 않는다", () => {
    // 숫자 단위뿐 아니라 수치 없이 쓰인 한국어 신체 측정 명칭도 막아 프로필과 본문의 역할 분리를 고정한다.
    const forbiddenMeasurement = /(?:키(?:가|는|를|와|\s)|신장|몸무게|체중)|\d+(?:\.\d+)?\s*(?:m|cm|kg)\b/i;
    // 발굴 전용 어휘가 생활 관찰로 되돌아오는 대표 회귀도 함께 차단한다.
    const forbiddenFossilState = /(?:화석|난각|골격|골편|두개골|발굴|수습|보존(?:된|되었|됐다|상태)?)/;

    for (const relic of RELICS) {
      if (relic.unlockRecord.status !== "recorded") continue;
      expect(relic.unlockRecord.text, `${relic.id} 신체 측정 표현`).not.toMatch(forbiddenMeasurement);
      expect(relic.unlockRecord.text, `${relic.id} 화석·발굴 표현`).not.toMatch(forbiddenFossilState);
    }
  });

  it("관찰 프로필의 인간형 신체 E.C. 나잇대는 1년 이상 20년 미만이다", () => {
    // 원종 화석의 생물학적 단계(lifeStage)와 독립된 E.C. 신체 나잇대를 도감 원본 전체에서 검사한다.
    const profiles = PLAYABLE_RELICS.flatMap((relic) => relic.observationProfile ? [{ relicId: relic.id, profile: relic.observationProfile }] : []);

    expect(profiles.length).toBeGreaterThan(0);
    for (const { relicId, profile } of profiles) {
      const match = /^E\.C\. (\d+)년$/.exec(profile.restorationYear);
      expect(match, `${relicId} restorationYear 형식`).not.toBeNull();
      expect(Number(match?.[1]), `${relicId} restorationYear 범위`).toBeGreaterThanOrEqual(1);
      expect(Number(match?.[1]), `${relicId} restorationYear 범위`).toBeLessThan(20);
      expect(profile, `${relicId} 중복 복원 연차`).not.toHaveProperty("restorationAge");
    }
  });

  it("모든 해금 기록은 주인공 외의 현재 인간 연구원을 암시하지 않는다", () => {
    // docs/lore.md의 주인공이 “진짜 인간이자 유일한 연구원”이라는 설정을 모든 unlockRecord.text에서 보호한다.
    const violations = PLAYABLE_RELICS.flatMap((relic) => {
      if (relic.unlockRecord.status !== "recorded") return [];
      // 판별된 기록 원문을 지역 상수로 고정해 후속 콜백에서도 recorded 타입을 유지한다.
      const recordText = relic.unlockRecord.text;
      const allowed = ALLOWED_RESEARCHER_REFERENCES[relic.id] ?? [];
      return FORBIDDEN_PRESENT_RESEARCHER_PHRASES
        .filter((phrase) => recordText.includes(phrase) && !allowed.some((reference) => reference.phrase === phrase))
        .map((phrase) => ({ relicId: relic.id, phrase }));
    });

    expect(violations).toEqual([]);
  });

  it("렉시아의 신체 수치와 원종 화석 단계는 프로필과 도감에만 공개한다", () => {
    const rex = PLAYABLE_RELICS.find((relic) => relic.id === "rex")!;
    // 성체 초기라는 말이 인간 나이가 아니라 티라노사우루스 화석의 단계로 서술되는지도 함께 고정한다.
    expect(rex.observationProfile).toMatchObject({ height: "1.63 m", weight: "54 kg", lifeStage: "성체 초기" });
    expect(rex.catalogSummary).toContain("체중 54kg");
    expect(rex.unlockRecord.status === "recorded" && rex.unlockRecord.text).not.toContain("54kg");
    expect(rex.unlockRecord.status === "recorded" && rex.unlockRecord.text).not.toContain("화석");
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
    // 신규 메테 163번도 기존 앞자리 보존 문자열 순서의 마지막에 안정적으로 정렬된다.
    expect(sorted.map((relic) => relic.specimenNumber)).toEqual(["001", "014", "038", "044", "072", "093", "105", "163"]);
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

  it("루카의 무리 사냥·치명적인 발톱·약점 관통 수치 계약을 공개한다", () => {
    const luka = PLAYABLE_RELICS.find((relic) => relic.id === "luka")!;
    // 이름뿐 아니라 엔진이 판별할 계수·게이지·주기·전이 기준까지 카탈로그 회귀로 함께 고정한다.
    expect(luka.ferocityTrait).toMatchObject({ name: "폭주", effectId: "packHunt", stealthDurationSeconds: 3, retriggerPackHunt: true, sharedTargetAttackSpeedPercent: 25 });
    expect(luka.passive).toMatchObject({ name: "무리 사냥", kind: "followHighestAttackAllyTarget" });
    expect(luka.basic).toMatchObject({ name: "치명적인 발톱", power: 80, periodicCritical: { every: 4 } });
    expect(luka.ultimate).toMatchObject({ name: "약점 관통", power: 200, cost: 90, damageTransfer: { percent: 75, distanceOrigin: "primaryTarget" } });
  });

  it("루카의 관찰 프로필과 도감은 같은 신체 수치와 단거리 선수 체형을 공개한다", () => {
    const luka = PLAYABLE_RELICS.find((relic) => relic.id === "luka")!;
    // E.C. 신체 나잇대와 성체 벨로키랍토르 화석 단계가 서로 독립된 설정임을 정적 정의로 고정한다.
    expect(luka.observationProfile).toMatchObject({
      originYear: "약 7,500만 년 전",
      restorationYear: "E.C. 16년",
      lifeStage: "성체",
      height: "1.62 m",
      weight: "59 kg",
    });
    expect(luka.catalogSummary).toContain("신장 1.62m, 체중 59kg");
    expect(luka.catalogSummary).toContain("단거리 질주에 적합한 발달한 하체 근육과 가벼운 골격");
    expect(luka.catalogSummary).toContain("성체 벨로키랍토르 화석 기반 표본");
  });

  it("루카의 해금 기록은 주인공이 관찰한 휴식과 교우 및 치즈케이크 습관을 담는다", () => {
    const luka = PLAYABLE_RELICS.find((relic) => relic.id === "luka")!;
    // 생활 설정의 핵심 문구를 각각 검증해 이후 문장 다듬기와 설정 누락을 구분할 수 있게 한다.
    expect(luka.unlockRecord.status).toBe("recorded");
    if (luka.unlockRecord.status !== "recorded") return;
    expect(luka.unlockRecord.text).toContain("나는 루카를");
    expect(luka.unlockRecord.text).toContain("집과 휴식을 무엇보다 좋아하는 단거리 달리기 선수");
    expect(luka.unlockRecord.text).toContain("다른 육식 계열 렐릭들과도 대체로 원만하게 지낸다");
    expect(luka.unlockRecord.text).toContain("연구소 소파에 길게 누워");
    expect(luka.unlockRecord.text).toContain("늘 먼저 말을 걸어 오는");
    expect(luka.unlockRecord.text).toContain("좋아하는 치즈케이크");
    expect(luka.unlockRecord.text).toContain("살이 찌면 달리기가 둔해지지 않겠냐며 가볍게 걱정");
    expect(luka.unlockRecord.text).toContain("하체 근육량이 탄탄한");
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
