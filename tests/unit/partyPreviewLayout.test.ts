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
} from "../../src/ui/partyPreviewLayout";

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
});
