import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DialogueFlow } from "../../src/core/dialogue";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";

const source = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("이야기 도중 설정", () => {
  it("다시 선 이야기는 넘겨받은 노드에서 잇고, 모르는 노드면 처음부터다", () => {
    const resume = OPENING_TRAIN.nodes[3]!.id;
    expect(new DialogueFlow(OPENING_TRAIN, resume).current.id).toBe(resume);
    expect(new DialogueFlow(OPENING_TRAIN, "no-such-node").current.id).toBe(OPENING_TRAIN.startNodeId);
    expect(new DialogueFlow(OPENING_TRAIN).current.id).toBe(OPENING_TRAIN.startNodeId);
  });

  it("두 이야기 화면이 대사판 도구 줄에 설정 칩을 세우고 겹쳐 연다", () => {
    for (const [file, host] of [["src/scenes/OpeningScene.ts", "opening"], ["src/scenes/StageStoryScene.ts", "stageStory"]] as const) {
      const text = source(file);
      expect(text).toContain("onSettings:");
      expect(text).toContain(`openSettingsOver(this, "${host}"`);
      // 다시 설 때 읽던 노드를 싣고, 제목표는 다시 틀지 않는다.
      expect(text).toContain("resumeNodeId: this.flow.current.id");
      expect(text).toMatch(/titleCard && !this\.resuming/);
    }
    expect(source("src/ui/DialogueLayer.ts")).toContain('t("dialogue.settings")');
  });

  it("튜토리얼 막이 서도 설정을 여는 조각은 막 위로 올라간다", () => {
    expect(source("src/ui/TopBar.ts")).toContain("registerSettingsAccess(scene, [settings], hit)");
    expect(source("src/ui/TutorialSpotlight.ts")).toContain("raiseSettingsAccess(scene, depth)");
    expect(source("src/ui/tutorialTarget.ts")).toContain("raiseSettingsAccess(scene, 6000)");
    const battle = source("src/scenes/BattleScene.ts");
    expect(battle).toContain("registerSettingsAccess(this, [new BattlePauseButton(");
    expect(battle).toContain("raiseSettingsAccess(this, TUTORIAL_DEPTH + 2)");
  });
});
