import { describe, expect, it } from "vitest";
import { ENEMY_INFO, enemyInfoPanelCenterY, enemyInfoSkillColumns, insideEnemyInfoBody } from "../../src/ui/enemyInfoLayout";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { placedEnemyIndex } from "../../src/data/placedEnemies";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";

describe("적 정보 팝업 배치", () => {
  it("은 화면을 다 덮지 않는 출격 선택판 크기다", () => {
    // 읽을 것이 절반뿐인 판이라 넓게 펼치면 빈자리가 먼저 읽힌다.
    expect(ENEMY_INFO.width).toBeLessThan(BASE_WIDTH);
    expect(ENEMY_INFO.height).toBeLessThan(BASE_HEIGHT * 0.7);
  });

  it("은 스킬 액자를 정보창처럼 왼쪽 아래에서 같은 간격으로 잇는다", () => {
    const columns = enemyInfoSkillColumns();
    expect(columns).toHaveLength(3);
    expect(columns[0]).toBe(ENEMY_INFO.skills.x);
    // 액자가 서로 겹치지 않는다.
    expect(ENEMY_INFO.skills.step).toBeGreaterThan(ENEMY_INFO.skills.size);
    // 스킬 줄과 오른쪽 아래 SD가 서로 침범하지 않는다.
    expect(columns[2] + ENEMY_INFO.skills.size / 2).toBeLessThan(ENEMY_INFO.figure.x - 96);
  });

  /**
   * 관찰 일지 입구.
   *
   * 적 개체도 개체번호·프로젝트·발굴지·소속 스쿼드를 제 정의에 온전히 갖고 있는데, 그것을
   * 여는 문이 아군 정보창에만 있어 화면 어디에서도 읽을 수 없었다. 자리는 원화 돋보기와 같은
   * 기둥이고, 둘이 겹치지도 이름 블록·스킬 줄을 침범하지도 않아야 한다.
   */
  it("은 원화 돋보기 위 같은 기둥에 관찰 일지 입구를 둔다", () => {
    const { journalButton, portraitMagnifier, numberY, skills } = ENEMY_INFO;
    const size = 76;
    // 같은 x에 세로로 붙어 "더 들여다보는 조작"이 한 덩어리로 읽힌다. 순서는 아군 정보창과 같이
    // 일지가 위, 돋보기가 아래다.
    expect(journalButton.x).toBe(portraitMagnifier.x);
    expect(journalButton.y).toBeLessThan(portraitMagnifier.y);
    // 두 조작이 서로 겹치지 않는다.
    expect(portraitMagnifier.y - journalButton.y).toBeGreaterThan(size);
    // 위로는 개체번호 줄을, 아래로는 스킬 액자 줄을 침범하지 않는다.
    expect(journalButton.y - size / 2).toBeGreaterThan(numberY);
    expect(portraitMagnifier.y + size / 2).toBeLessThan(skills.y - skills.size / 2);
    expect(insideEnemyInfoBody({ x: journalButton.x, y: journalButton.y, width: size, height: size })).toBe(true);
  });

  it("은 레벨 칸의 제목표를 이름·뱃지 줄 아래에 둔다", () => {
    // 이름이 긴 개체는 뱃지가 오른쪽 기둥 위까지 밀려 `/레벨` 제목표가 속성·직군을 덮었다.
    const { nameY, badge, levelPanel, nameRight, gradeRow, statPanel, figure } = ENEMY_INFO;
    const titleHalf = Math.round(34 * 1.52) / 2;
    expect(levelPanel.top - 4 - titleHalf).toBeGreaterThan(nameY + badge.element / 2);
    // 이름과 뱃지가 끝나는 선은 돌파 등급 표식 앞이다.
    expect(nameRight).toBeLessThan(gradeRow.x - gradeRow.size / 2);
    // 능력치 칸을 내린 만큼 SD의 머리 위에 걸리지 않는다.
    expect(statPanel.top + statPanel.height).toBeLessThan(figure.groundY - figure.height);
  });

  it("은 오른쪽 칸·스킬 줄이 몸판의 깎인 모서리 안에 든다", () => {
    const { column, levelPanel, statPanel, radar, skills } = ENEMY_INFO;
    // 정보창과 같은 기둥이라 두 칸이 같은 x·같은 폭으로 서고, 둘 다 판 안에 든다.
    for (const panel of [levelPanel, statPanel]) {
      expect(insideEnemyInfoBody({ x: column.x, y: enemyInfoPanelCenterY(panel), width: column.width, height: panel.height })).toBe(true);
    }
    // 칸끼리 겹치지 않는다 — 제목표가 앉을 자리도 사이에 남는다.
    expect(statPanel.top).toBeGreaterThan(levelPanel.top + levelPanel.height);
    // 오각형은 축 이름까지 능력치 칸 안에 든다.
    expect(Math.abs(radar.offsetY) + radar.radius + 40).toBeLessThanOrEqual(statPanel.height / 2);
    const span = enemyInfoSkillColumns();
    const skillCenter = (span[0] + span[span.length - 1]) / 2;
    expect(insideEnemyInfoBody({ x: skillCenter, y: skills.y, width: span[span.length - 1] - span[0] + skills.size, height: skills.size })).toBe(true);
    // 스킬 줄과 SD 받침이 판 밑변 안에 남는다.
    expect(skills.y + skills.size / 2).toBeLessThanOrEqual(ENEMY_INFO.height / 2);
    expect(ENEMY_INFO.figure.groundY + 50).toBeLessThanOrEqual(ENEMY_INFO.height / 2);
  });

  it("은 스테이지가 적어 둔 레벨·돌파·야성을 그대로 들고 온다", () => {
    // 창이 레벨을 다시 되짚으면 2돌파 25레벨로 세워 둔 적이 1돌파 상한 20으로 읽힌다.
    const stage = getBattleStage("1-10");
    const enemies = getStageEnemies(stage);
    const placed = placedEnemyIndex({ mode: "stage" }, stage, enemies);
    const sorted = [...stage.enemies].sort((a, b) => a.formationSlot - b.formationSlot);
    sorted.forEach((enemy, index) => {
      const snapshot = placed.get(`enemy-${index}`);
      expect(snapshot?.def).toBe(enemies[index]);
      expect(snapshot?.level).toBe(enemy.level);
      expect(snapshot?.breakthrough).toBe(enemy.breakthrough);
    });
  });

  it("은 원정 노드의 적에게 그 층의 레벨을 준다", () => {
    const stage = getBattleStage("1-1");
    const enemies = getStageEnemies(stage);
    const placed = placedEnemyIndex({ mode: "expedition", nodeType: "elite", floor: 7 } as never, stage, enemies);
    // 층 7의 레벨(14) 그대로다 — 노드 종류는 레벨을 바꾸지 않고, 스테이지의 레벨 표를 섞어 읽지도 않는다.
    expect(placed.get("enemy-0")?.level).toBe(14);
    expect(placed.get("enemy-0")?.breakthrough).toBe(0);
  });
});
