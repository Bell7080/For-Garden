import { describe, expect, it } from "vitest";
import { strataRewardExpectedAmount } from "../../src/core/archaeologyMap";
import { GUILD_MAX_LEVEL, guildDispatchMinutes, guildPerks } from "../../src/core/guild";
import { EXCAVATION_GROWTH, EXCAVATION_PRODUCTION_SCALE } from "../../src/core/idleExcavation";
import { strataRunModifiers } from "../../src/core/strataCrystal";
import { ARCHAEOLOGY_SITES } from "../../src/data/archaeologySites";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";
import { findStrataLayer } from "../../src/data/strataLayers";

/**
 * 원석 수급 규칙: 고고학이 주 수급처다. 접속 모델 둘(하루 1번 = 충전 3회·도시 1회·수확 1회 /
 * 활발히 = 충전 8회·도시 최대 4회·수확 3회)에서 다른 무과금 수급처 하나가 고고학의 75%를,
 * 교류가 35%를 넘지 못한다. 새 수급처를 더하거나 값을 올리면 이 표부터 다시 잰다.
 * 길드 레벨 혜택(발굴 수확 +%, 교류 시간 −%)은 가장 높은 단계로 얹어 잰다.
 */
const PERKS = guildPerks(GUILD_MAX_LEVEL);
const MODELS = {
  light: { charges: 3, dispatches: 1, harvests: 1 },
  active: { charges: 8, dispatches: 4, harvests: 3 },
} as const;
const SPECIALTY_FACTOR = 1.3;

function archaeologyPerDay(charges: number): number {
  const digs = ARCHAEOLOGY_SITES.map((site) => ({
    perDig: strataRewardExpectedAmount(findStrataLayer(site.layerId)!, "rawStone", strataRunModifiers(site, 0)),
    perDay: 24 / site.cooldownHours,
  })).sort((a, b) => b.perDig - a.perDig);
  let left = charges; let total = 0;
  for (const dig of digs) { const used = Math.min(dig.perDay, left); total += used * dig.perDig; left -= used; if (left <= 0) break; }
  return total;
}

function interactionPerDay(dispatches: number): number {
  return INTERACTION_CITIES.reduce((sum, city) => {
    const max = city.rewards.find((reward) => reward.currency === "rawStone")?.max ?? 0;
    // 하루에 보낼 수 있는 것은 온전한 파견 수다 — 시간이 줄어도 하루 한 번 보던 도시를 하루 1.1번 보내지는 못한다.
    const perDay = Math.floor(1440 / guildDispatchMinutes(city.durationMinutes, PERKS.dispatchTimeReductionPercent));
    return sum + (max * SPECIALTY_FACTOR / 2) * Math.min(dispatches, perDay);
  }, 0);
}

/** 원석 렐릭 셋, 40레벨·2돌파, 대표 기본값(시간당 1.2 · 효율 1.1). */
function idlePerDay(harvests: number): number {
  const perHour = 1.2 * 1.1 * EXCAVATION_PRODUCTION_SCALE.rawStone * (1 + 39 * EXCAVATION_GROWTH.perLevel + 2 * EXCAVATION_GROWTH.perBreakthrough);
  return perHour * 3 * 8 * harvests * (1 + PERKS.excavationBonusPercent / 100);
}

const ADS_AND_SHOP = 600; // 광고 100×3 + 인양 광물 회수분 300×1

describe("원석 수급 규칙", () => {
  for (const [name, model] of Object.entries(MODELS)) {
    it(`${name}: 고고학이 다른 어떤 수급처보다 크고 교류는 35% 이하다`, () => {
      const arch = archaeologyPerDay(model.charges);
      const inter = interactionPerDay(model.dispatches);
      const idle = idlePerDay(model.harvests);
      expect(inter).toBeLessThanOrEqual(arch * 0.35);
      expect(idle).toBeLessThanOrEqual(arch * 0.75);
      expect(ADS_AND_SHOP / 2).toBeLessThanOrEqual(arch * 0.75);
    });
  }
});
