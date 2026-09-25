import Phaser from "phaser";
import { ITEM_ICON_FALLBACK, type ItemIcon } from "../data/items";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { drawGlyph } from "./glyphs";
import { COLOR } from "./theme";

/**
 * 아이템 정의의 그림 한 장 — 재화 아이콘 → 아이템 원화 → 글리프 순서로 찾는다.
 *
 * 가방 칸과 아이템 안내창이 **같은 함수**를 쓴다. 따로 두면 원화가 없는 재료가 한쪽에서는 글리프로,
 * 다른 쪽에서는 빈 칸으로 선다. `shadow`는 같은 그림을 검게 눌러 뒤에 까는 복제본이라 실루엣 모양대로
 * 그늘이 지고 액자 안에 네모난 판이 하나 더 생기지 않는다. 쓴 텍스처 키는 `onTexture`로 알린다.
 */
export function addItemDefinitionIcon(
  scene: Phaser.Scene,
  icon: ItemIcon,
  x: number,
  y: number,
  size: number,
  options: { shadow?: boolean; onTexture?: (key: string) => void } = {},
): Phaser.GameObjects.GameObject {
  const shadow = options.shadow ?? false;
  const shade = (object: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics): Phaser.GameObjects.GameObject =>
    shadow ? object.setAlpha(0.5) : object;
  const image = (key: string): Phaser.GameObjects.GameObject => {
    options.onTexture?.(key);
    const sprite = scene.add.image(x, y, key).setDisplaySize(size, size);
    return shade(shadow ? sprite.setTint(0x000000) : sprite);
  };
  if (icon.kind === "currency") return image(CURRENCY_ICON_BY_WALLET[icon.key]);
  if (icon.kind === "asset" && scene.textures.exists(icon.key)) return image(icon.key);
  // 정의 glyph와 누락 asset의 공용 glyph를 마지막 경로로만 사용한다.
  return shade(drawGlyph(scene, icon.kind === "glyph" ? icon.key : ITEM_ICON_FALLBACK, x, y, size * 0.7, shadow ? 0x000000 : COLOR.accent));
}
