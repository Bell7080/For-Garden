import type { RelicStoryProfile } from "../../core/relicStory";
import { DODO_STORY } from "./dodo";
import { KENTO_STORY } from "./kento";
import { PARUA_STORY } from "./parua";
import { STELLA_STORY } from "./stella";
import { TORIKA_STORY } from "./torika";

/**
 * 이야기 묶음이 갖춰진 개체. 하나씩 다져 가며 늘리고, 없는 개체는 예전 방식(관찰 일지 글·일일 인터뷰·공용
 * 유대 대사)이 그대로 서므로 한꺼번에 옮기지 않는다.
 */
export const RELIC_STORIES: Readonly<Record<string, RelicStoryProfile>> = {
  torika: TORIKA_STORY,
  dodo: DODO_STORY,
  parua: PARUA_STORY,
  stella: STELLA_STORY,
  kento: KENTO_STORY,
};

export function relicStoryFor(relicId: string): RelicStoryProfile | undefined {
  return RELIC_STORIES[relicId];
}
