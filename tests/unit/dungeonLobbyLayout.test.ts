import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import {
  DUNGEON_LOBBY, dungeonActionButtonX, dungeonActionFitsAboveBackButton, dungeonLineupSpot,
  dungeonStageBounds, dungeonStripBounds, dungeonStripChipX, dungeonSummaryTitleTop, dungeonSummaryTop,
} from "../../src/ui/dungeonLobbyLayout";
import { DUNGEON_THEME } from "../../src/ui/dungeonTheme";

describe("던전 입구 배치표", () => {
  it("무대 → 난이도 줄 → 요약 판 → 조작이 위에서부터 겹치지 않고 선다", () => {
    const stage = dungeonStageBounds();
    expect(stage.top).toBeGreaterThan(DUNGEON_LOBBY.title.y);
    // 난이도 제목표(글자 34 → 높이 52)가 무대 밑변에 닿지 않는다.
    expect(DUNGEON_LOBBY.strip.titleY - 26).toBeGreaterThan(stage.bottom);
    const strip = dungeonStripBounds();
    expect(strip.top).toBeGreaterThan(DUNGEON_LOBBY.strip.titleY + 26);
    // 판 윗변에 걸터앉는 제목표(적 전투력·보상)도 고른 칸이 커진 몫에 닿지 않는다.
    expect(strip.bottom).toBeLessThan(dungeonSummaryTitleTop());
    const summaryBottom = DUNGEON_LOBBY.summary.y + DUNGEON_LOBBY.summary.height / 2;
    const actionTop = DUNGEON_LOBBY.action.y - DUNGEON_LOBBY.action.height / 2;
    // 버튼은 누르면 커지므로 그만큼 여유를 둔다.
    expect(actionTop).toBeGreaterThan(summaryBottom + DUNGEON_LOBBY.action.height * 0.06);
    expect(dungeonSummaryTop()).toBeGreaterThan(strip.bottom);
    expect(dungeonActionFitsAboveBackButton()).toBe(true);
  });

  /** 두 던전 중 단계가 가장 많은 쪽도 번호 줄이 화면 안에 들고 칸끼리 겹치지 않는다. */
  it("가장 긴 번호 줄도 화면 안에 들어간다", () => {
    const count = Math.max(CAKE_OPERATION_TIERS.length, BOUNTY_TIERS.length);
    const { chipWidth, selectedScale } = DUNGEON_LOBBY.strip;
    expect(dungeonStripChipX(0, count) - (chipWidth * selectedScale) / 2).toBeGreaterThan(40);
    expect(dungeonStripChipX(count - 1, count) + (chipWidth * selectedScale) / 2).toBeLessThan(BASE_WIDTH - 40);
    expect((dungeonStripChipX(0, count) + dungeonStripChipX(count - 1, count)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
  });

  it("무대의 적은 정예 셋도 물량 다섯도 무대 폭 안에 서고, 가운데 정예는 한 걸음 앞이다", () => {
    const half = DUNGEON_LOBBY.stage.width / 2;
    for (const count of [3, 5]) {
      for (let index = 0; index < count; index += 1) {
        const spot = dungeonLineupSpot(index, count);
        expect(Math.abs(spot.x)).toBeLessThan(half - DUNGEON_LOBBY.stage.arrow.inset - 40);
        expect(spot.ground).toBeLessThan(DUNGEON_LOBBY.stage.height / 2 - 40);
      }
    }
    expect(dungeonLineupSpot(1, 3).ground).toBeGreaterThan(dungeonLineupSpot(0, 3).ground);
    // 정예의 머리 위 라운드 표가 이름 띠를 파고들지 않는다.
    const { sd, band, height } = DUNGEON_LOBBY.stage;
    expect(dungeonLineupSpot(0, 3).ground - sd - 34 - 23).toBeGreaterThan(-height / 2 + band);
  });

  it("조작 버튼은 화면 가운데를 기준으로 균등하게 선다", () => {
    expect((dungeonActionButtonX(0) + dungeonActionButtonX(1)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
  });

  /** 속성 뱃지는 대작전의 다섯 속성까지 요약 판 왼쪽 절반 안(가르는 선 앞)에 든다. */
  it("다섯 속성 뱃지가 적 전투력 숫자 자리를 파고들지 않는다", () => {
    const { width, element } = DUNGEON_LOBBY.summary;
    const last = 40 - element.rightInset - element.size / 2;
    const firstLeft = last - 4 * element.step - element.size / 2;
    expect(firstLeft).toBeGreaterThan(-width / 2 + 48 + 8 * 26);
  });

  it("두 던전은 서로 다른 색을 쓴다 — 치즈빛과 푸른 소라빛", () => {
    expect(DUNGEON_THEME.cake.accent).not.toBe(DUNGEON_THEME.bounty.accent);
    // 치즈빛은 붉은·초록 채널이 파랑보다 높고, 소라빛은 파랑이 가장 높다.
    const rgb = (value: number) => [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
    const [cr, cg, cb] = rgb(DUNGEON_THEME.cake.accent);
    expect(cr).toBeGreaterThan(cb); expect(cg).toBeGreaterThan(cb);
    const [br, , bb] = rgb(DUNGEON_THEME.bounty.accent);
    expect(bb).toBeGreaterThan(br);
  });
});
