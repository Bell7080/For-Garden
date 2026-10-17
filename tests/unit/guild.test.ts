import { describe, expect, it } from "vitest";
import {
  GUILD_ATTENDANCE_REWARD, GUILD_COIN_GEM_VALUE, GUILD_LEVELS, GUILD_MAX_LEVEL, GUILD_SHOP_PRODUCTS, guildCan, guildCanKick,
  guildCapacity, guildLevelOf, guildLevelProgress, guildPerks, guildSuccessor, guildWeekKey, guildWeekdayIndex, validateGuildName,
} from "../../src/core/guild";
import { TRADE_GEM_RATE } from "../../src/data/tradePackages";
import { DUEL_SHOP_ITEM_GEM_VALUE } from "../../src/data/duelShop";

describe("길드 레벨", () => {
  it("은 부흥도와 정원이 오르기만 하고 10에서 멈춘다", () => {
    expect(GUILD_LEVELS).toHaveLength(GUILD_MAX_LEVEL);
    GUILD_LEVELS.slice(1).forEach((def, i) => {
      expect(def.prosperity).toBeGreaterThan(GUILD_LEVELS[i].prosperity);
      expect(def.capacity).toBeGreaterThan(GUILD_LEVELS[i].capacity);
    });
    expect(guildLevelOf(0)).toBe(1);
    expect(guildLevelOf(2_499)).toBe(1);
    expect(guildLevelOf(2_500)).toBe(2);
    expect(guildLevelOf(10_000_000)).toBe(10);
    expect(guildCapacity(1)).toBe(20);
    expect(guildCapacity(10)).toBe(40);
    expect(guildLevelProgress(60_000).next).toBeNull();
    expect(guildLevelProgress(3_000)).toMatchObject({ level: 2, into: 500, span: 3_500, next: 3 });
  });

  it("의 혜택은 5%·10% 단위로만 얹고 대체 규칙을 지킨다", () => {
    expect(guildPerks(2)).toMatchObject({ excavationBonusPercent: 0, dispatchTimeReductionPercent: 0, shopSlots: 3 });
    expect(guildPerks(3).excavationBonusPercent).toBe(5);
    expect(guildPerks(6).excavationBonusPercent).toBe(5);
    expect(guildPerks(7).excavationBonusPercent).toBe(10);
    expect(guildPerks(5).dispatchTimeReductionPercent).toBe(5);
    expect(guildPerks(9).dispatchTimeReductionPercent).toBe(10);
    expect(guildPerks(10).shopSlots).toBe(4);
  });
});

describe("길드 직위", () => {
  it("의 권한은 길드장 아래로 좁아진다", () => {
    expect(guildCan("member", "formation")).toBe(false);
    expect(guildCan("officer", "formation")).toBe(true);
    expect(guildCan("officer", "kick")).toBe(false);
    expect(guildCan("vice", "promote")).toBe(false);
    expect(guildCan("leader", "disband")).toBe(true);
    expect(guildCanKick("vice", "officer")).toBe(true);
    expect(guildCanKick("vice", "vice")).toBe(false);
    expect(guildCanKick("leader", "vice")).toBe(true);
  });

  it("의 후계는 기여도 1위 임원 이상이고 멤버만 있으면 없다", () => {
    const base = { joinedAt: 1 };
    expect(guildSuccessor([{ ...base, userId: "m", role: "member", contributionTotal: 99 }])).toBeNull();
    expect(guildSuccessor([
      { ...base, userId: "o", role: "officer", contributionTotal: 50 },
      { ...base, userId: "v", role: "vice", contributionTotal: 40 },
      { ...base, userId: "m", role: "member", contributionTotal: 99 },
    ])).toBe("o");
  });
});

describe("길드 이름", () => {
  it("은 2~12자의 문자·숫자·공백이다", () => {
    expect(validateGuildName("  포가든   수호대 ")).toEqual({ ok: true, name: "포가든 수호대" });
    expect(validateGuildName("a")).toEqual({ ok: false, problem: "short" });
    expect(validateGuildName("가나다라마바사아자차카타파")).toEqual({ ok: false, problem: "long" });
    expect(validateGuildName("   ")).toEqual({ ok: false, problem: "empty" });
    expect(validateGuildName("길드<script>")).toEqual({ ok: false, problem: "invalid" });
  });
});

describe("길드 시각 키", () => {
  it("의 주는 월요일 00:00 UTC에 시작한다", () => {
    expect(guildWeekKey(Date.UTC(2026, 9, 18, 23, 59))).toBe("2026-10-12"); // 일요일
    expect(guildWeekKey(Date.UTC(2026, 9, 19, 0, 0))).toBe("2026-10-19"); // 월요일
    expect(guildWeekdayIndex(Date.UTC(2026, 9, 19))).toBe(0);
    expect(guildWeekdayIndex(Date.UTC(2026, 9, 18))).toBe(6);
  });
});

describe("길드 보상 값", () => {
  it("출석 골드와 치즈케이크는 같은 환산 가치다", () => {
    const gold = GUILD_ATTENDANCE_REWARD.gold / TRADE_GEM_RATE.gold;
    const cake = GUILD_ATTENDANCE_REWARD.cheesecake / TRADE_GEM_RATE.cheesecake;
    expect(Math.abs(gold - cake) / gold).toBeLessThan(0.05);
  });

  it("상점은 받는 것의 젬 값이 낸 값의 1.0~1.25배 안이다", () => {
    for (const product of GUILD_SHOP_PRODUCTS) {
      const paid = product.price * GUILD_COIN_GEM_VALUE;
      const got = (product.grant.gold ?? 0) / TRADE_GEM_RATE.gold + (product.grant.cheesecake ?? 0) / TRADE_GEM_RATE.cheesecake
        + (product.grant.item ? product.grant.item.quantity * (DUEL_SHOP_ITEM_GEM_VALUE[product.grant.item.id] ?? Number.NaN) : 0);
      expect(got / paid, product.id).toBeGreaterThanOrEqual(1);
      expect(got / paid, product.id).toBeLessThanOrEqual(1.25);
    }
  });
});
