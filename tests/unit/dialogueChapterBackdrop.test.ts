import { describe, expect, it } from "vitest";
import { CHAPTER_1_STORIES } from "../../src/data/dialogues/chapter1";
import { CHAPTER_2_STORIES } from "../../src/data/dialogues/chapter2";
import { CHAPTER_3_STORIES } from "../../src/data/dialogues/chapter3";
import { CHAPTER_4_STORIES } from "../../src/data/dialogues/chapter4";
import { CHAPTER_5_STORIES } from "../../src/data/dialogues/chapter5";
import { CHAPTER_6_STORIES } from "../../src/data/dialogues/chapter6";
import { CHAPTER_7_STORIES } from "../../src/data/dialogues/chapter7";
import { DIALOGUE_BACKDROP } from "../../src/ui/dialogueStageLayout";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { DialogueBackdrop } from "../../src/core/dialogue";
import { RELIC_STORIES } from "../../src/data/relicStories";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { BACKGROUND, BACKGROUND_ASSETS, BACKGROUND_BOOT_KEYS } from "../../src/ui/backgroundAssets";

/** 전장 밖에서는 실제 장면의 장소를 쓴다. 장면 배경도 장의 장소 범위와 로딩 계약을 지킨다. */
describe("장별 대사 무대", () => {
  const chapters = [CHAPTER_1_STORIES, CHAPTER_2_STORIES, CHAPTER_3_STORIES, CHAPTER_4_STORIES, CHAPTER_5_STORIES, CHAPTER_6_STORIES, CHAPTER_7_STORIES];
  const allowed: readonly (readonly DialogueBackdrop[])[] = [
    ["battlefield", "greenhouse", "deepField", "assembly", "pressureClosed"],
    ["battlefield", "assembly", "pressureClosed", "pressureBroken"],
    ["deepField", "canal"], ["deepField", "assembly"],
    ["prisonField", "detention", "canal"], ["prisonField", "detention"],
    ["thirdBranchField", "restraint"],
  ];
  chapters.forEach((stories, index) => {
    const chapter = index + 1;
    it(`${chapter}장 이야기는 그 장에 속하는 장소에 선다`, () => {
      const keys = stories.flatMap((story) => [story.backdrop, ...story.nodes.map((node) => node.backdrop)])
        .filter((key): key is NonNullable<typeof key> => key !== undefined && key !== "train" && key !== "relics");
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(allowed[index], `${chapter}장: ${key}`).toContain(key);
    });
  });
  it("1·2장 무대는 기본 전장이다", () => expect(DIALOGUE_BACKDROP.battlefield).toBe(BACKGROUND.combat));

  it("모든 애착 장이 자기 장소를 명시하고 실제 배경 파일을 찾을 수 있다", () => {
    const paths = new Map<string, string>(BACKGROUND_ASSETS);
    for (const profile of Object.values(RELIC_STORIES)) {
      for (const story of Object.values(profile.bondStories)) {
        expect(story.backdrop, story.id).toBeDefined();
        const key = DIALOGUE_BACKDROP[story.backdrop!];
        expect(paths.has(key), story.id).toBe(true);
        expect(existsSync(resolve("public", paths.get(key)!)), story.id).toBe(true);
      }
    }
    for (const key of Object.values(DIALOGUE_BACKDROP)) {
      expect(paths.has(key), key).toBe(true);
      expect(existsSync(resolve("public", paths.get(key)!)), key).toBe(true);
    }
  });

  it("격실은 닫힌 문에서 시작해 파손 섬광 뒤 열린 문으로 바뀐다", () => {
    const before = CHAPTER_2_STORIES.find(({ id }) => id === "stage-2-7-pre")!;
    const after = CHAPTER_2_STORIES.find(({ id }) => id === "stage-2-7-post")!;
    expect(before.backdrop).toBe("pressureClosed");
    expect(after.backdrop).toBe("pressureClosed");
    expect(after.nodes.find(({ id }) => id === after.startNodeId)).toMatchObject({ cue: "explosion", backdrop: "pressureBroken", cast: [] });
    expect(after.nodes.find(({ id }) => id === "safe")?.cast).toEqual([{ id: "torika", slot: "left" }, { id: "toby", slot: "right" }]);
    expect(DIALOGUE_BACKDROP.pressureClosed).not.toBe(DIALOGUE_BACKDROP.pressureBroken);
    expect(OPENING_TRAIN.nodes.find(({ id }) => id === "blast")).toMatchObject({ cue: "explosion", backdrop: "wreck" });
  });

  it("새 대사 배경은 부트에서 한꺼번에 읽지 않는다", () => {
    const scenes = Object.values(DIALOGUE_BACKDROP).filter(key => key.startsWith("background-story-") && key !== BACKGROUND.storyTrain);
    expect(scenes.length).toBeGreaterThan(10);
    for (const key of scenes) expect(BACKGROUND_BOOT_KEYS).not.toContain(key);
  });
});
