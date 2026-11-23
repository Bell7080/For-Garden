import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NOTIFICATION_DOT_INSET, NOTIFICATION_DOT_STYLE, notificationCorner } from "../../src/ui/notificationDotStyle";

describe("알림 점 자리 토큰", () => {
  it("우상단 안쪽에 선다", () => {
    expect(notificationCorner("tab", 200, 80)).toEqual({ x: 100 - NOTIFICATION_DOT_INSET.tab.x, y: -40 + NOTIFICATION_DOT_INSET.tab.y });
    expect(notificationCorner("frame", 120, 120)).toEqual({ x: 52, y: -52 });
  });

  it("점의 절반 이상은 판 안에 든다", () => {
    for (const inset of Object.values(NOTIFICATION_DOT_INSET)) {
      expect(inset.x).toBeGreaterThanOrEqual(0);
      expect(inset.x).toBeLessThan(NOTIFICATION_DOT_STYLE.radius * 2);
      expect(inset.y).toBeLessThan(NOTIFICATION_DOT_STYLE.radius * 2);
    }
  });

  it("받기 후광은 Graphics로 다시 그리지 않고 공용 구운 한 장을 쓴다", () => {
    for (const file of ["MissionsPopup", "AchievementsPopup", "CodexPopup", "NewbieGrowthPopup", "PassPopup"]) {
      const source = readFileSync(`src/ui/${file}.ts`, "utf8");
      expect(source, file).toContain("addClaimHalo(");
      expect(source, file).not.toMatch(/fillStyle\(COLOR\.missionClaim[^)]*\)\.fillPoints/);
    }
  });

  it("열린 탭에는 점을 세우지 않는다", () => {
    expect(readFileSync("src/ui/MissionsPopup.ts", "utf8")).toContain("period !== this.period");
    expect(readFileSync("src/ui/MailPopup.ts", "utf8")).toContain("tab !== this.tab");
    expect(readFileSync("src/scenes/ShopScene.ts", "utf8")).toContain("tab.id !== this.selectedCategory");
  });
});
