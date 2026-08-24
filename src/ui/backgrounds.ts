import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

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
  /** 발굴 연출이 덮는 발굴장. 검은 판 대신 이 원화를 깔고 그 위를 눌러 어둡게 한다. */
  excavation: "background-excavation",
  /** 캐릭터 카드 안, 인물 뒤에 깔리는 원화. 등급색 필터를 통과해 은은하게만 남는다. */
  cardBackdrop: "background-card-backdrop",
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
  [BACKGROUND.excavation, "sprites/background/background_009.webp"],
  [BACKGROUND.cardBackdrop, "sprites/background/background_010.webp"],
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
  destroy: () => void;
}

/**
 * 공용 배경 키를 팝업의 제한된 히어로 영역에 cover 배치한다.
 * 전체 화면 연출을 복제하지 않고 같은 비율 계산을 쓰되, 외곽 액자 대신 직사각 마스크와
 * 아래로 짙어지는 어두운 페이드만 더해 뒤의 정보가 자연스럽게 이어지게 한다.
 */
export function addPopupBackgroundImage(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  texture: string,
  bounds: { x: number; y: number; width: number; height: number },
): PopupBackgroundImage {
  // 원화는 슬롯 뒤 한 겹에만 놓고 원본 비율을 유지한 채 히어로 영역을 빈틈없이 채운다.
  const image = scene.add.image(bounds.x, bounds.y, texture);
  image.setScale(Math.max(bounds.width / image.width, bounds.height / image.height));
  parent.add(image);

  // GeometryMask는 Container 변환을 자동 상속하지 않으므로 렌더 직전마다 월드 좌표를 맞춘다.
  const maskGraphics = scene.make.graphics({});
  const mask = maskGraphics.createGeometryMask();
  image.setMask(mask);
  const syncMask = (): void => {
    if (!parent.active || !maskGraphics.active) return;
    const matrix = parent.getWorldTransformMatrix();
    const topLeft = matrix.transformPoint(bounds.x - bounds.width / 2, bounds.y - bounds.height / 2);
    maskGraphics.clear().fillStyle(0xffffff, 1).fillRect(topLeft.x, topLeft.y, bounds.width * matrix.scaleX, bounds.height * matrix.scaleY);
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, syncMask);
  syncMask();

  // 하단의 어두운 페이드는 원화를 검은 판으로 끊지 않고 정보 영역의 유리면으로 녹여 보낸다.
  const fade = scene.add.graphics();
  fade.fillGradientStyle(0x080b10, 0x080b10, 0x080b10, 0x080b10, 0.04, 0.04, 0.94, 0.94);
  fade.fillRect(bounds.x - bounds.width / 2, bounds.y - bounds.height / 2, bounds.width, bounds.height);
  parent.add(fade);

  return {
    image, mask, maskGraphics, fade,
    destroy: () => {
      // 마스크는 표시 객체의 자식이 아니므로 이벤트, Mask, Graphics, 이미지 순으로 명시 정리한다.
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, syncMask);
      if (image.active) image.clearMask(false);
      mask.destroy();
      if (maskGraphics.active) maskGraphics.destroy();
      if (fade.active) fade.destroy();
      if (image.active) image.destroy();
    },
  };
}
