/**
 * 화면 왼쪽 가장자리에 접혀 들어가는 **곁 버튼 서랍**의 자리(순수 값 — Phaser 없이 테스트가 읽는다).
 *
 * 고고학 발굴판은 화면 폭을 다 쓰는 주인공이라, 지도에서 왼쪽 중상단에 서던 곁 상점 칩(`SIDE_SHOP.screen`)이
 * 판의 왼쪽 위 칸·무대 유리와 겹쳤다. 판 칸은 파고 나면 입력면이 사라지므로 **그 아래 상점 칩이 손을 받아**
 * 발굴하던 손이 상점으로 튕겨 나갔다(응태 2026-11-24). 판이 서 있는 동안 곁 버튼은 서랍으로 들어가고,
 * 가장자리의 손잡이를 눌러야 밀려 나온다 — 판과 서랍이 같은 자리를 나눠 쓰지 않는다.
 */
export const SIDE_DRAWER = {
  /** 서랍 가운데의 세로 자리. 제목 줄 아래·굴착 게이지 판 왼쪽 빈 자리이고, 판 칸(가장 높은 판 윗변 360)보다 위다. */
  y: 300,
  /** 서랍 안 칩의 한 변(곁 상점 칩과 같은 크기). */
  item: 104,
  /** 화면 왼쪽 끝에서 첫 칩까지. */
  pad: 20,
  /** 칩과 손잡이 사이. */
  gap: 12,
  /** 손잡이 — 닫혀 있을 때 화면 가장자리에 이것만 남는다. */
  handle: { width: 46, height: 104 },
  /** 여닫는 시간(ms). 움직임 줄이기에서는 0이다. */
  duration: 220,
} as const;

export interface SideDrawerBox { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }

/** 서랍 안 칩 하나의 가운데 x(서랍 컨테이너 기준). */
export function sideDrawerItemX(index: number): number {
  return SIDE_DRAWER.pad + SIDE_DRAWER.item / 2 + index * (SIDE_DRAWER.item + SIDE_DRAWER.gap);
}

/** 칩 `count`개를 품은 서랍에서 손잡이 가운데 x(서랍 컨테이너 기준). */
export function sideDrawerHandleX(count: number): number {
  return SIDE_DRAWER.pad + count * (SIDE_DRAWER.item + SIDE_DRAWER.gap) + SIDE_DRAWER.handle.width / 2;
}

/** 서랍 컨테이너의 x — 닫히면 손잡이만 화면 왼쪽 끝에 남도록 칩 몫만큼 화면 밖으로 밀린다. */
export function sideDrawerOffsetX(count: number, open: boolean): number {
  return open ? 0 : -(SIDE_DRAWER.pad + count * (SIDE_DRAWER.item + SIDE_DRAWER.gap));
}

/** 화면에서 서랍이 실제로 차지하는 상자(손잡이 포함). 닫혀 있으면 손잡이만이다. */
export function sideDrawerBounds(count: number, open: boolean): SideDrawerBox {
  const offset = sideDrawerOffsetX(count, open);
  const half = Math.max(SIDE_DRAWER.item, SIDE_DRAWER.handle.height) / 2;
  return {
    left: Math.max(0, offset),
    right: offset + sideDrawerHandleX(count) + SIDE_DRAWER.handle.width / 2,
    top: SIDE_DRAWER.y - half,
    bottom: SIDE_DRAWER.y + half,
  };
}
