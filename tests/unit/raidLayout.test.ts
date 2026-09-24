import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  RAID_ACTIONS, RAID_BOARD, RAID_BOARD_PLATE, RAID_BOSS_SPOT, RAID_HP_BAR, RAID_LIST, RAID_LIST_CHROME,
  RAID_BOSS_PICK, RAID_DIFFICULTY_PICK, RAID_DIFFICULTY_TONE, RAID_LAYER_OWNER, RAID_SUMMON_INTENSITY, RAID_SUMMON_STAGE,
  raidBoardViewport, raidBossPickHeight, raidLayerStack, raidPickHeight, raidSortieBackGap, raidSummonBackGap,
} from "../../src/ui/raidLayout";
import { RAID_DIFFICULTY, RAID_SUMMON_DIFFICULTIES } from "../../src/data/raid";

describe("레이드 배치표", () => {
  it("보스는 발끝을 화면 밖으로 내보내고 상반신만 남긴다", () => {
    // 원정 기록 화면과 같은 문법이다 — 상자에 맞춰 줄이면 얼굴보다 여백이 먼저 읽힌다.
    expect(RAID_BOSS_SPOT.groundY).toBeGreaterThan(BASE_HEIGHT);
    const top = RAID_BOSS_SPOT.groundY - RAID_BOSS_SPOT.height;
    expect(top).toBeGreaterThan(0);
    // 머리 끝이 제목 줄 아래에서 시작해 머리글을 덮지 않는다.
    expect(top).toBeGreaterThan(RAID_HP_BAR.labelY - RAID_HP_BAR.width);
  });

  it("원화가 잠기는 띠가 남은 체력 줄을 덮고 목록 윗변에서 끝난다", () => {
    // 자르지 않고 잠근다 — 자르면 그 선이 가로줄로 보이고, 그대로 두면 유리 줄 뒤로 다리가 비친다.
    expect(RAID_BOSS_SPOT.fade.top).toBeLessThan(RAID_HP_BAR.labelY);
    expect(RAID_BOSS_SPOT.fade.bottom).toBeGreaterThanOrEqual(RAID_HP_BAR.valueY);
    expect(RAID_BOSS_SPOT.fade.bottom).toBeLessThanOrEqual(RAID_BOARD.viewport.top);
  });

  it("출격이 화면 가운데에 홀로 서고 뒤로가기를 침범하지 않는다", () => {
    // 이 줄에 서는 것은 출격 하나뿐이다 — 상점 입구는 로비 출격판 밖 줄이 이미 갖는다.
    expect(RAID_ACTIONS.sortie.centerX).toBe(BASE_WIDTH / 2);
    expect(Object.keys(RAID_ACTIONS)).toEqual(["y", "sortie"]);
    expect(raidSortieBackGap()).toBeGreaterThan(0);
  });

  it("기여 목록이 흐르는 창이 하단 조작 위에서 끝난다", () => {
    const viewport = raidBoardViewport();
    expect(viewport.height).toBeGreaterThan(0);
    expect(RAID_BOARD.viewport.bottom).toBeLessThan(RAID_ACTIONS.y - RAID_ACTIONS.sortie.height / 2);
  });

  it("기여 목록의 제목표는 판 윗변에 걸터앉는다", () => {
    // 판 안에 들여 세우던 때는 같은 위계의 제목이 이 화면에서만 맨 글자처럼 섰다.
    expect(RAID_BOARD.titleY).toBe(RAID_BOARD_PLATE.top - 4);
    expect(RAID_BOARD.titleX).toBe((1080 - RAID_BOARD_PLATE.width) / 2);
    // 제목표(높이 52)가 남은 체력 수치 줄과 겹치지 않는다.
    expect(RAID_BOARD.titleY - 26).toBeGreaterThan(RAID_HP_BAR.valueY + 14);
  });
  it("목록의 층은 크기마다 글줄·보상·체력 줄이 겹치지 않는다", () => {
    for (const [kind, spec] of Object.entries(RAID_LIST.kinds)) {
      const { height, nameSize, text, reward, hp } = spec;
      const half = height / 2;
      // 이름은 윗변 제목표(높이 52) 아래에서 시작하고, 줄끼리 순서대로 내려간다.
      expect(text.nameY - nameSize / 2, kind).toBeGreaterThan(-half + 26);
      expect(text.levelY, kind).toBeGreaterThan(text.nameY + nameSize / 2);
      expect(text.attemptsY, kind).toBeGreaterThan(text.levelY + 14);
      // 보상 액자는 도전 줄 아래, 체력 이름표 위에 선다.
      expect(reward.y - reward.size / 2, kind).toBeGreaterThan(text.attemptsY + 14);
      expect(reward.y + reward.size / 2, kind).toBeLessThan(half - hp.labelUp - 12);
      expect(half - hp.labelUp + 12, kind).toBeLessThan(half - hp.up - hp.height / 2);
      // 정산 버튼은 액자와 겹치지 않고 얼굴이 서기 시작하는 곳 앞에서 끝난다.
      const left = -RAID_LIST.width / 2 + RAID_LIST.slant / 2 + RAID_LIST.padding;
      expect(RAID_LIST.settle.fromFrame, kind).toBeGreaterThan(reward.size + RAID_LIST.rewardText.gap + 150);
      expect(left + RAID_LIST.settle.fromFrame + RAID_LIST.settle.width, kind).toBeLessThan(-RAID_LIST.width / 2 + RAID_LIST.width * (RAID_LIST.art.from + RAID_LIST.art.fade));
    }
  });

  it("월드 폭주가 소환 레이드보다 두껍게 선다", () => {
    expect(RAID_LIST.kinds.world.height).toBeGreaterThan(RAID_LIST.kinds.summon.height);
  });

  it("층을 쌓으면 첫 층의 제목표와 테두리가 창 안에 서고 층끼리 겹치지 않는다", () => {
    const kinds = ["world", "summon", "summon"] as const;
    const { centers, height } = raidLayerStack(kinds);
    const first = centers[0]! - RAID_LIST.kinds.world.height / 2;
    expect(first - RAID_LIST.worldRing - 26).toBeGreaterThanOrEqual(RAID_LIST.viewport.top);
    for (let index = 1; index < kinds.length; index += 1) {
      const prevBottom = centers[index - 1]! + RAID_LIST.kinds[kinds[index - 1]!].height / 2 + RAID_LIST.worldRing;
      const top = centers[index]! - RAID_LIST.kinds[kinds[index]!].height / 2 - 26;
      expect(top).toBeGreaterThan(prevBottom);
    }
    expect(height).toBeGreaterThan(centers.at(-1)! - RAID_LIST.viewport.top);
  });

  it("탭은 목록 바로 밑에 붙고 소환 줄은 그 아래에서 뒤로가기를 침범하지 않는다", () => {
    const { tabs, summon, tickets } = RAID_LIST_CHROME;
    // 켜진 탭이 솟은 윗변(`CATEGORY_TAB.lift` 10)이 곧 목록의 밑변이다. 프리팹은 Phaser를
    // 읽으므로 여기서는 그 값을 적어 둔다.
    expect(tabs.y - tabs.height / 2 - 10).toBe(RAID_LIST.viewport.bottom);
    expect(summon.y - summon.height / 2).toBeGreaterThan(tabs.y + tabs.height / 2);
    expect(summon.y + summon.height / 2).toBeLessThan(BASE_HEIGHT);
    expect(raidSummonBackGap()).toBeGreaterThan(0);
    // 선택 소환이 왼쪽, 소환이 오른쪽이고 같은 크기다. 서로 겹치지 않고 화면 왼쪽 밖으로 나가지 않는다.
    expect(summon.select.width).toBe(summon.normal.width);
    expect(summon.select.centerX).toBeLessThan(summon.normal.centerX);
    expect(summon.select.centerX - summon.select.width / 2).toBeGreaterThan(0);
    expect(summon.select.centerX + summon.select.width / 2).toBeLessThan(summon.normal.centerX - summon.normal.width / 2);
    // 토벌권은 제목 줄에 서고 목록 창 위에서 끝난다.
    expect(tickets.y + tickets.size / 2).toBeLessThan(RAID_LIST.viewport.top);
    expect(tickets.right).toBeLessThanOrEqual(BASE_WIDTH);
  });

  it("난이도마다 제 색이 있고 서로 겹치지 않는다", () => {
    const keys = Object.keys(RAID_DIFFICULTY).sort();
    expect(Object.keys(RAID_DIFFICULTY_TONE).sort()).toEqual(keys);
    expect(new Set(Object.values(RAID_DIFFICULTY_TONE)).size).toBe(keys.length);
    // 폭주는 남은 체력 줄과 같은 붉은빛이다.
    expect(RAID_DIFFICULTY_TONE.rampage).toBe(0xd2463c);
  });

  it("소환자 이름은 층 윗변 위, 다음 층 사이의 틈 안에 선다", () => {
    // 층 사이 틈(gap)보다 높이 올라가면 윗층의 체력 줄을 덮는다.
    expect(RAID_LAYER_OWNER.up + RAID_LAYER_OWNER.size / 2).toBeLessThan(RAID_LIST.gap);
  });

  it("소환 연출은 어려운 판일수록 오래 모이고 세게 터진다", () => {
    const charge = RAID_SUMMON_DIFFICULTIES.map((difficulty) => RAID_SUMMON_INTENSITY[difficulty].charge);
    const shake = RAID_SUMMON_DIFFICULTIES.map((difficulty) => RAID_SUMMON_INTENSITY[difficulty].shake);
    expect([...charge].sort((a, b) => a - b)).toEqual(charge);
    expect([...shake].sort((a, b) => a - b)).toEqual(shake);
    // 기다림이 되지 않도록 1초 안에 터진다.
    expect(Math.max(...charge)).toBeLessThanOrEqual(1000);
  });

  it("소환 연출의 얼굴·이름·난이도 줄이 겹치지 않고 밑동 안내 위에서 끝난다", () => {
    const { centerY, face, nameY, tagY } = RAID_SUMMON_STAGE;
    expect(nameY - 33).toBeGreaterThan(centerY + face / 2);
    expect(tagY - 16).toBeGreaterThan(nameY + 33);
    expect(tagY + 16).toBeLessThan(BASE_HEIGHT - 130 - 20);
  });

  it("보스를 고르는 창의 높이는 층 수에서 거꾸로 구한다", () => {
    expect(raidBossPickHeight(1)).toBe(RAID_BOSS_PICK.top + RAID_BOSS_PICK.height + RAID_BOSS_PICK.bottom);
    expect(raidBossPickHeight(2) - raidBossPickHeight(1)).toBe(RAID_BOSS_PICK.height + RAID_BOSS_PICK.gap);
    expect(raidPickHeight(RAID_DIFFICULTY_PICK, 3)).toBe(RAID_DIFFICULTY_PICK.top + 3 * RAID_DIFFICULTY_PICK.height + 2 * RAID_DIFFICULTY_PICK.gap + RAID_DIFFICULTY_PICK.bottom);
  });

  it.each([["보스", RAID_BOSS_PICK], ["난이도", RAID_DIFFICULTY_PICK]] as const)("%s 층 사이 틈에 다음 층의 제목표가 든다", (_name, spec) => {
    // 제목표(높이 52)의 윗절반이 윗층의 밑변을 넘지 않아야 한다 — 목록의 층 사이와 같은 규칙이다.
    expect(spec.gap).toBeGreaterThanOrEqual(RAID_LIST.gap);
  });

  it("보스 층의 이름·뱃지·레벨 줄이 판 안에서 겹치지 않는다", () => {
    const { height, nameY, nameSize, badgeY, badge, levelsY } = RAID_BOSS_PICK;
    expect(nameY - nameSize / 2).toBeGreaterThan(-height / 2);
    expect(badgeY - badge.element / 2).toBeGreaterThan(nameY + nameSize / 2 - 8);
    expect(levelsY - 14).toBeGreaterThan(badgeY + badge.element / 2);
    expect(levelsY + 14).toBeLessThan(height / 2);
  });

  it("난이도 층의 이름·레벨·보상 줄이 판 안에서 겹치지 않는다", () => {
    const { height, nameY, nameSize, levelY, reward } = RAID_DIFFICULTY_PICK;
    expect(nameY - nameSize / 2).toBeGreaterThan(-height / 2);
    expect(levelY - 14).toBeGreaterThan(nameY + nameSize / 2 - 8);
    expect(reward.y - reward.size / 2).toBeGreaterThan(levelY + 14);
    expect(reward.y + reward.size / 2).toBeLessThan(height / 2);
  });
});
