import { describe, expect, it } from "vitest";
import DIALOGUE_SOURCE from "../../src/ui/DialogueLayer.ts?raw";

/** Phaser를 띄우지 않고 첫 대사와 비동기 Puppet의 서로 다른 수명주기 경계를 고정한다. */
describe("DialogueLayer 표시 수명주기", () => {
  it("첫 UI는 씬 활성 판정 전에 시작하고 Puppet만 await 뒤 소유권을 재확인한다", () => {
    const showSource = DIALOGUE_SOURCE.slice(
      DIALOGUE_SOURCE.indexOf("async show(node:"),
      DIALOGUE_SOURCE.indexOf("private startTyping"),
    );
    const awaitIndex = showSource.indexOf("await spawnPuppet");

    // create() 중 첫 렌더가 막히지 않도록 await 전에는 종료 여부만 검사한다.
    expect(showSource.slice(0, awaitIndex)).not.toContain("isRenderOwnerActive()");
    expect(showSource.indexOf("this.speaker.setText")).toBeLessThan(awaitIndex);
    expect(showSource.indexOf("this.startTyping")).toBeLessThan(awaitIndex);
    // 늦게 끝난 Puppet은 교체된 노드나 종료된 씬에 붙지 않아야 한다.
    expect(showSource.slice(awaitIndex)).toContain("generation !== this.renderGeneration || !this.isRenderOwnerActive()");
  });
});
