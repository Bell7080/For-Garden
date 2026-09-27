import { LAB_CHROME, LAB_TITLE } from "./labLayout";

/**
 * 첫 복원 연구 원화 위에 서는 SSR 넷의 자리.
 *
 * 원화는 인물 없이 비워 둔 방이라 **누가 나오는 판인지를 SD가 말한다.** 한 줄로 세우면 단체
 * 사진처럼 딱딱해 **바깥 둘은 앞(크게·낮게), 안쪽 둘은 뒤(작게·높게)**로 엇갈려 서로 조금씩
 * 겹치고, 바깥 둘은 가운데를 향해 돌아선다. 이름표는 발밑 판이 아니라 **머리 위에 떠 있는
 * 꼬리 달린 표**다 — SD에게 딸린 말풍선처럼 읽혀야 그 이름이 누구의 것인지 따로 짚지 않아도 된다.
 * 발끝은 SSR 확정 판(`LAB_CHROME.pity`)보다 위에서 끝나고, 뒷줄 이름표는 제목 라벨 줄 아래에 선다.
 * 순서는 배너의 `castRelicIds` 순서 그대로 왼쪽 앞 → 왼쪽 뒤 → 오른쪽 뒤 → 오른쪽 앞이다.
 */
export const WELCOME_CAST = {
  spots: [
    { x: 225, groundY: 1232, height: 500, flipX: true },
    { x: 400, groundY: 972, height: 420, flipX: false },
    { x: 680, groundY: 972, height: 420, flipX: false },
    { x: 855, groundY: 1232, height: 500, flipX: false },
  ],
  /** 발밑 그림자 폭은 SD 키에 비례한다. */
  shadowRatio: 0.62,
  /**
   * 머리 위 이름표. 가운데가 머리끝에서 `gap`만큼 위에 서고 아래로 꼬리(`tail`)가 SD를 가리킨다.
   * 면은 그 개체의 속성 색을 어둡게 누른 색이라 이름표만 봐도 속성이 먼저 읽힌다.
   */
  tag: {
    gap: 34, width: 220, height: 60, slant: 16, nameSize: 30,
    tail: { width: 26, height: 16 },
    /** 속성 색을 이만큼 검정 쪽으로 눌러 면을 칠한다 — 흰 이름이 어느 속성 위에서도 읽히게. */
    shade: 0.5,
    /** 왼쪽 끝에 걸리는 속성 뱃지, 왼쪽 위 모서리에 걸리는 SSR 보석 칩, 오른쪽 끝의 돋보기. */
    badge: { size: 54, dx: -108 },
    rarity: { dx: -70, dy: -36, width: 66, height: 28, size: 21, angle: -8 },
    magnifier: { dx: 108, radius: 20, glyph: 20, hit: 70 },
    /** 둥실 떠 있는 폭과 한 번 오르내리는 시간. */
    bob: { distance: 6, duration: 1400 },
  },
  /** 눌렀을 때 톡 뛰는 높이(정보창은 그 뒤에 연다). */
  hop: { height: 34, duration: 150 },
  /** 들어올 때 차례로 톡 떨어지는 간격(ms). */
  enterStagger: 90,
  depth: LAB_CHROME.depth.panels - 1,
} as const;

/** 이름표 가운데 자리. */
export function welcomeCastTagY(index: number): number {
  const spot = WELCOME_CAST.spots[index];
  return spot.groundY - spot.height - WELCOME_CAST.tag.gap - WELCOME_CAST.tag.height / 2;
}

/** 가장 높은 이름표(SSR 칩 포함)의 윗변 — 제목 라벨 줄보다 아래여야 한다. */
export function welcomeCastTop(): number {
  const { tag } = WELCOME_CAST;
  return Math.min(...WELCOME_CAST.spots.map((_, index) => welcomeCastTagY(index) + tag.rarity.dy - tag.rarity.height / 2 - bobReach()));
}

/** 가장 낮은 발끝 — SSR 확정 판 윗변보다 위여야 한다. */
export function welcomeCastBottom(): number {
  return Math.max(...WELCOME_CAST.spots.map((spot) => spot.groundY));
}

/** 제목 라벨 줄의 밑변. */
export function labTitleTagsBottom(): number {
  return LAB_TITLE.tagY + LAB_TITLE.tagHeight / 2;
}

/** SSR 확정 판의 윗변. */
export function labPityTop(): number {
  return LAB_CHROME.pity.y - LAB_CHROME.pity.height / 2;
}

/** 이름표가 가운데에서 좌우로 뻗는 폭(뱃지·돋보기 포함). */
export function welcomeCastTagReach(): number {
  const { tag } = WELCOME_CAST;
  return Math.max(tag.width / 2, -tag.badge.dx + tag.badge.size / 2, tag.magnifier.dx + tag.magnifier.radius);
}

function bobReach(): number {
  return WELCOME_CAST.tag.bob.distance;
}
