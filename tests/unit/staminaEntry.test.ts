import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOP_BAR_SLOT_KEYS } from "../../src/ui/topBarSlots";

const read = (path: string) => readFileSync(path, "utf8");

describe("스테미나 표기와 부족할 때의 충전 창", () => {
  it("스테미나 단독 줄은 스테미나 한 칸만 세운다", () => {
    expect(TOP_BAR_SLOT_KEYS.stamina).toEqual(["stamina"]);
  });

  it("레이드와 공용 편성 화면은 상단에 스테미나 줄을 세운다", () => {
    expect(read("src/scenes/RaidScene.ts")).toContain('currencies: "stamina"');
    expect(read("src/scenes/PartyScene.ts")).toContain('currencies: "stamina"');
  });

  it("출격 버튼은 스테미나가 모자라면 꺼지지 않고 충전 창을 연다", () => {
    for (const path of ["src/scenes/BountyScene.ts", "src/scenes/CakeOperationScene.ts", "src/scenes/RaidScene.ts"]) {
      expect(read(path), path).toContain('"stamina")');
    }
    expect(read("src/scenes/BountyScene.ts")).not.toMatch(/sortieEnabled:[^\n]*stamina/);
    expect(read("src/scenes/CakeOperationScene.ts")).not.toMatch(/sortieEnabled:[^\n]*stamina/);
  });

  it("결과판의 다시 하기·다음 단계는 모자라면 충전 창을 부른다", () => {
    expect(read("src/scenes/BattleScene.ts").match(/onBlocked: \(\) => this\.openStaminaCharge\(\)/g)).toHaveLength(3);
  });
});
