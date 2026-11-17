import { describe, expect, it } from "vitest";
import type { DialogueLeave, DialogueNode } from "../../src/core/dialogue";
import { RECOLLECTION_STORIES } from "../../src/data/dialogues/recollections";
import {
  DIALOGUE_CUES,
  DIALOGUE_LEAVES,
  DIALOGUE_VOICE,
} from "../../src/ui/dialogueStageLayout";

/** 무대 문법(퇴장·장면 연출·목소리)의 표와 이야기 데이터가 같은 말을 쓰는지 지킨다. */
const NODES: DialogueNode[] = RECOLLECTION_STORIES.flatMap((story) => story.nodes);

describe("이야기 무대 문법", () => {
  it("별이 되지 않는 퇴장마다 연출 값이 있다", () => {
    const leaves: Exclude<DialogueLeave, "blastOff">[] = ["dash", "sink", "vanish", "rise", "retreat"];
    for (const leave of leaves) expect(DIALOGUE_LEAVES[leave], leave).toBeDefined();
  });

  it("이야기가 쓰는 퇴장·연출·목소리는 모두 표에 있다", () => {
    for (const node of NODES) {
      if (node.leave && node.leave !== "blastOff") expect(DIALOGUE_LEAVES[node.leave], node.id).toBeDefined();
      if (node.cue) expect(DIALOGUE_CUES[node.cue], node.id).toBeDefined();
      if (node.voice) expect(DIALOGUE_VOICE[node.voice], node.id).toBeDefined();
    }
  });

  it("퇴장은 무대를 바꾸는 노드에만 적는다", () => {
    for (const node of NODES) if (node.leave) expect(node.cast, node.id).toBeDefined();
  });

  it("외침은 드물다 — 한 이야기에 셋을 넘기지 않는다", () => {
    for (const story of RECOLLECTION_STORIES) {
      const shouts = story.nodes.filter((node) => node.voice === "shout").length;
      expect(shouts, story.id).toBeLessThanOrEqual(3);
    }
  });

  it("속삭임은 작아도 읽히는 크기다", () => {
    expect(DIALOGUE_VOICE.whisper.sizeRatio).toBeGreaterThanOrEqual(0.8);
    expect(DIALOGUE_VOICE.shout.sizeRatio).toBeLessThanOrEqual(1.4);
  });
});
