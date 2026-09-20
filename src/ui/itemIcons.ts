/**
 * 소비품·재료 아이콘의 로딩 표.
 *
 * 재화 아이콘과 **같은 규격으로 구운 WebP**를 쓴다(`scripts/prepare_icons.py`) — 가방 칸과
 * 스테미나 창이 같은 액자(`addFramedIcon`)에 넣으므로, 한쪽만 다른 파이프라인을 타면 같은
 * 자리에서 그림 크기가 갈린다. 아직 원화가 오지 않은 것만 임시 SVG로 남는다.
 */
export const ITEM_ICON_ASSETS = [
  ["item-stamina-tonic", "sprites/items/stamina-tonic.webp"],
  ["item-stamina-tonic-large", "sprites/items/stamina-tonic-large.webp"],
  ["item-rune-dust", "sprites/items/rune-dust.svg"],
] as const;
