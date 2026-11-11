import { describe, expect, it } from "vitest";
import { GUILD_GUARD_PAGE, GUILD_MENU_POPUP, GUILD_RANKING_POPUP, GUILD_SCREEN, GUILD_WAR_MAP, guildGuardTraitBarX, guildGuardTraitCellX, guildRankingRows } from "../../src/ui/guildLayout";
import { RANKING_POPUP_REWARD_CHIP_BOTTOM } from "../../src/ui/rankingChipLayout";
import { GUILD_GUARD, guardWaveCount, guardWaveLevel } from "../../src/core/guildGuard";

describe("길드 순위 창", () => {
  it("첫 줄이 왼쪽 위 보상 칩 밑변 아래에서 시작한다", () => {
    // 예전 길드 주간 순위는 첫 줄 윗변(119)이 칩 밑변(134)을 파고들어 칩이 1위 줄의 순위·배지를 덮었다.
    for (const lines of [1, 4, 9]) {
      const { height, firstRowY } = guildRankingRows(lines, 142, 156, true);
      const rowTop = firstRowY - 142 / 2 + height / 2;
      expect(rowTop).toBeGreaterThanOrEqual(RANKING_POPUP_REWARD_CHIP_BOTTOM + GUILD_RANKING_POPUP.chipGap);
      // 마지막 줄은 판 안에 든다.
      expect(firstRowY + (lines - 1) * 156 + 142 / 2).toBeLessThanOrEqual(height / 2 - GUILD_RANKING_POPUP.bottomPad + 1);
    }
  });

  it("보상 칩이 없는 창은 칩 자리를 비워 두지 않는다", () => {
    expect(guildRankingRows(3, 152, 170, false).height).toBeLessThan(guildRankingRows(3, 152, 170, true).height);
  });
});

describe("수호전 특징 판", () => {
  const T = GUILD_GUARD_PAGE.traits;
  it("기록 판 아래 · 순위 버튼 줄 위에 든다", () => {
    const R = GUILD_GUARD_PAGE.record;
    const K = GUILD_GUARD_PAGE.ranking;
    expect(T.top).toBeGreaterThanOrEqual(R.y + R.height / 2 + 12);
    expect(T.top + T.height).toBeLessThanOrEqual(K.y - K.height / 2 - 12);
  });

  it("규칙 칸과 막대가 판 안에 든다", () => {
    const half = T.width / 2;
    expect(guildGuardTraitCellX(0) - T.cells.width / 2).toBeGreaterThanOrEqual(-half + 8);
    expect(guildGuardTraitCellX(2) + T.cells.width / 2).toBeLessThanOrEqual(half - 8);
    const n = T.waves.length;
    expect(guildGuardTraitBarX(0, n) - T.bars.width / 2).toBeGreaterThanOrEqual(-half + 8);
    expect(guildGuardTraitBarX(n - 1, n) + T.bars.width / 2).toBeLessThanOrEqual(half - 8);
    // 가장 높은 막대의 레벨 글이 성장 한 줄과 겹치지 않는다.
    expect(T.bars.baseline - T.bars.maxHeight - T.bars.labelGap - 14).toBeGreaterThan(T.ruleY + 14);
    expect(T.bars.tickY + 12).toBeLessThanOrEqual(T.height);
  });

  it("막대는 실제 웨이브 규칙의 값이고 깊을수록 오른다", () => {
    const levels = T.waves.map(guardWaveLevel);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i]).toBeGreaterThan(levels[i - 1]);
    expect(guardWaveLevel(5) - guardWaveLevel(4)).toBe(GUILD_GUARD.levelPerWave);
    expect(Math.max(...T.waves.map(guardWaveCount))).toBeLessThanOrEqual(GUILD_GUARD.gruntCap);
  });
});

describe("길드 화면 조작", () => {
  it("메뉴 아이콘 칩은 상단 줄 경계선에 걸치지 않고 조작 줄 위에서 끝난다", () => {
    const { y, size } = GUILD_SCREEN.menuChip;
    expect(y - size / 2).toBeGreaterThanOrEqual(GUILD_SCREEN.topBarLine + 32);
    expect(y + size / 2).toBeLessThan(GUILD_SCREEN.controls.y - GUILD_SCREEN.controls.height / 2);
  });

  it("메뉴 창의 두 타일이 창 안에 든다", () => {
    const M = GUILD_MENU_POPUP;
    expect(M.tile.width * 2 + M.gap).toBeLessThanOrEqual(M.width - 80);
    expect(M.tileTop + M.tile.height).toBeLessThanOrEqual(M.height - 40);
  });

  it("방어덱 수정 버튼 줄은 지도 판과 지부 탭 사이에 든다", () => {
    const A = GUILD_WAR_MAP.actions;
    expect(A.y - A.height / 2).toBeGreaterThanOrEqual(GUILD_WAR_MAP.field.bottom);
    expect(A.y + A.height / 2).toBeLessThan(GUILD_SCREEN.tabs.y - GUILD_SCREEN.tabs.height / 2);
  });
});
