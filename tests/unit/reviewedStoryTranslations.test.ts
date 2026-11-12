import { afterEach, describe, expect, it } from "vitest";
import { LANGUAGE_IDS } from "../../src/core/language";
import { loadDataOverlay } from "../../src/i18n";
import { getRecollectionStory } from "../../src/data/dialogues/recollections";
import { REVIEWED_STORY_BODIES } from "../../src/data/dialogues/reviewedStoryBodies";

const OVERLAYS = import.meta.glob("../../src/i18n/*/data.ts", { import: "default", eager: true }) as Record<string, Record<string, string>>;

describe("검수한 본편·서브 대사의 실제 언어 전환", () => {
  afterEach(async () => { await loadDataOverlay("ko"); });

  it("은 번역표만 채우고 실제 본문은 한국어로 남기는 누락 없이 11개 언어와 한국어 복원을 지원한다", async () => {
    await loadDataOverlay("ko");
    const rows = Object.entries(REVIEWED_STORY_BODIES).flatMap(([storyId, nodeIds]) => nodeIds.map((id) => {
      const node = getRecollectionStory(storyId).nodes.find((entry) => entry.id === id);
      expect(node, `${storyId}.${id}`).toBeDefined();
      return { node: node!, key: `dialogue.${storyId}.${id}.body`, korean: node!.body };
    }));
    expect(rows).toHaveLength(81);
    for (const language of LANGUAGE_IDS.filter((id) => id !== "ko")) {
      const overlay = OVERLAYS[`../../src/i18n/${language}/data.ts`];
      await loadDataOverlay(language);
      for (const { node, key, korean } of rows) {
        expect(overlay[key], `${language}:${key}`).toBeTruthy();
        expect(node.body, `${language}:${key}`).toBe(overlay[key]);
        expect(node.body, `${language}:${key}`).not.toBe(korean);
      }
    }
    await loadDataOverlay("ko");
    for (const { node, korean } of rows) expect(node.body).toBe(korean);
  });
});
