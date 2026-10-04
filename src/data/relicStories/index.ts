import type { RelicStoryProfile } from "../../core/relicStory";
import { ANKA_STORY } from "./anka";
import { ARK_STORY } from "./ark";
import { DIAN_STORY } from "./dian";
import { DODO_STORY } from "./dodo";
import { ELLA_STORY } from "./ella";
import { KENTO_STORY } from "./kento";
import { MERON_STORY } from "./meron";
import { MADDY_STORY } from "./maddy";
import { METTE_STORY } from "./mette";
import { NODONIA_STORY } from "./nodonia";
import { PACHI_STORY } from "./pachi";
import { PARUA_STORY } from "./parua";
import { REX_STORY } from "./rex";
import { SPINO_STORY } from "./spino";
import { STELLA_STORY } from "./stella";
import { TIA_STORY } from "./tia";
import { TORIKA_STORY } from "./torika";
import { YUTI_STORY } from "./yuti";

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
  rex: REX_STORY,
  spino: SPINO_STORY,
  meron: MERON_STORY,
  mette: METTE_STORY,
  ella: ELLA_STORY,
  tia: TIA_STORY,
  dian: DIAN_STORY,
  nodonia: NODONIA_STORY,
  anka: ANKA_STORY,
  maddy: MADDY_STORY,
  ark: ARK_STORY,
  yuti: YUTI_STORY,
  pachi: PACHI_STORY,
};

export function relicStoryFor(relicId: string): RelicStoryProfile | undefined {
  return RELIC_STORIES[relicId];
}
