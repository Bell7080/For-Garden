import { BASE_HEIGHT } from "../config/gameConfig";

/** 하단 탭의 윗변(`BottomNav`의 `NAV_TOP`과 같은 값 — Phaser 없이 읽히도록 여기서 다시 구한다). */
const NAV_TOP = BASE_HEIGHT - 180;

/**
 * 연구소 화면의 자리.
 *
 * 모집 원화가 곧 배경이라 그 위에 탁한 막을 두르지 않고 **양옆만** 누른다(`vignette`). 확률 정보는
 * 왼쪽 위의 흐린 글줄이고, 연구 버튼 둘 위에 **SSR 확정까지** 판이 한 뼘 떠 선다.
 */
export const LAB_CHROME = {
  vignette: { band: 260, strength: 0.55 },
  /**
   * 배경 층 순서 — **비네트는 녹아 드는 원화보다 늘 위다.** 비네트와 녹아 드는 원화가 같은
   * 깊이(-29)였을 때는 나중에 세운 원화가 비네트를 덮고 올라오다 녹기가 끝나는 순간 -30으로
   * 내려가, 비네트가 한 박자 늦게 **툭** 켜졌다. 다른 탭은 원화와 비네트가 처음부터 같은 순서로
   * 서서 함께 밝아진다.
   */
  depth: { art: -30, incomingArt: -29, vignette: -28 },
  rates: { x: 36, y: 180 },
  pull: { y: NAV_TOP - 240, size: { width: 420, height: 150 }, oneTone: 0x7cc7ef, tenTone: 0xf58fb4 },
  pity: { y: NAV_TOP - 440, width: 560, height: 84 },
} as const;

/** 확정 판이 버튼(눌린 두께 12 포함)과 겹치지 않고, 그 아래 픽업 한 줄이 들어갈 틈이 남는지. */
export function labPityGap(): number {
  const pullTop = LAB_CHROME.pull.y - LAB_CHROME.pull.size.height / 2;
  const noteBottom = LAB_CHROME.pity.y + LAB_CHROME.pity.height / 2 + 26 + 14;
  return pullTop - noteBottom;
}

