import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT, fitsInsidePopupBevel, POPUP_TITLE_SIZE, popupTitleBand } from "../../src/ui/popupGeometry";
import {
  RUNE_CRAFT_MARKS,
  RUNE_CRAFT_PANEL,
  RUNE_NOTE_PANEL,
  runeCraftLayout,
  runeNoteLayout,
} from "../../src/ui/runeCraftLayout";
import { RUNE_SUB_STAT_COUNTS, type RuneRarity } from "../../src/core/runes";

/** 실제로 열리는 네 등급의 줄 구성. 주 옵션은 어느 등급이나 둘이다. */
const RARITIES = Object.keys(RUNE_SUB_STAT_COUNTS) as RuneRarity[];
const CASES = RARITIES.map((rarity) => ({ rarity, mainCount: 2, subCount: RUNE_SUB_STAT_COUNTS[rarity] }));

describe("세공 판 배치표", () => {
  it("등급마다 줄 수가 달라도 판이 화면 안에 든다", () => {
    for (const { rarity, mainCount, subCount } of CASES) {
      const layout = runeCraftLayout({ mainCount, subCount });
      const top = RUNE_CRAFT_PANEL.centerY - layout.height / 2;
      const bottom = RUNE_CRAFT_PANEL.centerY + layout.height / 2;
      expect(top, rarity).toBeGreaterThanOrEqual(24);
      expect(bottom, rarity).toBeLessThanOrEqual(BASE_HEIGHT - 24);
    }
    expect(RUNE_CRAFT_PANEL.width).toBeLessThanOrEqual(BASE_WIDTH - 80);
  });

  it("보조 옵션이 많을수록 판이 그만큼만 길어진다", () => {
    // 높이를 손으로 박아 두면 고급 룬은 아래가 통째로 비고 전설 룬은 마지막 줄이 판을 넘는다.
    const heights = CASES.map(({ mainCount, subCount }) => runeCraftLayout({ mainCount, subCount }).height);
    for (let index = 1; index < heights.length; index += 1) expect(heights[index]).toBeGreaterThan(heights[index - 1]);
  });

  it("마지막 옵션 줄과 구분선 사이가 벌어져 있다", () => {
    for (const { rarity, mainCount, subCount } of CASES) {
      const layout = runeCraftLayout({ mainCount, subCount });
      const lastRow = layout.subRows.at(-1);
      const rowBottom = lastRow === undefined
        ? layout.emptySubY + RUNE_CRAFT_PANEL.emptySubHeight
        : lastRow + RUNE_CRAFT_PANEL.subRow.height / 2;
      expect(layout.hairlineY - rowBottom, rarity).toBeGreaterThanOrEqual(40);
    }
  });

  it("줄끼리 겹치지 않는다", () => {
    const { mainRows, subRows } = runeCraftLayout({ mainCount: 2, subCount: 3 });
    const spans = [
      ...mainRows.map((y) => ({ top: y - RUNE_CRAFT_PANEL.mainRow.height / 2, bottom: y + RUNE_CRAFT_PANEL.mainRow.height / 2 })),
      ...subRows.map((y) => ({ top: y - RUNE_CRAFT_PANEL.subRow.height / 2, bottom: y + RUNE_CRAFT_PANEL.subRow.height / 2 })),
    ];
    for (let index = 1; index < spans.length; index += 1) expect(spans[index].top).toBeGreaterThan(spans[index - 1].bottom);
  });

  it("확률 줄이 이름줄 아래, 첫 옵션 줄 위에 선다", () => {
    const layout = runeCraftLayout({ mainCount: 2, subCount: 3 });
    const panel = RUNE_CRAFT_PANEL;
    expect(panel.chanceLabelY).toBeGreaterThan(panel.equippedY);
    expect(panel.chanceBarY).toBeGreaterThan(panel.chanceLabelY);
    expect(panel.mainLabelY).toBeGreaterThan(panel.chanceBarY);
    expect(layout.mainRows[0] - panel.mainRow.height / 2).toBeGreaterThan(panel.mainLabelY);
  });

  it("버튼과 결과 문구가 판 안에 든다", () => {
    for (const { rarity, mainCount, subCount } of CASES) {
      const layout = runeCraftLayout({ mainCount, subCount });
      expect(layout.noticeY, rarity).toBeGreaterThan(layout.hairlineY);
      expect(layout.buttonY, rarity).toBeGreaterThan(layout.noticeY);
      expect(layout.buttonY + RUNE_CRAFT_PANEL.button.height / 2, rarity).toBeLessThanOrEqual(layout.height - 24);
    }
    expect(RUNE_CRAFT_PANEL.button.width).toBeLessThanOrEqual(RUNE_CRAFT_PANEL.width - RUNE_CRAFT_PANEL.rowInset);
  });

  it("세공 표식 세 칸과 각인 자리가 줄 안에 든다", () => {
    const half = (RUNE_CRAFT_PANEL.width - RUNE_CRAFT_PANEL.rowInset) / 2;
    const lastStep = RUNE_CRAFT_MARKS.firstX + 2 * RUNE_CRAFT_MARKS.step;
    // 각인은 세 칸 **뒤**에 서고, 두 표식이 겹치지 않는다.
    expect(RUNE_CRAFT_MARKS.engraveX).toBeGreaterThan(lastStep + RUNE_CRAFT_MARKS.mainOuter + RUNE_CRAFT_MARKS.engraveOuter);
    expect(RUNE_CRAFT_MARKS.engraveX + RUNE_CRAFT_MARKS.engraveOuter).toBeLessThanOrEqual(half - RUNE_CRAFT_MARKS.edgeMargin);
    // 옵션 이름이 첫 표식을 밀지 않는다.
    expect(-half + RUNE_CRAFT_MARKS.labelWrap).toBeLessThan(RUNE_CRAFT_MARKS.firstX - RUNE_CRAFT_MARKS.mainOuter);
  });

  it("각인 표식은 세공 칸과 거의 같은 크기다", () => {
    // 키우면 그 칸 하나가 룬 전체보다 먼저 읽힌다. 완성은 크기가 아니라 빛이 말한다.
    expect(RUNE_CRAFT_MARKS.engraveOuter - RUNE_CRAFT_MARKS.mainOuter).toBeLessThanOrEqual(2);
    expect(RUNE_CRAFT_MARKS.subOuter).toBeLessThan(RUNE_CRAFT_MARKS.mainOuter);
  });
});

describe("룬 쪽지 배치표", () => {
  it("등급마다 옵션 줄이 달라도 판이 화면 안에 든다", () => {
    for (const { rarity, subCount } of CASES) {
      const layout = runeNoteLayout(2 + subCount);
      const top = RUNE_NOTE_PANEL.centerY - layout.height / 2;
      expect(top, rarity).toBeGreaterThanOrEqual(24);
      expect(RUNE_NOTE_PANEL.centerY + layout.height / 2, rarity).toBeLessThanOrEqual(BASE_HEIGHT - 24);
    }
  });

  it("옵션 줄이 구분선 아래에서 시작하고 진행 줄·버튼이 그 뒤에 선다", () => {
    const layout = runeNoteLayout(5);
    expect(layout.statRows[0]).toBeGreaterThan(RUNE_NOTE_PANEL.hairlineY);
    expect(layout.progressY).toBeGreaterThan((layout.statRows.at(-1) ?? 0) + RUNE_NOTE_PANEL.statStep / 2);
    expect(layout.buttonY).toBeGreaterThan(layout.progressY);
    expect(layout.buttonY + RUNE_NOTE_PANEL.buttonHeight / 2).toBeLessThanOrEqual(layout.height - 20);
  });

  it("표식 칩 줄이 액자와 겹치지 않는다", () => {
    const chip = RUNE_NOTE_PANEL.chip;
    expect(chip.y + chip.size / 2).toBeLessThan(RUNE_NOTE_PANEL.frame.y - RUNE_NOTE_PANEL.frame.size / 2);
    expect(chip.gap).toBeGreaterThan(chip.size);
  });

  it("쪽지가 예전 판보다 크다", () => {
    // 판이 커지고 오른쪽 위 X 대신 판 밖 뒤로가기를 쓰는 것이 이번 변경의 요점이다.
    expect(RUNE_NOTE_PANEL.width).toBeGreaterThan(448);
    expect(runeNoteLayout(5).height).toBeGreaterThan(336 + 56 + 5 * 40);
  });
});

describe("판 밖 우하단 뒤로가기", () => {
  it("두 판 모두 뒤로가기 자리를 덮지 않는다", () => {
    const reach = BACK_SLOT.y - BACK_BUTTON_SIZE / 2;
    const craft = runeCraftLayout({ mainCount: 2, subCount: 3 });
    expect(RUNE_CRAFT_PANEL.centerY + craft.height / 2).toBeLessThan(reach);
    const note = runeNoteLayout(5);
    expect(RUNE_NOTE_PANEL.centerY + note.height / 2).toBeLessThan(reach);
  });

  it("뒤로가기는 화면 안에 있다", () => {
    expect(BACK_SLOT.x + BACK_BUTTON_SIZE / 2).toBeLessThanOrEqual(BASE_WIDTH);
    expect(BACK_SLOT.y + BACK_BUTTON_SIZE / 2).toBeLessThanOrEqual(BASE_HEIGHT);
  });
});

describe("룬 판의 액자와 글자가 판 안에서 서로 비켜선다", () => {
  /** 두 판의 모든 등급 조합. 깎임은 판 높이에 따라 달라지므로 줄 수마다 다시 잰다. */
  const craftCases = CASES.map(({ rarity, mainCount, subCount }) => {
    const layout = runeCraftLayout({ mainCount, subCount });
    return { rarity, layout, panel: { width: RUNE_CRAFT_PANEL.width, height: layout.height } };
  });

  it("세공 판의 룬 액자가 깎인 모서리 안에 든다", () => {
    // 예전 자리(-378, 126)는 액자 윗변이 대각선을 45.6px 넘어 판 밖에 떠 있었다.
    const frame = RUNE_CRAFT_PANEL.frame;
    for (const { rarity, panel } of craftCases) {
      const box = { left: frame.x - frame.size / 2, top: frame.y - frame.size / 2 };
      expect(fitsInsidePopupBevel(panel, box, 8), rarity).toBe(true);
    }
  });

  it("세공 판의 이름줄이 액자를 침범하지 않는다", () => {
    // 예전 textX(-324)는 액자 오른쪽 변(-312)보다 왼쪽이라 글자가 조각 위에 겹쳐 찍혔다.
    const frame = RUNE_CRAFT_PANEL.frame;
    expect(RUNE_CRAFT_PANEL.textX).toBeGreaterThan(frame.x + frame.size / 2 + 12);
  });

  it("세공 판의 이름줄과 지갑 칸이 서로 떨어져 있다", () => {
    const panel = RUNE_CRAFT_PANEL;
    const nameRight = panel.textX + panel.nameWrap;
    const walletLeft = panel.wallet.x - panel.wallet.width / 2;
    expect(nameRight).toBeLessThan(walletLeft);
    // 지갑 칸도 판 오른쪽 변을 넘지 않는다(오른쪽 위는 깎이지 않으므로 직선이다).
    expect(panel.wallet.x + panel.wallet.width / 2).toBeLessThanOrEqual(panel.width / 2);
  });

  it("세공 판의 액자가 제목표 아래에서 시작한다", () => {
    // 제목표는 윗변에 걸터앉아 위아래로 제 높이의 절반씩 차지한다.
    const titleBand = popupTitleBand(POPUP_TITLE_SIZE.workboard);
    expect(RUNE_CRAFT_PANEL.frame.y - RUNE_CRAFT_PANEL.frame.size / 2).toBeGreaterThan(titleBand);
  });

  it("세공 판의 확률 줄이 액자 아래에서 시작한다", () => {
    const frameBottom = RUNE_CRAFT_PANEL.frame.y + RUNE_CRAFT_PANEL.frame.size / 2;
    expect(RUNE_CRAFT_PANEL.chanceLabelY).toBeGreaterThan(frameBottom);
  });

  it("쪽지의 액자와 표식 칩도 깎인 모서리 안에 든다", () => {
    for (const { rarity, subCount } of CASES) {
      const layout = runeNoteLayout(2 + subCount);
      const panel = { width: RUNE_NOTE_PANEL.width, height: layout.height };
      const frame = RUNE_NOTE_PANEL.frame;
      expect(fitsInsidePopupBevel(panel, { left: frame.x - frame.size / 2, top: frame.y - frame.size / 2 }, 8), rarity).toBe(true);
      const chip = RUNE_NOTE_PANEL.chip;
      expect(fitsInsidePopupBevel(panel, { left: chip.x - chip.size / 2, top: chip.y - chip.size / 2 }, 4), rarity).toBe(true);
    }
  });

  it("쪽지의 이름줄이 액자를 침범하지 않는다", () => {
    const frame = RUNE_NOTE_PANEL.frame;
    expect(RUNE_NOTE_PANEL.textX).toBeGreaterThan(frame.x + frame.size / 2 + 12);
  });
});
