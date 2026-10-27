import Phaser from "phaser";
import { UNIVERSAL_FRAGMENT_ITEM, universalFragmentRarity } from "../core/relicProgression";
import type { RelicRarity } from "../core/types";
import { session } from "../state/session";
import { clipPolygonToShape, paintGlassSheen } from "./FaceFrame";
import { bakeFaceTexture, clipRectToShape, faceClipShape } from "./faceTexture";
import { RARITY_TONE } from "./rarityMark";

/**
 * 만능 파편의 그림 — **렐릭 파편 액자와 같은 유리 결**에 얼굴 대신 흰 문양이 든다.
 *
 * 파편은 액자 안쪽에서 등급색이 번지고 물낯처럼 일렁이는 띠가 얹히는 것으로 "누군가의 한 조각"을
 * 말한다(`FaceFrame`의 `gem`). 만능 파편도 같은 결을 써야 같은 돌파 재료로 읽히고, 등급색 결정에 별이
 * 박힌 일러스트(`scripts/prepare_icons.py`가 구운 세 장)가 누구의 것도 아니라는 것을 말한다. 아이템 액자가 서는 자리(공용 액자·가방 칸·아이템 안내창·상점 진열대·구매 확인)가 모두 이 파일을 지난다.
 *
 * 그림 자체가 등급색 결정 일러스트이고(R 푸른빛 · SR 보랏빛 · SSR 호박빛), 액자는 그 위에 **투영 장비의 결**을 한 겹 더
 * 얹는다 — 옅은 주사선과, 몇 초마다 비스듬히 훑고 지나가는 빛 한 줄. 훑는 빛은 움직임 줄이기에서 서지 않는다.
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

/**
 * 그림의 자리 — 재화 아이콘처럼 액자 안 78%에 띄우지 않고 **일러스트가 액자를 꽉 채운다.** 원본은 이미
 * 알파 경계로 잘라 정사각에 맞춰 구웠으므로(`crop` 1) 그대로 한 변에 맞춘다. 깎인 모서리는 얼굴 액자와
 * 같은 방법(`bakeFaceTexture`)으로 그림 자체에서 지운다. 일러스트의 색을 누르지 않고(tint 없음) 아주 살짝만
 * 비치게 해, 위에 얹히는 유리·주사선·훑는 빛이 은은한 홀로그램으로 읽히게 한다.
 */
export const FRAGMENT_ART = {
  /** 원본(256) 중 액자 한 변에 담을 가운데 정사각의 비율. 작을수록 크게 선다. */
  crop: 1,
  tint: 0xffffff,
  alpha: 0.96,
} as const;

/** 액자를 꽉 채우도록 구운 만능 파편 그림. 그림이 아직 없으면 아무것도 세우지 않는다. */
export function addUniversalFragmentArt(scene: Phaser.Scene, size: number, textureKey: string, alpha = 1): Phaser.GameObjects.Image | undefined {
  if (!scene.textures.exists(textureKey)) return undefined;
  const source = scene.textures.get(textureKey).getSourceImage();
  const side = source.width * FRAGMENT_ART.crop;
  const baked = bakeFaceTexture(scene, textureKey, size, { x: (source.width - side) / 2, y: (source.height - side) / 2, side });
  return scene.add.image(0, 0, baked).setDisplaySize(size, size).setTint(FRAGMENT_ART.tint).setAlpha(FRAGMENT_ART.alpha * alpha);
}

/** 홀로그램 결의 값. 비율은 전부 액자 한 변 대비다. */
export const FRAGMENT_HOLOGRAM = {
  /** 주사선 간격·두께·진하기. 그림이 이미 제 주사선을 갖고 있어 액자 쪽은 아주 옅게만 깐다. */
  scan: { gap: 0.045, height: 0.012, alpha: 0.07 },
  /** 훑는 빛 — 띠 폭, 한 번 지나가는 시간, 다음 번까지 쉬는 시간(ms), 가장 밝을 때의 진하기. */
  sweep: { width: 0.22, slant: 0.5, duration: 900, rest: 2600, alpha: 0.34 },
} as const;

/** 그림 위에 얹는 유리 결과 홀로그램 결. 액자 한 변(`size`)에 맞춰 그린다. */
export function addUniversalFragmentGlass(scene: Phaser.Scene, size: number, rarity: RelicRarity): Phaser.GameObjects.Container {
  const tone = universalFragmentTone(rarity);
  const glass = paintGlassSheen(scene, size, tone);
  const shape = faceClipShape(size);
  const half = size / 2;
  // 주사선 — 마스크가 아니라 칠할 띠를 액자 도형으로 잘라 깎인 모서리 밖으로 새지 않게 한다.
  const scan = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  scan.fillStyle(0xffffff, FRAGMENT_HOLOGRAM.scan.alpha);
  for (let top = -half; top < half; top += size * FRAGMENT_HOLOGRAM.scan.gap) {
    const band = clipRectToShape({ left: -half, top, width: size, height: size * FRAGMENT_HOLOGRAM.scan.height }, shape);
    if (band.length >= 6) scan.fillPoints(toPoints(band), true);
  }
  glass.add(scan);
  if (session.settings.accessibility.reduceMotion || import.meta.env?.MODE === "test") return glass;
  // 훑는 빛 — 왼쪽 밖에서 오른쪽 밖까지 비스듬한 띠가 지나가고 쉰다. 매 갱신 띠를 액자 도형으로 다시 잘라 그린다.
  const sweep = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  glass.add(sweep);
  const { width, slant, duration, rest, alpha } = FRAGMENT_HOLOGRAM.sweep;
  const band = size * width;
  const lean = size * slant;
  const state = { t: 0 };
  const paint = (): void => {
    sweep.clear();
    const x = -half - band - lean + (size + band * 2 + lean * 2) * state.t;
    const strip = clipPolygonToShape([x, -half, x + band, -half, x + band - lean, half, x - lean, half], shape);
    if (strip.length < 6) return;
    // 가운데가 가장 밝게 — 지나가는 동안 진하기가 솟았다 잦아든다.
    const glow = Math.sin(Math.PI * state.t);
    sweep.fillStyle(tone, alpha * glow);
    sweep.fillPoints(toPoints(strip), true);
    const core = clipPolygonToShape([x + band * 0.4, -half, x + band * 0.6, -half, x + band * 0.6 - lean, half, x + band * 0.4 - lean, half], shape);
    if (core.length >= 6) {
      sweep.fillStyle(0xffffff, alpha * 0.7 * glow);
      sweep.fillPoints(toPoints(core), true);
    }
  };
  const tween = scene.tweens.add({
    targets: state, t: 1, duration, repeatDelay: rest, repeat: -1, delay: Math.round(Math.random() * rest),
    onUpdate: paint, onRepeat: () => sweep.clear(),
  });
  glass.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  return glass;
}

function toPoints(flat: readonly number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let index = 0; index < flat.length; index += 2) points.push(new Phaser.Geom.Point(flat[index], flat[index + 1]));
  return points;
}
