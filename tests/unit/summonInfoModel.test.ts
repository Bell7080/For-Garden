import { describe, expect, it } from "vitest";
import { capabilitiesFor } from "../../src/core/infoCapabilities";
import { getRelic } from "../../src/data/relics";
import { KURO_SD_METADATA, SHIRO_SD_METADATA } from "../../src/puppets/assetMetadata";
import { parseKeywordText } from "../../src/data/keywords";
import {
  canShowSummonInfo,
  SUMMON_INFO_LAYOUT,
  summonInfoModel,
  summonKeyword,
  summonKeywordId,
} from "../../src/ui/summonInfoModel";

/** 테스트가 데이터 ID를 화면 코드에 복제하지 않도록 정의가 소유한 순서로 소환수를 찾는다. */
const summons = getRelic("dian").summons ?? [];
const ownerStats = { ...getRelic("dian").stats, atk: 240, ap: 180 };

describe("소환수 정보 표시 모델", () => {
  it("쿠로/시로를 이름 외의 문양과 서로 다른 현재 성장축으로 구분한다", () => {
    const models = summons.map((summon) => summonInfoModel(summon, ownerStats));
    expect(models.map(({ mark }) => mark)).toEqual(["fang", "moon"]);
    expect(models.map(({ ownerBasisLabel, ownerBasisValue }) => [ownerBasisLabel, ownerBasisValue])).toEqual([["공격력", 240], ["주문력", 180]]);
    expect(models[0].stats.atk).toBeGreaterThan(0); expect(models[0].stats.ap).toBe(0);
    expect(models[1].stats.ap).toBeGreaterThan(0); expect(models[1].stats.atk).toBe(0);
  });

  it("미보유 도감만 소환 정보를 감추고 공개된 친구/적 전투 정보는 기존 성장 정책을 따른다", () => {
    expect(canShowSummonInfo(capabilitiesFor("owner"), false)).toBe(false);
    expect(canShowSummonInfo(capabilitiesFor("owner"), true)).toBe(true);
    expect(canShowSummonInfo(capabilitiesFor("friend"), true)).toBe(true);
    expect(canShowSummonInfo(capabilitiesFor("enemy"), true)).toBe(true);
  });

  it("패시브 본문이 정의 ID로 만든 태그로 두 소환수를 가리키고 뜻풀이가 데이터에서 나온다", () => {
    const dian = getRelic("dian");
    const tagged = parseKeywordText(dian.passive.desc, summons.map((summon) => summonKeyword(summon, dian.name)));
    // 버튼을 따로 세우지 않고 패시브 한 문장이 두 소환수를 모두 가리킨다.
    expect(tagged.flatMap((segment) => (segment.keyword ? [segment.keyword.id] : [])))
      .toEqual(summons.map(summonKeywordId));
    const [kuro, shiro] = summons.map((summon) => summonKeyword(summon, dian.name));
    expect(kuro.term).toBe("쿠로");
    expect(kuro.description).toContain("근거리");
    expect(kuro.description).toContain("공격력");
    expect(kuro.description).toContain(`${summons[0].resummon.cooldownSeconds}초`);
    expect(shiro.description).toContain("주문력");
    // 뜻풀이는 문맥 사전 없이도 전역 규칙어만 참조해 태그가 빈 채로 남지 않는다.
    expect(parseKeywordText(shiro.description).some((segment) => segment.keyword?.id === "magical-damage")).toBe(true);
  });

  it("1080×1920에서 스킬열·SD·레이더와 상세 쪽지가 서로의 전용 영역을 침범하지 않는다", () => {
    const left = SUMMON_INFO_LAYOUT.x - SUMMON_INFO_LAYOUT.width / 2;
    const right = SUMMON_INFO_LAYOUT.x + SUMMON_INFO_LAYOUT.width / 2;
    const top = SUMMON_INFO_LAYOUT.y - SUMMON_INFO_LAYOUT.height / 2;
    const bottom = SUMMON_INFO_LAYOUT.y + SUMMON_INFO_LAYOUT.height / 2;
    expect([left, top, 1080 - right, 1920 - bottom].every((margin) => margin >= 0)).toBe(true);
    expect(SUMMON_INFO_LAYOUT.skillX + SUMMON_INFO_LAYOUT.skillSize / 2)
      .toBeLessThan(SUMMON_INFO_LAYOUT.standX - SUMMON_INFO_LAYOUT.standWidth / 2);
    // SD 폭은 실제 원화의 알파 경계에서 나온다 — 늑대는 높이보다 넓어 지어낸 상수로는 겹침을
    // 잡지 못한다(390 높이로 가운데 세웠을 때 오각형 왼쪽 절반이 통째로 덮였다).
    for (const wolf of [KURO_SD_METADATA, SHIRO_SD_METADATA]) {
      const aspect = (wolf.content.right - wolf.content.left) / (wolf.content.bottom - wolf.content.top);
      const halfWidth = SUMMON_INFO_LAYOUT.puppetHeight * aspect / 2;
      expect(SUMMON_INFO_LAYOUT.standX + halfWidth)
        .toBeLessThan(SUMMON_INFO_LAYOUT.radarX - SUMMON_INFO_LAYOUT.radarRadius);
    }
    expect(SUMMON_INFO_LAYOUT.detail.width).toBeLessThan(SUMMON_INFO_LAYOUT.width);
    expect(SUMMON_INFO_LAYOUT.detail.height).toBeLessThan(SUMMON_INFO_LAYOUT.height);
  });
});
