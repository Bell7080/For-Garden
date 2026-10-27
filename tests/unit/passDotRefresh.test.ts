import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("패스 붉은 점", () => {
  it("패스를 받거나 열면 알림을 곧바로 다시 읽는다", () => {
    const source = readFileSync("src/ui/PassPopup.ts", "utf8");
    expect(source.match(/notificationManager\.refresh\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
