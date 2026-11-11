import { describe, expect, it } from "vitest";
import { RELIC_RESET_POPUP, relicResetButtonXs, relicResetPopupSpots, relicResetWalletHeight } from "../../src/ui/relicResetPopupLayout";

describe("레벨 초기화 창 배치", () => {
  it("젬 줄이 들면 재화 판과 창이 한 줄만큼 길어진다", () => {
    const one = relicResetPopupSpots(1);
    const two = relicResetPopupSpots(2);
    expect(two.walletHeight - one.walletHeight).toBe(RELIC_RESET_POPUP.wallet.rowHeight);
    expect(two.height - one.height).toBe(RELIC_RESET_POPUP.wallet.rowHeight);
    expect(relicResetWalletHeight(2)).toBe(two.walletHeight);
  });

  it("무대·재화 판·안내·버튼이 위에서부터 겹치지 않고 창 안에 든다", () => {
    for (const rows of [1, 2]) {
      const s = relicResetPopupSpots(rows);
      const half = s.height / 2;
      expect(s.stageTop).toBeGreaterThan(-half);
      expect(s.walletTop).toBeGreaterThanOrEqual(s.stageTop + RELIC_RESET_POPUP.stage.height);
      expect(s.noteY).toBeGreaterThan(s.walletTop + s.walletHeight);
      expect(s.buttonY - RELIC_RESET_POPUP.button.height / 2).toBeGreaterThan(s.noteY);
      expect(s.buttonY + RELIC_RESET_POPUP.button.height / 2).toBeLessThan(half);
    }
  });

  it("말풍선·SD는 무대 안에, 두 버튼과 재화 칸은 판 폭 안에 선다", () => {
    const { width, stage, wallet, button } = RELIC_RESET_POPUP;
    expect(stage.bubble.x + stage.bubble.width / 2).toBeLessThan(width / 2);
    expect(stage.sd.x - stage.sd.shadow / 2).toBeGreaterThan(-width / 2);
    expect(stage.sd.ground).toBeLessThanOrEqual(stage.height);
    const inner = width / 2 - wallet.inset;
    expect(wallet.columns.icon - wallet.icon / 2).toBeGreaterThan(-inner);
    expect(wallet.columns.delta).toBeLessThan(inner);
    const [left, right] = relicResetButtonXs();
    expect(right - left).toBe(button.width + button.gap);
    expect(right + button.width / 2).toBeLessThan(width / 2);
  });
});
