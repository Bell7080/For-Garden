import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { SETTINGS_HEAD, SETTINGS_ROW, SETTINGS_SECTION, SETTINGS_TEXT, settingsSectionHeight, settingsTabSlot } from "../../src/ui/settingsLayout";
import { SETTINGS_TOGGLE, settingsTrackCenterX } from "../../src/ui/settingsToggleLayout";

const TAB_COUNT = 5;

describe("환경설정 배치", () => {
  it("의 탭은 화면 폭을 고르게 나눠 갖는다", () => {
    const slots = Array.from({ length: TAB_COUNT }, (_, index) => settingsTabSlot(index, TAB_COUNT, BASE_WIDTH));
    const widths = new Set(slots.map((slot) => slot.width));
    expect(widths.size, "칸마다 폭이 다르면 그 칸이 덜 중요한 것처럼 읽힌다").toBe(1);
    // 줄 전체가 화면 안에 들고, 좌우 여백이 같다.
    expect(slots[0].x - slots[0].width / 2).toBeGreaterThanOrEqual(SETTINGS_HEAD.tabMargin);
    const last = slots[TAB_COUNT - 1];
    expect(BASE_WIDTH - (last.x + last.width / 2)).toBeGreaterThanOrEqual(SETTINGS_HEAD.tabMargin);
  });

  it("의 탭은 서로 겹치지 않고 사이에 틈을 남긴다", () => {
    const slots = Array.from({ length: TAB_COUNT }, (_, index) => settingsTabSlot(index, TAB_COUNT, BASE_WIDTH));
    for (let index = 1; index < slots.length; index += 1) {
      const gap = (slots[index].x - slots[index].width / 2) - (slots[index - 1].x + slots[index - 1].width / 2);
      expect(gap, `${index}번 탭`).toBeCloseTo(SETTINGS_HEAD.tabGap, 5);
    }
  });

  it("의 탭 줄은 88px 터치 영역을 넘기고 제목과 내용 사이에 선다", () => {
    expect(SETTINGS_HEAD.tabHeight).toBeGreaterThanOrEqual(88);
    expect(SETTINGS_HEAD.tabY - SETTINGS_HEAD.tabHeight / 2).toBeGreaterThan(SETTINGS_HEAD.titleY);
    // 켜진 탭이 내용 쪽으로 솟으므로, 그 아래 내용이 탭 밑변을 침범하면 안 된다.
    expect(SETTINGS_HEAD.contentTop).toBeGreaterThan(SETTINGS_HEAD.tabY + SETTINGS_HEAD.tabHeight / 2);
  });

  it("의 섹션 판 높이는 쌓인 내용에서 나온다", () => {
    // 손으로 적어 두면 줄 하나를 더하거나 언어가 바뀔 때마다 마지막 줄이 판 밖으로 나간다.
    const top = 18;
    const oneRow = settingsSectionHeight(top, top + SETTINGS_SECTION.headRoom + SETTINGS_ROW.step);
    const twoRows = settingsSectionHeight(top, top + SETTINGS_SECTION.headRoom + SETTINGS_ROW.step * 2);
    expect(twoRows - oneRow).toBe(SETTINGS_ROW.step);
  });

  it("의 섹션 판은 마지막 줄을 자르지 않되 빈 자리를 남기지도 않는다", () => {
    const top = 0;
    const lastRowCenter = SETTINGS_SECTION.headRoom + SETTINGS_ROW.step * 3;
    // `bottom`은 실제로 그린 것의 아래 끝이다 — 줄은 중심 기준이라 입력 영역의 절반이 더 내려간다.
    const height = settingsSectionHeight(top, lastRowCenter + SETTINGS_ROW.hitHeight / 2);
    expect(height).toBeGreaterThanOrEqual(lastRowCenter + SETTINGS_ROW.hitHeight / 2);
    // 판 밑에 한 줄이 통째로 들어갈 만큼 비어 있으면 그 자리가 덜 그려진 것으로 보인다.
    expect(height - (lastRowCenter + SETTINGS_ROW.hitHeight / 2)).toBeLessThan(SETTINGS_ROW.step);
  });

  it("의 섹션 판은 줄이 없어도 제목이 설 자리를 남긴다", () => {
    expect(settingsSectionHeight(40, 40)).toBeGreaterThanOrEqual(SETTINGS_SECTION.headRoom);
  });

  it("의 섹션 판은 줄의 좌우를 품는다", () => {
    const left = (BASE_WIDTH - SETTINGS_SECTION.width) / 2;
    expect(left).toBeLessThanOrEqual(SETTINGS_ROW.left);
    expect(BASE_WIDTH - left).toBeGreaterThanOrEqual(SETTINGS_ROW.right);
  });

  it("의 줄은 스위치를 품을 만큼 넓고 손가락이 닿을 만큼 높다", () => {
    // 스위치의 오른쪽 변은 줄 안쪽에 서야 한다 — 밖으로 나가면 구분선을 넘는다.
    expect(SETTINGS_ROW.left + SETTINGS_TOGGLE.right).toBeLessThanOrEqual(SETTINGS_ROW.right);
    expect(settingsTrackCenterX()).toBeGreaterThan(0);
    expect(SETTINGS_ROW.hitHeight).toBeGreaterThanOrEqual(88);
    // 줄 간격이 입력 영역보다 좁으면 이웃한 두 줄의 손이 겹친다.
    expect(SETTINGS_ROW.step).toBeGreaterThan(SETTINGS_ROW.hitHeight);
  });

  it("의 글자는 세로 모바일에서 읽을 만큼 크고 위계를 지킨다", () => {
    // 이름표(제목)가 가장 크고, 읽기만 하는 문단이 가장 작다.
    expect(SETTINGS_HEAD.titleSize).toBeGreaterThan(SETTINGS_TEXT.section);
    expect(SETTINGS_TEXT.section).toBeGreaterThanOrEqual(SETTINGS_TEXT.label);
    expect(SETTINGS_TEXT.note).toBeLessThan(SETTINGS_TEXT.label);
    // 옛 28px 본문은 손에 쥔 화면에서 작았다. 고르기 전에 읽는 글이라 목록보다 커야 한다.
    expect(SETTINGS_TEXT.label).toBeGreaterThan(28);
    // 스위치 안의 `ON`/`OFF`는 홈 높이 안에 들어야 한다.
    expect(SETTINGS_TEXT.state).toBeLessThan(SETTINGS_TOGGLE.trackHeight);
  });
});
