import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** 화면 용도별 배경 키. 파일 번호와 실제 사용처의 대응을 한 곳에서 관리한다. */
export const BACKGROUND = {
  lobby: "background-lobby",
  relics: "background-relics",
  info: "background-info",
  battleArea: "background-battle-area",
} as const;

/** BootScene이 모든 화면 배경을 한 번에 적재할 때 사용하는 경로 목록이다. */
export const BACKGROUND_ASSETS = [
  // 일반 배경 스프라이트는 PuppetForge 번들과 분리한 공용 자산 경로에서 읽는다.
  [BACKGROUND.lobby, "sprites/background/background_001.webp"],
  [BACKGROUND.relics, "sprites/background/background_002.webp"],
  [BACKGROUND.info, "sprites/background/background_003.webp"],
  [BACKGROUND.battleArea, "sprites/background/background_004.webp"],
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
