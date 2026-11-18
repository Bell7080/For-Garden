import type { DialogueStory } from "../../core/dialogue";
import { registerDataText } from "../../i18n";
import { RELICS } from "../relics";
import { speakerStanding } from "./speakerStanding";

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

/**
 * 본문·선택지까지 열한 언어 번역을 모두 마친 본편·서브 이야기. 여기 오른 이야기는 노드마다 본문과 선택지를
 * 등록한다. 장 단위로 검수·번역을 마칠 때마다 한 줄씩 늘린다.
 */
export const TRANSLATED_STORY_IDS: ReadonlySet<string> = new Set<string>([
  // 1장
  "stage-1-2-post",
  "stage-1-4-pre",
  "stage-1-5-pre",
  "stage-1-5-post",
  "stage-1-5-greenhouse-echo",
  "stage-1-6-post",
  "stage-1-7-pre",
  "stage-1-8-pre",
  "stage-1-8-side-pre",
  "stage-1-8-side-post",
  "stage-1-9-pre",
  "stage-1-9-post",
  "stage-1-10-pre",
  "stage-1-10-post",
  // 2장
  "stage-2-1-pre",
  "stage-2-2-post",
  "stage-2-3-lost-badge",
  "stage-2-4-pre",
  "stage-2-4-side-pre",
  "stage-2-4-side-post",
  "stage-2-5-pre",
  "stage-2-5-post",
  "stage-2-6-post",
  "stage-2-6-same-line",
  "stage-2-7-pre",
  "stage-2-7-post",
  "stage-2-8-pre",
  "stage-2-8-post",
  "stage-2-9-post",
  "stage-2-9-second-chase",
  "stage-2-10-pre",
  "stage-2-10-post",
  // 3장
  "stage-3-1-pre",
  "stage-3-3-side-pre",
  "stage-3-3-side-post",
  "stage-3-4-post",
  "stage-3-5-pre",
  "stage-3-5-behind-sleeve",
  "stage-3-5-post",
  "stage-3-6-post",
  "stage-3-8-apology",
  "stage-3-8-post",
  "stage-3-9-post",
  "stage-3-10-pre",
  "stage-3-10-post",
  // 4장
  "stage-4-1-pre",
  "stage-4-3-pre",
  "stage-4-3-break-time",
  "stage-4-4-pre",
  "stage-4-6-pre",
  "stage-4-7-side-pre",
  "stage-4-7-side-post",
  "stage-4-8-post",
  "stage-4-10-pre",
  "stage-4-10-post",
  // 5장
  "stage-5-1-pre",
  "stage-5-2-side-pre",
  "stage-5-2-side-post",
  "stage-5-3-post",
  "stage-5-4-post",
  "stage-5-5-pre",
  "stage-5-5-post",
  "stage-5-6-post",
  "stage-5-8-post",
  "stage-5-8-youngest-share",
  "stage-5-9-post",
  "stage-5-10-pre",
  "stage-5-10-post",
]);

/**
 * 렐릭이 아닌 화자의 이름 키. 렐릭 화자는 도감 이름(`relic.<id>.name`)을 그대로 빌린다 — 대사마다 이름을 다시 옮기면
 * 같은 사람이 도감과 대사에서 다른 표기로 선다.
 */
const SPEAKER_KEYS: Readonly<Record<string, string>> = {
  "오비": "shopClerk.obi.name",
};

/** 정체를 감춘 화자. 어느 언어에서나 같은 표기라 옮기지 않는다. */
const UNTRANSLATED_SPEAKERS = new Set(["???"]);

const RELIC_NAME_KEY = new Map(RELICS.map((relic) => [relic.name, `relic.${relic.id}.name`]));

export function registerReviewedStoryBodies(stories: readonly DialogueStory[]): void {
  for (const story of stories) {
    const reviewed = REVIEWED_STORY_BODIES[story.id];
    const complete = TRANSLATED_STORY_IDS.has(story.id);
    for (const node of story.nodes) {
      // 화자 이름을 옮기기 전에 그 얼굴을 굳힌다 — 런타임은 이름으로 원화를 찾으므로 이름이 번역되면 얼굴을 잃는다.
      if (!node.standing && node.speaker) node.standing = speakerStanding(node.speaker);
      if (node.speaker && !UNTRANSLATED_SPEAKERS.has(node.speaker)) {
        const speakerKey = SPEAKER_KEYS[node.speaker] ?? RELIC_NAME_KEY.get(node.speaker);
        if (!speakerKey) throw new Error(`이름 키가 없는 화자: ${story.id}.${node.id} ${node.speaker}`);
        registerDataText(node, "speaker", speakerKey);
      }
      const key = `dialogue.${story.id}.${node.id}`;
      if (complete || reviewed?.includes(node.id)) registerDataText(node, "body", `${key}.body`);
      if (complete) node.choices?.forEach((choice, index) => registerDataText(choice, "label", `${key}.choice.${index}`));
    }
  }
}
