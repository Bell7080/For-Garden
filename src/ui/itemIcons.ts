/**
 * 소비품·재료 아이콘의 로딩 표.
 *
 * 재화 아이콘과 **같은 규격으로 구운 WebP**를 쓴다(`scripts/prepare_icons.py`) — 가방 칸과
 * 스테미나 창이 같은 액자(`addFramedIcon`)에 넣으므로, 한쪽만 다른 파이프라인을 타면 같은
 * 자리에서 그림 크기가 갈린다. 아직 원화가 오지 않은 것만 임시 SVG로 남는다.
 *
 * **그래서 목록이 둘이다**(UI 아이콘과 같은 이유·같은 방법이다). 구운 WebP를 SVG 목록에
 * 섞어 두면 로딩 단계가 그것까지 `load.svg`로 읽는데, Phaser의 SVG 처리기는 `<svg>` 루트를
 * 찾지 못하면 **예외를 던지고 그 예외를 아무도 받지 않는다** — 로더의 파일 줄이 거기서 끊겨
 * `complete`가 영영 오지 않고, 그 단계를 기다리던 타이틀이 **진행률 50%에서 멎는다.**
 * 조용히 빈 텍스처가 되는 정도가 아니라 게임이 시작되지 않는다(스테미나 토닉 두 장이 실제로
 * 그랬다). 새 아이콘을 더할 때는 **확장자를 보고** 둘 중 맞는 표에 넣는다.
 */
export const ITEM_ICON_ASSETS = [
  ["item-rune-dust", "sprites/items/rune-dust.svg"],
] as const;

/** 이미 구워 둔 WebP로 오는 아이콘. 벡터가 아니라 그림 한 장이라 그대로 읽는다. */
export const ITEM_RASTER_ICON_ASSETS = [
  ["item-stamina-tonic", "sprites/items/stamina-tonic.webp"],
  ["item-stamina-tonic-large", "sprites/items/stamina-tonic-large.webp"],
] as const;
