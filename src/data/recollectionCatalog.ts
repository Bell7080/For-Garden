import type { DialogueStory } from "../core/dialogue";
import { OPENING_TRAIN } from "./dialogues/openingTrain";
import { OPENING_RETREAT } from "./dialogues/openingRetreat";
import { GREENHOUSE_ECHO } from "./dialogues/greenhouseEcho";
import { GREAT_AUK_REPORT } from "./dialogues/greatAukReport";
import { CHAPTERS, SIDE_STORY_STAGE } from "./stages";
import { STAGE_STORY_LINKS } from "./stageStories";

/** 회고의 탭. 본편은 장마다, 그 밖의 곁 이야기·행사 이야기는 한 탭에 모은다. */
export type RecollectionGroup = "chapter1" | "chapter2" | "side";

export const RECOLLECTION_GROUPS: readonly RecollectionGroup[] = ["chapter1", "chapter2", "side"];

/** 회고에 모이는 이야기 한 편. 제목은 관문 이름에서 나오고, 관문이 없는 이야기만 제 제목 키를 갖는다. */
export interface RecollectionEntry {
  storyId: string;
  group: RecollectionGroup;
  stageId?: string;
  /** 관문 앞(`pre`)·뒤(`post`) 대사. 오프닝처럼 관문과 묶이지 않는 이야기는 비운다. */
  phase?: "pre" | "post";
  titleKey?: "recollection.title.openingTrain" | "recollection.title.openingRetreat" | "recollection.title.greenhouse" | "recollection.title.greatAuk";
}

/**
 * 회고 목록을 **데이터에서 조립한다**. 관문 대사는 `STAGE_STORY_LINKS`가 이미 갖고 있으므로 이 목록에
 * 이야기를 따로 적지 않는다 — 두 곳에 적으면 대사를 달고 회고에 올리는 것을 잊은 이야기가 생긴다.
 * 새 종류의 이야기(행사·곁 이야기)만 아래 고정 목록에 한 줄을 더한다.
 */
export function buildRecollectionEntries(): readonly RecollectionEntry[] {
  const entries: RecollectionEntry[] = [
    { storyId: OPENING_TRAIN.id, group: "chapter1", titleKey: "recollection.title.openingTrain" },
    { storyId: OPENING_RETREAT.id, group: "chapter1", stageId: "1-1", titleKey: "recollection.title.openingRetreat" },
  ];
  for (const chapter of CHAPTERS) {
    const group: RecollectionGroup | undefined = chapter.id === 1 ? "chapter1" : chapter.id === 2 ? "chapter2" : undefined;
    if (!group) continue;
    for (const stage of chapter.stages) {
      const link = STAGE_STORY_LINKS[stage.id];
      if (link?.pre) entries.push({ storyId: link.pre, group, stageId: stage.id, phase: "pre" });
      if (link?.post) entries.push({ storyId: link.post, group, stageId: stage.id, phase: "post" });
    }
  }
  entries.push({ storyId: GREENHOUSE_ECHO.id, group: "side", stageId: SIDE_STORY_STAGE.id, titleKey: "recollection.title.greenhouse" });
  entries.push({ storyId: GREAT_AUK_REPORT.id, group: "side", titleKey: "recollection.title.greatAuk" });
  return entries;
}

export const RECOLLECTION_ENTRIES: readonly RecollectionEntry[] = buildRecollectionEntries();

export function recollectionEntriesOf(group: RecollectionGroup): readonly RecollectionEntry[] {
  return RECOLLECTION_ENTRIES.filter((entry) => entry.group === group);
}

/**
 * 회고 줄에 은은하게 깔리는 대사 한 줄.
 *
 * 화자가 있는 대사 가운데 **한 줄에 들어오는 가장 긴 말**을 고른다 — 짧은 감탄사(「으윽…」)는 그 이야기를
 * 말하지 못하고, 너무 긴 말은 판 오른쪽에 들어가지 않는다. 이야기 데이터에서 고르므로 대사를 고치면 따라온다.
 */
export const RECOLLECTION_ECHO_MAX_LENGTH = 24;

export function recollectionEcho(story: DialogueStory): string | undefined {
  let best: string | undefined;
  for (const node of story.nodes) {
    if (!node.speaker) continue;
    const body = node.body.trim();
    if (body.length > RECOLLECTION_ECHO_MAX_LENGTH || body.length < 8) continue;
    if (!best || body.length > best.length) best = body;
  }
  return best;
}
