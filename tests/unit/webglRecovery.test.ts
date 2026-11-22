import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WEBGL_RECOVERY, mayReloadAfterContextLoss, nextReloadHistory, parseReloadHistory } from "../../src/core/webglRecovery";

describe("WebGL 컨텍스트 복구 규칙", () => {
  it("창 안에서 정한 횟수까지만 새로 띄운다", () => {
    const now = 1_000_000;
    expect(mayReloadAfterContextLoss([], now)).toBe(true);
    expect(mayReloadAfterContextLoss([now - 1000], now)).toBe(true);
    expect(mayReloadAfterContextLoss([now - 2000, now - 1000], now)).toBe(false);
    // 창을 벗어난 기록은 세지 않는다.
    expect(mayReloadAfterContextLoss([now - WEBGL_RECOVERY.windowMs - 1, now - 1000], now)).toBe(true);
  });

  it("기록은 오래된 것을 버리고 지금을 더한다", () => {
    const now = 5_000_000;
    expect(nextReloadHistory([now - WEBGL_RECOVERY.windowMs - 5, now - 10], now)).toEqual([now - 10, now]);
  });

  it("깨진 저장 값은 빈 기록이다", () => {
    expect(parseReloadHistory(null)).toEqual([]);
    expect(parseReloadHistory("{")).toEqual([]);
    expect(parseReloadHistory('[1,"x",2]')).toEqual([1, 2]);
  });
});

describe("배경 원화 업로드 길", () => {
  it("createImageBitmap으로 올리지 않는다 (노트20 스토리 지도 까만 화면)", () => {
    const source = readFileSync("src/ui/backgrounds.ts", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(source).not.toMatch(/createImageBitmap\s*\(/);
  });
});
