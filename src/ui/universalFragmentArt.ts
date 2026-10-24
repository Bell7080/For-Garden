import type Phaser from "phaser";
import { UNIVERSAL_FRAGMENT_ITEM, universalFragmentRarity } from "../core/relicProgression";
import type { RelicRarity } from "../core/types";
import { paintGlassSheen } from "./FaceFrame";
import { RARITY_TONE } from "./rarityMark";

/**
 * 만능 파편의 그림 — **렐릭 파편 액자와 같은 유리 결**에 얼굴 대신 흰 문양이 든다.
 *
 * 파편은 액자 안쪽에서 등급색이 번지고 물낯처럼 일렁이는 띠가 얹히는 것으로 "누군가의 한 조각"을
 * 말한다(`FaceFrame`의 `gem`). 만능 파편도 같은 결을 써야 같은 돌파 재료로 읽히고, 가운데 문양
 * (`scripts/draw_universal_fragment.py` — 이목구비 없는 실루엣과 솟는 꺾쇠)이 누구의 것도 아니라는
 * 것을 말한다. 아이템 액자가 서는 세 자리(공용 액자·가방 칸·아이템 안내창)가 모두 이 파일을 지난다.
 */
const TEXTURE_PREFIX = "item-";

/** 아이템 그림 키가 만능 파편이면 그 등급. */
export function universalFragmentRarityOfTexture(textureKey: string): RelicRarity | undefined {
  return textureKey.startsWith(TEXTURE_PREFIX) ? universalFragmentRarity(textureKey.slice(TEXTURE_PREFIX.length)) : undefined;
}

/** 그 등급 만능 파편의 그림 키. 아이템 정의의 아이콘 키와 같다. */
export function universalFragmentTexture(rarity: RelicRarity): string {
  return `${TEXTURE_PREFIX}${UNIVERSAL_FRAGMENT_ITEM[rarity]}`;
}

/** 그 등급 파편 액자의 외곽선·유리 색. 렐릭 파편과 같은 값이다. */
export function universalFragmentTone(rarity: RelicRarity): number {
  return RARITY_TONE[rarity].chip;
}

/** 그림 위에 얹는 유리 결. 액자 한 변(`size`)에 맞춰 그린다. */
export function addUniversalFragmentGlass(scene: Phaser.Scene, size: number, rarity: RelicRarity): Phaser.GameObjects.Container {
  return paintGlassSheen(scene, size, universalFragmentTone(rarity));
}
