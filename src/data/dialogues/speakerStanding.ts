import type { DialogueStandingAsset } from "../../core/dialogue";
import { RELICS } from "../relics";

/**
 * 화자 이름 → 그 사람의 스탠딩 원화.
 *
 * 전신 원화가 있는 개체는 대사에서 이름표만 세우지 않고 **말하는 순간 그 얼굴이 뜨게** 한다.
 * 개체가 늘어도 이 표를 손으로 늘리지 않는다 — 도감 정의의 이름과 원화 ID에서 모듈을 읽는 순간
 * 한 번 만든다. **모듈을 읽을 때 만드는 이유**: 언어를 바꾸면 도감 이름이 번역으로 갈아 끼워지므로
 * 나중에 만들면 번역된 이름이 열쇠가 되어 한국어 화자 이름과 맞지 않는다.
 */
const BY_NAME = new Map<string, DialogueStandingAsset>();
for (const relic of RELICS) {
  if (relic.enemyOnly || relic.summonOnly) continue;
  BY_NAME.set(relic.name, relic.portraitAssetId);
}
// 도감에 서지 않는 이름. 상점 점원은 전용 원화라 이름으로만 잇는다.
BY_NAME.set("오비", "obi");

/** 한국어 화자 이름으로 스탠딩을 찾는다. 사람이 아닌 목소리나 `???`처럼 없는 이름은 `undefined`다. */
export function speakerStanding(speaker: string): DialogueStandingAsset | undefined {
  return BY_NAME.get(speaker);
}
