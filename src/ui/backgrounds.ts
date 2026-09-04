import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { HOLO } from "./holo";
import { COLOR } from "./theme";

/** 화면 용도별 배경 키. 파일 번호와 실제 사용처의 대응을 한 곳에서 관리한다. */
export const BACKGROUND = {
  lobby: "background-lobby",
  relics: "background-relics",
  info: "background-info",
  battleArea: "background-battle-area",
  lab: "background-lab",
  /** 편성부터 실제 전투까지 이어지는 6번 전장 원화다. */
  combat: "background-combat",
  /** 스테이지 진행과 함께 아래에서 위로 움직이는 장축 지도 원화다. */
  stageMap: "background-stage-map",
  /** 화석을 손질하는 작업실. 장기 탐사(고고학) 전용이다. */
  archaeology: "background-archaeology",
  /** 유료 상점의 흰 쇼케이스. 인게임 재화 교환소(무역)와는 다른 자리다. */
  premiumShop: "background-premium-shop",
  /** 일반 상품과 성장 재화를 진열하는 상점 쇼케이스 배경 키다. */
  shop: "background-shop",
  /** 발굴 연출이 덮는 발굴장. 검은 판 대신 이 원화를 깔고 그 위를 눌러 어둡게 한다. */
  excavation: "background-excavation",
  /** 캐릭터 카드 안, 인물 뒤에 깔리는 원화. 등급색 필터를 통과해 은은하게만 남는다. */
  cardBackdrop: "background-card-backdrop",
  /** 진행 중인 원정에서 층과 분기를 고르는 전용 상승 지도다(Content2_001map). */
  expeditionMap: "background-expedition-map",
  /** 원정 노드에 진입한 뒤 교전 UI 아래에 까는 전용 전투 필드다(Content2_001field). */
  expeditionField: "background-expedition-field",
  /** 인물이 없는 침수 도시 원경이다(Content2_001background). 기록 화면과 순위 팝업의 환경층을 맡는다. */
  expeditionRanking: "background-expedition-ranking",
  /** 케이크 대작전 진입 화면 배경이다(Content3_001background). */
  sortieCake: "background-sortie-cake",
  /** 현상수배 진입 화면 배경이다(Content4_001background). */
  sortieBounty: "background-sortie-bounty",
  /** 레이드 진입 화면 배경이다(Content5_001background). */
  sortieRaid: "background-sortie-raid",
  /**
   * 타이틀(로딩) 화면 전용 원화다. 화면 자체가 로딩 화면이라 다른 배경처럼 이 표의
   * `BACKGROUND_ASSETS`(로딩 단계 안에서 읽힘)로 적재할 수 없다 — `TitleScene`이
   * 씬 진입 직후 이 키로 직접 읽는다.
   */
  title: "background-title",
} as const;

/** BootScene이 모든 화면 배경을 한 번에 적재할 때 사용하는 경로 목록이다. */
export const BACKGROUND_ASSETS = [
  // 일반 배경 스프라이트는 PuppetForge 번들과 분리한 공용 자산 경로에서 읽는다.
  [BACKGROUND.lobby, "sprites/background/background_001.webp"],
  [BACKGROUND.relics, "sprites/background/background_002.webp"],
  [BACKGROUND.info, "sprites/background/background_003.webp"],
  [BACKGROUND.battleArea, "sprites/background/background_004.webp"],
  // 5번 원화는 발굴 설비가 있는 연구소 전용 배경이다.
  [BACKGROUND.lab, "sprites/background/background_005.webp"],
  [BACKGROUND.combat, "sprites/background/background_006.webp"],
  [BACKGROUND.stageMap, "sprites/background/map_001.webp"],
  [BACKGROUND.archaeology, "sprites/background/background_007.webp"],
  [BACKGROUND.premiumShop, "sprites/background/background_008.webp"],
  // 일반 상점은 완성된 흰 쇼케이스 원화를 쓰되 유료 상점과 독립된 texture key를 유지한다.
  [BACKGROUND.shop, "sprites/background/background_008.webp"],
  [BACKGROUND.excavation, "sprites/background/background_009.webp"],
  [BACKGROUND.cardBackdrop, "sprites/background/background_010.webp"],
  // 원정 지도 WebP는 화면 배경 표가 키와 경로를 단독 소유하며 원본 복제본을 만들지 않는다.
  [BACKGROUND.expeditionMap, "sprites/content/Content2_001map.webp"],
  // 원정 전투 필드 WebP도 이미 배포 형식이므로 그대로 적재한다.
  [BACKGROUND.expeditionField, "sprites/content/Content2_001field.webp"],
  // 아래 세 콘텐츠의 배경 WebP도 같은 이유로 그대로 적재한다.
  [BACKGROUND.expeditionRanking, "sprites/content/Content2_001background.webp"],
  [BACKGROUND.sortieCake, "sprites/content/Content3_001background.webp"],
  [BACKGROUND.sortieBounty, "sprites/content/Content4_001background.webp"],
  [BACKGROUND.sortieRaid, "sprites/content/Content5_001background.webp"],
] as const;

/**
 * 세로 원화를 비율 왜곡 없이 화면 전체에 cover 배치한다.
 * UI 글자의 대비는 각 화면의 별도 반투명 패널이 담당하므로 원화 자체는 손대지 않는다.
 */
export function addSceneBackground(
  scene: Phaser.Scene,
  texture: string,
  depth = -30,
): Phaser.GameObjects.Image {
  const image = scene.add.image(BASE_WIDTH / 2, BASE_HEIGHT / 2, texture).setDepth(depth);
  const coverScale = Math.max(BASE_WIDTH / image.width, BASE_HEIGHT / image.height);
  return image.setScale(coverScale);
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
  const image = scene.add.image(bounds.x + (bounds.imageOffsetX ?? 0), bounds.y + (bounds.imageOffsetY ?? 0), texture);
  if ((bounds.fit ?? "cover") === "cover") image.setScale(Math.max(bounds.width / image.width, bounds.height / image.height));
  image.setAlpha(bounds.imageAlpha ?? 1);
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
