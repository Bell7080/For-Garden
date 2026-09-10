import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACKGROUND_ASSETS } from "./backgroundAssets";
import {
  emptyBackgroundResidency,
  releaseBackground,
  retainBackground,
  type BackgroundResidency,
} from "./backgroundResidency";
import { HOLO } from "./holo";
import { COLOR } from "./theme";

// 표는 Phaser 없는 모듈이 소유하지만, 부르는 곳 38군데가 한 경로만 알면 되도록 여기서 잇는다.
export { BACKGROUND, BACKGROUND_ASSETS, BACKGROUND_BOOT_KEYS } from "./backgroundAssets";

/** 키 하나로 경로를 찾는 조회표. 늦게 읽는 경로가 이 표만 본다. */
const BACKGROUND_PATHS: Readonly<Record<string, string>> = Object.fromEntries(BACKGROUND_ASSETS);

/** 지금 무엇이 올라가 있는지. 화면이 아니라 이 모듈만 안다. */
let residency: BackgroundResidency = emptyBackgroundResidency();

/** 같은 원화를 두 곳에서 동시에 요청해도 로더를 두 번 돌리지 않는다. */
const pendingLoads = new Map<string, Promise<boolean>>();

/**
 * 그 배경 원화를 GPU에 올려 둔다. 이미 있으면 곧바로 끝난다.
 *
 * 실패해도 던지지 않고 `false`만 돌려준다 — 원화 한 장이 없다고 그 화면의 조작까지 막지
 * 않는다는 로딩 단계의 태도를 그대로 쓴다.
 */
export function ensureBackgroundTexture(scene: Phaser.Scene, key: string): Promise<boolean> {
  if (scene.textures.exists(key)) return Promise.resolve(true);
  const path = BACKGROUND_PATHS[key];
  if (!path) return Promise.resolve(false);

  const existing = pendingLoads.get(key);
  if (existing) return existing;

  const job = new Promise<boolean>((resolve) => {
    const done = (ok: boolean): void => {
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
      scene.events.off(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
      resolve(ok);
    };
    // 씬이 먼저 닫히면 완료 신호가 영영 오지 않는다. 기다리던 쪽을 반드시 풀어 준다.
    const onShutdown = (): void => done(scene.textures.exists(key));
    const onError = (file: Phaser.Loader.File): void => { if (file.key === key) done(false); };
    scene.load.once(`filecomplete-image-${key}`, () => done(true));
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, onShutdown);
    scene.load.image(key, path);
    scene.load.start();
  });
  pendingLoads.set(key, job);
  void job.then(() => pendingLoads.delete(key));
  return job;
}

/**
 * 이 표시 객체가 사는 동안 그 배경 원화를 붙잡아 두고, 죽으면 놓는다.
 *
 * 아직 올라와 있지 않으면 읽어 와 채운 뒤 `onReady`를 부른다 — 원화마다 배율·원점이 달라
 * 자리 잡는 일은 부른 쪽이 해야 한다. 화면은 `textures.exists`를 직접 묻지 않는다.
 */
export function useBackgroundTexture(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  key: string,
  onReady?: (image: Phaser.GameObjects.Image) => void,
): void {
  const textures = scene.textures;
  residency = retainBackground(residency, key);
  image.once(Phaser.GameObjects.Events.DESTROY, () => {
    const next = releaseBackground(residency, key);
    residency = next.state;
    // 붙잡은 곳이 하나도 없는 키만 목록에 오르므로 살아 있는 표시 객체를 지울 일이 없다.
    for (const evicted of next.evict) textures.remove(evicted);
  });

  if (textures.exists(key)) {
    onReady?.(image);
    return;
  }
  void ensureBackgroundTexture(scene, key).then((ok) => {
    // 읽는 사이에 화면을 떠났을 수 있다. 죽은 객체에 텍스처를 물리면 렌더에서 터진다.
    if (!ok || !image.active || !image.scene) return;
    image.setTexture(key);
    onReady?.(image);
  });
}

/**
 * 세로 원화를 비율 왜곡 없이 화면 전체에 cover 배치한다.
 * UI 글자의 대비는 각 화면의 별도 반투명 패널이 담당하므로 원화 자체는 손대지 않는다.
 */
export function addSceneBackground(
  scene: Phaser.Scene,
  texture: string,
  depth = -30,
): Phaser.GameObjects.Image {
  // 아직 안 올라온 원화는 Phaser의 물음표 텍스처로 뜨므로, 도착하기 전에는 투명한 1×1로
  // 세워 두고 검은 화면만 보인다 — 로딩 화면과 같은 태도다(조립 과정을 보여 주지 않는다).
  const ready = scene.textures.exists(texture);
  const image = scene.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, ready ? texture : "__DEFAULT").setDepth(depth);
  if (!ready) image.setAlpha(0);
  useBackgroundTexture(scene, image, texture, (loaded) => {
    loaded.setScale(Math.max(BASE_WIDTH / loaded.width, BASE_HEIGHT / loaded.height));
    if (loaded.alpha < 1) scene.tweens.add({ targets: loaded, alpha: 1, duration: 160 });
  });
  return image;
}

/** 팝업 안에서만 쓰는 배경 원화의 이미지·마스크·페이드 수명주기 묶음이다. */
export interface PopupBackgroundImage {
  image: Phaser.GameObjects.Image;
  mask: Phaser.Display.Masks.GeometryMask;
  maskGraphics: Phaser.GameObjects.Graphics;
  fade: Phaser.GameObjects.Graphics;
  /** 부모 팝업의 이동·회전·배율을 마스크에 즉시 다시 투영한다. */
  syncMask: () => void;
  destroy: () => void;
}

/** 팝업 원화를 프레임에 맞추는 두 가지 공용 배치 의도다. */
export type PopupBackgroundFit = "cover" | "native-center";

/**
 * 공용 배경 키를 팝업 내부에 cover 배치한다.
 * 원화를 별도 판처럼 자르지 않고 한 장으로 이으며, 상단은 옅고 하단은 짙은 청흑색 막과
 * 가장자리 비네트만 더해 히어로와 조작면의 대비를 동시에 확보한다.
 */
export function addPopupBackgroundImage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  texture: string,
  bounds: {
    x: number; y: number; width: number; height: number;
    maskShape?: readonly number[];
    /** `native-center`는 원본 배율을 보존한 채 원화 중심과 팝업 프레임 중심을 일치시켜 자른다. */
    fit?: PopupBackgroundFit;
    /** 클리핑 액자는 그대로 두고 원화에서 보여 줄 부분만 옮길 때 쓰는 로컬 오프셋이다. */
    imageOffsetX?: number;
    imageOffsetY?: number;
    /** 여러 원화를 합성할 때 아래 원경을 남기는 이미지 투명도다. */
    imageAlpha?: number;
    /** 행·본문 대비에 맞춰 공용 청흑색 페이드와 비네트의 세기를 조절한다. */
    overlayStrength?: number;
  },
): PopupBackgroundImage {
  // 이미지와 마스크 모두 bounds의 같은 로컬 중심을 쓴다. native-center의 crop도 이 중심에서 대칭이다.
  const ready = scene.textures.exists(texture);
  const image = scene.add.image(bounds.x + (bounds.imageOffsetX ?? 0), bounds.y + (bounds.imageOffsetY ?? 0), ready ? texture : "__DEFAULT");
  const fitImage = (target: Phaser.GameObjects.Image): void => {
    if ((bounds.fit ?? "cover") === "cover") target.setScale(Math.max(bounds.width / target.width, bounds.height / target.height));
    target.setAlpha(bounds.imageAlpha ?? 1);
  };
  image.setAlpha(ready ? (bounds.imageAlpha ?? 1) : 0);
  useBackgroundTexture(scene, image, texture, fitImage);
  parent.add(image);

  // GeometryMask는 Container 변환을 자동 상속하지 않으므로 렌더 직전마다 월드 좌표를 맞춘다.
  const maskGraphics = scene.make.graphics({});
  const mask = maskGraphics.createGeometryMask();
  image.setMask(mask);
  const syncMask = (): void => {
    if (!parent.active || !maskGraphics.active) return;
    const matrix = parent.getWorldTransformMatrix();
    maskGraphics.clear().fillStyle(0xffffff, 1);
    if (bounds.maskShape) {
      // 팝업 실루엣을 받으면 원화를 별도 직사각 판으로 보이게 하는 모서리 돌출까지 잘라 낸다.
      const points: Phaser.Geom.Point[] = [];
      for (let index = 0; index < bounds.maskShape.length; index += 2) {
        const point = matrix.transformPoint(bounds.x + bounds.maskShape[index], bounds.y + bounds.maskShape[index + 1]);
        points.push(new Phaser.Geom.Point(point.x, point.y));
      }
      maskGraphics.fillPoints(points, true);
    } else {
      // 회전된 팝업에 axis-aligned fillRect를 쓰면 원화만 기울기를 무시한 사각형으로 잘린다.
      // 네 꼭짓점을 모두 월드 변환해 팝업의 회전·스케일을 그대로 따르는 닫힌 면을 만든다.
      const corners = [
        [-bounds.width / 2, -bounds.height / 2], [bounds.width / 2, -bounds.height / 2],
        [bounds.width / 2, bounds.height / 2], [-bounds.width / 2, bounds.height / 2],
      ].map(([x, y]) => {
        const point = matrix.transformPoint(bounds.x + x, bounds.y + y);
        return new Phaser.Geom.Point(point.x, point.y);
      });
      maskGraphics.fillPoints(corners, true);
    }
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncMask);
  syncMask();

  // HOLO 유리 토큰을 기준으로 상단 히어로는 밝게 남기고 하단 조작부만 더 눌러 한 장으로 잇는다.
  const fade = scene.add.graphics();
  const overlayStrength = bounds.overlayStrength ?? 1;
  fade.fillGradientStyle(COLOR.void, COLOR.void, COLOR.void, COLOR.void, HOLO.glassLight * 0.34 * overlayStrength, HOLO.glassLight * 0.34 * overlayStrength, HOLO.glass * overlayStrength, HOLO.glass * overlayStrength);
  fade.fillRect(bounds.x - bounds.width / 2, bounds.y - bounds.height / 2, bounds.width, bounds.height);
  // 사각 띠를 겹쳐 중앙으로 갈수록 옅게 만들어 새 색을 만들지 않고 청흑색 비네트를 표현한다.
  const vignetteBands = 9;
  for (let band = 0; band < vignetteBands; band += 1) {
    const inset = band * 12;
    fade.lineStyle(24, COLOR.void, ((HOLO.glassLight * (vignetteBands - band)) / vignetteBands / 2) * overlayStrength);
    fade.strokeRect(bounds.x - bounds.width / 2 + inset, bounds.y - bounds.height / 2 + inset, bounds.width - inset * 2, bounds.height - inset * 2);
  }
  // 오버레이도 원화와 같은 마스크를 공유해 팝업 모서리 밖에 청흑색 사각형이 남지 않게 한다.
  fade.setMask(mask);
  parent.add(fade);

  return {
    image, mask, maskGraphics, fade, syncMask,
    destroy: () => {
      // 마스크는 표시 객체의 자식이 아니므로 이벤트, Mask, Graphics, 이미지 순으로 명시 정리한다.
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncMask);
      if (image.active) image.clearMask(false);
      if (fade.active) fade.clearMask(false);
      mask.destroy();
      if (maskGraphics.active) maskGraphics.destroy();
      if (fade.active) fade.destroy();
      if (image.active) image.destroy();
    },
  };
}
