import { describe, expect, it } from "vitest";
import { BASE_HEIGHT } from "../../src/config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";
import {
  INTERACTION_CITY_ACTION,
  INTERACTION_CITY_BRIEF_ART,
  INTERACTION_CITY_BRIEF_ROWS,
  INTERACTION_CITY_BRIEF_TEXT,
  INTERACTION_CITY_LOWER,
  INTERACTION_CITY_PANEL,
  INTERACTION_CITY_REWARD_FRAME,
} from "../../src/ui/interactionCityLayout";

const ROWS = INTERACTION_CITY_BRIEF_ROWS;
const FRAME = INTERACTION_CITY_REWARD_FRAME;
/** 줄 하나가 실제로 차지하는 세로. 글자는 가운데 정렬이라 위아래로 절반씩 퍼진다. */
const halfLine = (size: number): number => size / 2;

describe("도시 쪽지의 안내 줄", () => {
  it("은 위에서 아래로 구분선 · 소요 시간 · 돌아오는 것 차례다", () => {
    expect(ROWS.divider).toBeLessThan(ROWS.duration);
    expect(ROWS.duration).toBeLessThan(ROWS.rewardLabel);
    expect(ROWS.rewardLabel).toBeLessThan(ROWS.rewardFrames);
  });

  it("은 설명과 구분선이 겹치지 않는다 — 설명이 두 줄로 늘어나도 남는다", () => {
    const descriptionTop = INTERACTION_CITY_LOWER.top + INTERACTION_CITY_BRIEF_ART.height + INTERACTION_CITY_BRIEF_ART.descriptionGap;
    const descriptionBottom = descriptionTop + INTERACTION_CITY_BRIEF_ART.descriptionSize * 2 * 1.35;
    expect(INTERACTION_CITY_LOWER.bottom + ROWS.divider).toBeGreaterThan(descriptionBottom);
  });

  it("은 소요 시간과 돌아오는 것 이름표가 한 뼘 떨어져 선다", () => {
    // 둘이 같은 줄에 겹쳐 두 문장이 서로를 갉아먹던 자리다. 닿지 않는 것만으로는 모자라 —
    // 글자 한 줄만큼은 벌어져야 두 정보로 읽힌다.
    const durationBottom = ROWS.duration + halfLine(INTERACTION_CITY_BRIEF_TEXT.duration);
    const labelTop = ROWS.rewardLabel - halfLine(INTERACTION_CITY_BRIEF_TEXT.rewardLabel);
    expect(labelTop - durationBottom).toBeGreaterThanOrEqual(INTERACTION_CITY_BRIEF_TEXT.rewardLabel / 2);
  });

  it("은 이름표가 액자에 깔리지 않는다", () => {
    // 액자가 이름표 위로 올라와 "돌아오는 것"의 아랫부분을 덮던 자리다.
    const labelBottom = ROWS.rewardLabel + halfLine(INTERACTION_CITY_BRIEF_TEXT.rewardLabel);
    expect(ROWS.rewardFrames - FRAME.size / 2 - labelBottom).toBeGreaterThanOrEqual(INTERACTION_CITY_BRIEF_TEXT.rewardLabel / 2);
  });

  it("은 액자 줄이 주요 조작 위에서 끝난다", () => {
    // 아래 칸 밑변에서 재는 값이라 판 좌표로 되돌려 조작 버튼의 윗변과 견준다.
    const framesBottom = INTERACTION_CITY_LOWER.bottom + ROWS.rewardFrames + FRAME.size / 2;
    expect(framesBottom).toBeLessThan(INTERACTION_CITY_ACTION.y - INTERACTION_CITY_ACTION.height / 2);
  });

  it("은 액자가 엄지로 하나만 눌릴 만큼 크다", () => {
    // 눌러서 재화 안내를 여는 자리이기도 하다. 작으면 옆 칸까지 함께 눌린다.
    expect(FRAME.size).toBeGreaterThanOrEqual(96);
    expect(FRAME.gap).toBeGreaterThan(0);
  });

  it("은 판이 화면 공용 뒤로가기 자리를 덮지 않는다", () => {
    // 뒤로가기는 판 안이 아니라 **화면의 우하단 공용 슬롯**에 선다. 판이 그 자리까지 내려오면
    // 판 위에 얹힌 버튼이 되어 "판 밖으로 물러난다"는 뜻이 사라진다.
    const bottom = BASE_HEIGHT / 2 + INTERACTION_CITY_PANEL.height / 2;
    expect(bottom).toBeLessThan(BACK_SLOT.y - BACK_BUTTON_SIZE / 2);
  });

  it("은 조작 줄이 판 안에 머문다", () => {
    // 닫는 손은 판 밖에 있으므로 조작 줄은 판 폭만 지키면 된다.
    const action = INTERACTION_CITY_ACTION;
    const half = INTERACTION_CITY_PANEL.width / 2;
    expect(action.primaryX + action.editingWidth / 2).toBeLessThan(half);
    expect(action.cancelX + action.cancelWidth / 2).toBeLessThan(half);
  });

  it("은 배치 중의 취소와 보내기가 서로 붙지 않는다", () => {
    const action = INTERACTION_CITY_ACTION;
    expect(action.primaryX - action.editingWidth / 2).toBeGreaterThan(action.cancelX + action.cancelWidth / 2);
  });

  it("은 조작 줄이 쪽지 밑변 안에 머문다", () => {
    const action = INTERACTION_CITY_ACTION;
    expect(action.y + action.height / 2).toBeLessThan(INTERACTION_CITY_PANEL.height / 2);
    expect(action.cancelX - action.cancelWidth / 2).toBeGreaterThan(-INTERACTION_CITY_PANEL.width / 2);
  });

  it("은 두 품목이 아래 칸 안에 나란히 선다", () => {
    const width = 2 * FRAME.size + FRAME.gap;
    expect(width).toBeLessThan(INTERACTION_CITY_LOWER.right - INTERACTION_CITY_LOWER.left - 20);
  });

  it("은 쪽지가 화면 안전 높이를 넘지 않는다", () => {
    expect(INTERACTION_CITY_PANEL.height).toBeLessThanOrEqual(1920 - 200);
  });
});
