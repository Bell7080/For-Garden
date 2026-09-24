import { describe, expect, it } from "vitest";
import DIALOGUE_SOURCE from "../../src/ui/DialogueLayer.ts?raw";
import STAGE_SOURCE from "../../src/ui/DialogueStage.ts?raw";

/** Phaser를 띄우지 않고 첫 대사와 비동기 Puppet의 서로 다른 수명주기 경계를 고정한다. */
describe("DialogueLayer 표시 수명주기", () => {
  it("첫 UI는 씬 활성 판정 전에 시작하고 무대만 await 뒤 소유권을 재확인한다", () => {
    const showSource = DIALOGUE_SOURCE.slice(
      DIALOGUE_SOURCE.indexOf("async show(node:"),
      DIALOGUE_SOURCE.indexOf("prefetch(order"),
    );
    const awaitIndex = showSource.indexOf("await this.stage.present");
    expect(awaitIndex).toBeGreaterThan(0);

    // create() 중 첫 렌더가 막히지 않도록 이름과 본문은 무대를 기다리기 전에 선다.
    expect(showSource.indexOf("this.setSpeaker(")).toBeLessThan(awaitIndex);
    expect(showSource.indexOf("this.startTyping")).toBeLessThan(awaitIndex);
    // 늦게 끝난 무대는 교체된 노드나 종료된 씬에 붙지 않아야 한다. 판정은 무대가 기다린 뒤에 부른다.
    expect(showSource.slice(awaitIndex)).toContain("generation === this.renderGeneration && this.isRenderOwnerActive()");
  });

  it("무대는 기다리기 전에 활성 판정을 묻지 않고, 늦게 도착한 스탠딩을 버린다", () => {
    const presentSource = STAGE_SOURCE.slice(
      STAGE_SOURCE.indexOf("async present(node:"),
      STAGE_SOURCE.indexOf("private async summon("),
    );
    // `create` 안에서 부르면 씬이 아직 활성으로 표시되기 전이라, 첫 await 전에 물으면 첫 무대가 통째로 빠진다.
    const firstAwait = presentSource.indexOf("await ");
    expect(presentSource.slice(0, firstAwait)).not.toContain("isCurrent()");

    const summonSource = STAGE_SOURCE.slice(
      STAGE_SOURCE.indexOf("private async summon("),
      STAGE_SOURCE.indexOf("private dismiss("),
    );
    const spawnIndex = summonSource.indexOf("await spawnPuppet");
    expect(spawnIndex).toBeGreaterThan(0);
    expect(summonSource.slice(spawnIndex)).toContain("!isCurrent()");
    expect(summonSource.slice(spawnIndex)).toContain("creature.destroy()");
  });
});
