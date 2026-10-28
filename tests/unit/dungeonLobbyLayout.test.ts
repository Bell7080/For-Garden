import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import {
  DUNGEON_LOBBY, dungeonActionButtonWidth, dungeonActionButtonX, dungeonActionFitsAboveBackButton, dungeonLineupSpot,
  dungeonStageBounds, dungeonStripBounds, dungeonStripChipX, dungeonSummaryCard, dungeonSummaryTop,
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
    // 요약 카드의 윗변도 고른 칸이 커진 몫에 닿지 않는다.
    expect(strip.bottom + 12).toBeLessThan(dungeonSummaryTop());
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

  it("무대의 적은 정예 셋도 물량 열다섯도 무대 폭 안에 서고, 가운데 정예는 한 걸음 앞이다", () => {
    const half = DUNGEON_LOBBY.stage.width / 2;
    for (const count of [3, 5, 10, 15]) {
      for (let index = 0; index < count; index += 1) {
        const spot = dungeonLineupSpot(index, count);
        expect(Math.abs(spot.x)).toBeLessThan(half - 40);
        expect(spot.ground).toBeLessThan(DUNGEON_LOBBY.stage.height / 2 - 40);
      }
    }
    expect(dungeonLineupSpot(1, 3).ground).toBeGreaterThan(dungeonLineupSpot(0, 3).ground);
    // 정예의 머리 위 라운드 표가 이름 띠를 파고들지 않는다.
    const { band, height } = DUNGEON_LOBBY.stage;
    const elite = dungeonLineupSpot(0, 3);
    expect(elite.ground - elite.height - 34 - 23).toBeGreaterThan(-height / 2 + band);
    // 물량은 앞줄 다섯만 이름표를 달고 뒷줄은 무리로만 선다.
    const crowd = Array.from({ length: 15 }, (_, index) => dungeonLineupSpot(index, 15));
    expect(crowd.filter((spot) => spot.labeled)).toHaveLength(5);
    for (const spot of crowd) expect(spot.ground - spot.height).toBeGreaterThan(-height / 2 + band - 40);
  });

  it("넘김 화살표는 무대 바깥 여백에 서고 화면 밖으로 나가지 않는다", () => {
    const { width, arrow } = DUNGEON_LOBBY.stage;
    const halfArrow = (arrow.size * 0.82) / 2;
    // 안쪽 끝이 무대 가장자리 근처까지만 들어온다 — 양 끝 적의 표식과 겹치지 않는다.
    expect(width / 2 + arrow.outset - halfArrow).toBeGreaterThanOrEqual(width / 2 - 4);
    expect(BASE_WIDTH / 2 + width / 2 + arrow.outset + halfArrow).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it("조작 버튼 셋은 출격을 가운데에 두고 겹치지 않으며 요약 카드 줄과 같은 폭에 선다", () => {
    expect(dungeonActionButtonX(1)).toBeCloseTo(BASE_WIDTH / 2, 5);
    expect((dungeonActionButtonX(0) + dungeonActionButtonX(2)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
    expect(dungeonActionButtonWidth(1)).toBeGreaterThan(dungeonActionButtonWidth(0));
    for (let index = 1; index < 3; index += 1) {
      expect(dungeonActionButtonX(index) - dungeonActionButtonWidth(index) / 2).toBeGreaterThan(dungeonActionButtonX(index - 1) + dungeonActionButtonWidth(index - 1) / 2);
    }
    const left = dungeonActionButtonX(0) - dungeonActionButtonWidth(0) / 2;
    const cardLeft = dungeonSummaryCard(0).x - dungeonSummaryCard(0).width / 2;
    expect(left).toBeCloseTo(cardLeft, 5);
  });

  /** 두 카드는 화면 안·가운데에 서고, 다섯 속성 뱃지가 전투력 숫자 자리(일곱 자리)를 파고들지 않는다. */
  it("요약 카드 둘이 화면 안에 서고 다섯 속성 뱃지가 전투력 숫자를 파고들지 않는다", () => {
    const power = dungeonSummaryCard(0);
    const reward = dungeonSummaryCard(1);
    expect(power.x - power.width / 2).toBeGreaterThan(40);
    expect(reward.x + reward.width / 2).toBeLessThan(BASE_WIDTH - 40);
    expect(reward.x - reward.width / 2).toBeGreaterThan(power.x + power.width / 2);
    expect(((power.x - power.width / 2) + (reward.x + reward.width / 2)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
    const { element } = DUNGEON_LOBBY.summary;
    const last = power.width / 2 - element.rightInset - element.size / 2;
    const firstLeft = last - 4 * element.step - element.size / 2;
    // "1,234,567" 아홉 글자 × 54px 글꼴의 대략 폭(0.6em).
    expect(firstLeft).toBeGreaterThan(-power.width / 2 + 34 + 9 * 54 * 0.5);
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
