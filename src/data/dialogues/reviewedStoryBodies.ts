import type { DialogueStory } from "../../core/dialogue";
import { registerDataText } from "../../i18n";

/** 본편·서브 원고 중 v0.449.6에서 검수와 11개 언어 번역을 함께 마친 본문만 등록한다. */
export const REVIEWED_STORY_BODIES: Readonly<Record<string, readonly string[]>> = {
  "stage-1-2-post": ["heard", "log"],
  "stage-1-4-pre": ["habit", "train"],
  "stage-1-5-pre": ["hi", "torn", "guard", "fight"],
  "stage-1-5-post": ["tidy", "excuse", "label"],
  "stage-1-6-post": ["parua"],
  "stage-1-8-pre": ["useless", "droop", "oops", "cheer"],
  "stage-1-10-post": ["drop"],
  "stage-2-2-post": ["radio", "spina"],
  "stage-2-4-pre": ["ripa"],
  "stage-2-5-post": ["up"],
  "stage-2-6-post": ["delopi", "luka", "hush"],
  "stage-2-7-pre": ["ripa"],
  "stage-2-7-post": ["awkward", "thanks"],
  "stage-2-10-pre": ["ripa", "torika"],
  "stage-2-10-post": ["ripa", "ask"],
  "stage-3-1-pre": ["toby", "amo"],
  "stage-3-4-post": ["radio", "gone"],
  "stage-3-5-post": ["down"],
  "stage-3-8-post": ["neuri", "ella"],
  "stage-3-9-post": ["ark"],
  "stage-3-10-pre": ["ika2"],
  "stage-4-1-pre": ["lexia"],
  "stage-4-8-post": ["radio", "torika"],
  "stage-5-1-pre": ["radio"],
  "stage-5-5-pre": ["mosana"],
  "stage-5-6-post": ["water"],
  "stage-5-8-post": ["radio", "maki"],
  "stage-5-10-pre": ["maki", "magasa2"],
  "stage-6-1-pre": ["morphe", "kento", "stella"],
  "stage-6-8-post": ["irna"],
  "stage-6-10-pre": ["stella"],
  "stage-6-10-post": ["koma"],
  "stage-7-1-pre": ["nodonia", "terisa"],
  "stage-7-4-post": ["nodonia"],
  "stage-7-5-pre": ["anka"],
  "stage-7-7-post": ["dodi"],
  "stage-7-8-post": ["ella"],
  "stage-7-10-post": ["carno"],
  "stage-1-5-greenhouse-echo": ["calm", "wet", "fine"],
  "stage-3-8-apology": ["ark", "yuti", "pachi2"],
  "stage-1-8-side-post": ["sniff"],
  "stage-2-4-side-pre": ["wall"],
  "stage-4-7-side-post": ["mean"],
  "stage-5-2-side-pre": ["salvage"],
  "stage-5-2-side-post": ["returnA"],
  "stage-5-8-youngest-share": ["burn"],
  "stage-6-4-side-post": ["up"],
  "stage-6-7-claw-marks": ["record"],
  "stage-7-3-mended-sleeve": ["path", "catchA", "hush"],
  "stage-7-6-side-post": ["fridge"],
};

export function registerReviewedStoryBodies(stories: readonly DialogueStory[]): void {
  for (const story of stories) {
    const reviewed = REVIEWED_STORY_BODIES[story.id];
    if (!reviewed) continue;
    for (const node of story.nodes) {
      if (reviewed.includes(node.id)) registerDataText(node, "body", `dialogue.${story.id}.${node.id}.body`);
    }
  }
}
