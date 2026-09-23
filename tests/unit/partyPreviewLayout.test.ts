import { describe, expect, it } from "vitest";
import {
  PARTY_ALLY_PLATE,
  PARTY_POWER_PLATE,
  PARTY_PREVIEW,
  PARTY_PREVIEW_COLUMNS,
  partyAllyGroundOffset,
  partyAllyPlateBox,
  partyAllySlotBox,
  partyPowerPlateBounds,
  partyPreviewEnemyColumns,
  partyPreviewEnemyScale,
  PARTY_PREVIEW_CROWD,
} from "../../src/ui/partyPreviewLayout";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";

/** 아군 SD의 정수리가 서는 줄. 밑판 위로 아무것도 내려오면 안 되는 경계다. */
const ALLY_HEAD_TOP = PARTY_PREVIEW.allyRow - PARTY_PREVIEW.height;
/** 적 이름줄의 대략적인 아랫변. 전투력 판이 여기까지 올라오면 적 이름을 덮는다. */
const ENEMY_NAMEPLATE_BOTTOM = PARTY_PREVIEW.enemyRow + 26 + 22;

describe("스토리 편성 미리보기 배치", () => {
  it("은 전투력 줄을 대치선 위에 세우고 아군 머리에 얹지 않는다", () => {
    const bounds = partyPowerPlateBounds();
    expect((bounds.top + bounds.bottom) / 2).toBe(PARTY_PREVIEW.frontLine);
    // 판 밑변이 아군 정수리보다 위에 있어야 SD 머리와 겹치지 않는다.
    expect(bounds.bottom).toBeLessThan(ALLY_HEAD_TOP);
    // 위로는 적 이름줄을 덮지 않는다.
    expect(bounds.top).toBeGreaterThan(ENEMY_NAMEPLATE_BOTTOM);
  });

  it("은 전투력 판이 아군 칸 밑판과 겹치지 않게 띄운다", () => {
    expect(partyPowerPlateBounds().bottom).toBeLessThan(PARTY_ALLY_PLATE.top);
  });

  it("은 아군 밑판이 SD의 머리 끝과 발끝을 모두 품게 한다", () => {
    const plate = partyAllyPlateBox(0);
    const top = plate.y - plate.height / 2;
    const bottom = plate.y + plate.height / 2;
    expect(top).toBeLessThan(ALLY_HEAD_TOP);
    expect(bottom).toBeGreaterThan(PARTY_PREVIEW.allyRow);
  });

  it("은 발밑 그림자가 SD가 실제로 딛는 줄에 앉게 한다", () => {
    expect(partyAllyPlateBox(1).y + partyAllyGroundOffset()).toBe(PARTY_PREVIEW.allyRow);
  });

  it("은 세 칸이 서로 겹치지 않고 입력면과 밑판이 같은 중심을 쓰게 한다", () => {
    PARTY_PREVIEW_COLUMNS.forEach((x, slot) => {
      expect(partyAllySlotBox(slot).x).toBe(x);
      expect(partyAllyPlateBox(slot).x).toBe(x);
    });
    const gap = PARTY_PREVIEW_COLUMNS[1] - PARTY_PREVIEW_COLUMNS[0];
    expect(gap).toBeGreaterThan(PARTY_PREVIEW.slotWidth);
  });

  it("은 전투력 판이 화면 밖으로 나가지 않게 한다", () => {
    const bounds = partyPowerPlateBounds();
    expect(bounds.left).toBeGreaterThan(0);
    expect(bounds.right).toBeLessThan(1080);
    expect(PARTY_POWER_PLATE.width).toBeGreaterThan(400);
  });

  /*
   * **정예 하나는 가운데에 선다.** 앞에서부터 채우면 홀로 선 정예가 왼쪽 끝에 서고 오른쪽 두
   * 칸이 통째로 비어, 그 관문이 "정예 하나"가 아니라 "편성을 빠뜨린 셋"으로 읽힌다.
   */
  it("은 적이 몇이냐에 따라 자리를 가운데로 모은다", () => {
    expect(partyPreviewEnemyColumns(3)).toEqual([...PARTY_PREVIEW_COLUMNS]);
    expect(partyPreviewEnemyColumns(1)).toEqual([PARTY_PREVIEW_COLUMNS[1]]);
    // 둘이면 가운데를 사이에 두고 마주 본다 — 어느 쪽으로도 쏠리지 않는다.
    const pair = partyPreviewEnemyColumns(2);
    expect(pair).toHaveLength(2);
    expect((pair[0] + pair[1]) / 2).toBe(PARTY_PREVIEW_COLUMNS[1]);
  });
});

describe("콘텐츠 편성 미리보기", () => {
  it("물량형 대표 얼굴 다섯은 화면 안에 고르게 서고 서로 겹치지 않는다", () => {
    const columns = partyPreviewEnemyColumns(5);
    expect(columns).toHaveLength(5);
    expect(columns[0]).toBe(PARTY_PREVIEW_CROWD.left);
    expect(columns[4]).toBe(PARTY_PREVIEW_CROWD.right);
    const gap = columns[1] - columns[0];
    for (let index = 1; index < columns.length; index += 1) expect(columns[index] - columns[index - 1]).toBeCloseTo(gap, 6);
    // 한 얼굴 몫(좁힌 입력면 170)이 옆 얼굴과 겹치지 않는다.
    expect(gap).toBeGreaterThanOrEqual(170);
    expect(columns[0] - 85).toBeGreaterThanOrEqual(0);
    expect(columns[4] + 85).toBeLessThanOrEqual(1080);
    // 셋 이하는 예전 규칙 그대로다.
    expect(partyPreviewEnemyColumns(3)).toEqual(PARTY_PREVIEW_COLUMNS);
    expect(partyPreviewEnemyColumns(1)).toEqual([PARTY_PREVIEW_COLUMNS[1]]);
  });

  it("한꺼번에 몰려오는 수는 적 이름줄과 전투력 판 사이에 선다", () => {
    const bounds = partyPowerPlateBounds();
    expect(PARTY_PREVIEW.hordeCountY - 15).toBeGreaterThan(ENEMY_NAMEPLATE_BOTTOM);
    expect(PARTY_PREVIEW.hordeCountY + 15).toBeLessThan(bounds.top);
  });

  it("레이드 보스는 상한까지만 커져 머리가 화면 제목을 뚫지 않는다", () => {
    const scale = partyPreviewEnemyScale(ENCOUNTER_ROLE.endless.bodyScale);
    expect(scale).toBe(PARTY_PREVIEW.maxEnemyScale);
    // 제목(y 70, 46px)의 밑변 아래에 머리 위 표식(28px)까지 들어간다.
    expect(PARTY_PREVIEW.enemyRow - PARTY_PREVIEW.height * scale - 6 - 28).toBeGreaterThan(70 + 46);
    // 정예는 상한보다 작아 그대로 선다.
    expect(partyPreviewEnemyScale(ENCOUNTER_ROLE.elite.bodyScale)).toBe(ENCOUNTER_ROLE.elite.bodyScale);
  });
});
