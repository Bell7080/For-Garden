import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * **실제로 바뀐 값은 그 자리에서 바로 바뀐다.**
 *
 * 한계 돌파·급여·외형처럼 정보창에서 바꾼 값이 창을 닫았다 다시 열어야, 또는 화면을 나갔다
 * 들어와야 보이면 방금 한 조작이 먹었는지 알 수 없다. 눈으로만 보이는 일이라 소스의 모양으로 지킨다.
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("성장 변화의 즉시 반영", () => {
  it("정보창은 돌파 단계가 바뀌면 스킬 액자의 `+`를 다시 세운다", () => {
    const info = read("src/ui/info.ts");
    const growth = info.slice(info.indexOf("private refreshGrowth(): void {"));
    expect(growth).toContain("this.paintStars(def);");
    expect(growth).toContain("if (this.skillIconsKey !== this.skillIconsKeyOf(def)) {");
    expect(info).toContain("this.skillIconsKey = this.skillIconsKeyOf(def);");
    // 돌파 확정 경로가 그 다시 칠하기를 지난다.
    const breakThrough = info.slice(info.indexOf("private async breakThrough(): Promise<void> {"));
    expect(breakThrough.slice(0, breakThrough.indexOf("\n  }\n"))).toContain("this.refreshGrowth();");
  });

  it("카드는 다시 세우지 않고 레벨·돌파 등급만 갈아 끼운다", () => {
    const card = read("src/ui/PortraitCard.ts");
    expect(card).toContain("setProgress(level: number | undefined, breakthroughGrade: number | undefined): this {");
    expect(card).toContain("this.gradeMark.removeAll(true);");
  });

  it("정보창을 여는 편성 목록은 창을 닫을 때 카드를 맞춘다", () => {
    expect(read("src/scenes/PartyScene.ts")).toContain("this.info.onClose = () => this.refresh();");
    expect(read("src/scenes/PartyScene.ts")).toContain("entry.card.setProgress(");
    expect(read("src/scenes/ExpeditionScene.ts")).toContain("this.allyInfo.onClose = () => this.syncRosterProgress();");
    expect(read("src/ui/IdleExcavationPopup.ts")).toContain("info.onClose = () => this.syncRosterProgress();");
    expect(read("src/ui/InteractionCityPopup.ts")).toContain("shown.setProgress(");
  });

  it("도감은 외형과 전투력순 순서까지 바뀐 것으로 센다", () => {
    const relics = read("src/scenes/RelicsScene.ts");
    expect(relics).toContain("relicSkinManager.equippedFor(id)");
    expect(relics).toContain('this.sortMode === "power" ? combatPower(relicProgression.getFinalStats(id))');
  });
});
