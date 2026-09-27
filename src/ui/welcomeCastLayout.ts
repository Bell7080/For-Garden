import { LAB_CHROME, LAB_TITLE } from "./labLayout";

/**
 * 첫 복원 연구 원화 위에 서는 SSR 넷의 자리와 그 둘레의 반짝임.
 *
 * 원화는 인물 없이 비워 둔 방이라 **누가 나오는 판인지를 SD가 말한다.** 한 줄로 세우면 단체
 * 사진처럼 딱딱해 **바깥 둘은 앞(크게·낮게), 안쪽 둘은 뒤(작게·높게)**로 엇갈려 서로 조금씩
 * 겹치고, 바깥 둘은 가운데를 향해 돌아선다. 몸 뒤에는 같은 몸을 검게 두 겹 비껴 세운 복제
 * 그림자(`echo`)가 따라 움직인다. 이름은 판 없이 **발밑에 속성 색 글자**로만 선다 — 판을 받치면
 * 원화 위에 라벨이 붙은 것처럼 읽힌다. 이름줄은 SSR 확정 판(`LAB_CHROME.pity`)보다 위에서 끝나고
 * 머리는 제목 라벨 줄 아래에서 시작한다. 순서는 배너의 `castRelicIds` 순서 그대로
 * 왼쪽 앞 → 왼쪽 뒤 → 오른쪽 뒤 → 오른쪽 앞이다.
 */
export const WELCOME_CAST = {
  spots: [
    { x: 215, groundY: 1182, height: 500, flipX: true },
    { x: 410, groundY: 950, height: 420, flipX: false },
    { x: 670, groundY: 950, height: 420, flipX: false },
    { x: 865, groundY: 1182, height: 500, flipX: false },
  ],
  /** 발밑 그림자 폭은 SD 키에 비례한다. */
  shadowRatio: 0.62,
  /**
   * 복제 그림자 — 같은 몸을 검게 비껴 세운 겹. 화면 바깥쪽과 위로 비껴(`dx`는 가운데에서 멀어지는
   * 쪽으로 부호가 붙는다) 무리가 가운데로 모여 선 것처럼 뒤로 깊이가 생긴다. 겹마다 더 멀고 옅다.
   */
  echo: [
    { dx: 22, dy: -12, alpha: 0.3 },
    { dx: 44, dy: -24, alpha: 0.14 },
  ],
  /** 발밑 이름 — 판 없이 속성 색 글자에 검은 획만 두른다. 돋보기는 이름 오른쪽에 붙는다. */
  name: { dy: 36, size: 36, stroke: 8, lift: 0.28, magnifierGap: 16, magnifierSize: 22, hit: 64 },
  /** 눌렀을 때 톡 뛰는 높이(정보창은 그 뒤에 연다). */
  hop: { height: 34, duration: 150 },
  /** 들어올 때 차례로 톡 떨어지는 간격(ms). */
  enterStagger: 90,
  depth: LAB_CHROME.depth.panels - 1,
} as const;

/**
 * 방을 채우는 반짝임 — 네 갈래 별이 제자리에서 톡 켜졌다 꺼진다.
 *
 * 난수를 쓰지 않는다. 자리·크기·색·박자는 번호에서 정해 같은 화면은 늘 같은 반짝임이고, 넷에
 * 한 번씩은 SD 앞(`front`)에 서서 무리 둘레에도 빛이 묻는다. 동그라미는 쓰지 않는다.
 */
export const WELCOME_SPARKLE = {
  count: 36,
  /** 흩뿌릴 사각 — 제목 아래부터 SSR 확정 판 위까지. */
  area: { left: 60, right: 1020, top: 430, bottom: 1230 },
  size: { min: 16, max: 42 },
  /**
   * 분홍 · 금빛 · 하늘빛 · 연보라 — 방의 원화 색에서 골랐다. 벽이 밝은 크림빛이라 겹쳐 밝아지는
   * 합성은 벽에 묻혀 사라지므로 보통 합성에 채도를 조금 올린 색을 쓴다.
   */
  colors: [0xff8fc4, 0xffc93c, 0x6fc8ff, 0xc39bff],
  alpha: 0.95,
  duration: { min: 900, max: 1700 },
  gap: { min: 200, max: 1400 },
  frontEvery: 4,
} as const;

export interface SparkleSpot {
  x: number;
  y: number;
  size: number;
  color: number;
  duration: number;
  delay: number;
  front: boolean;
}

/** 번호에서 반짝임 하나의 자리·크기·색·박자를 정한다(난수 없음). */
export function welcomeSparkle(index: number): SparkleSpot {
  const { area, size, colors, duration, gap, frontEvery } = WELCOME_SPARKLE;
  // 황금비 수열로 칸을 고르게 흩는다 — 같은 번호는 늘 같은 자리에 선다.
  const u = fract(index * 0.618_034 + 0.13);
  const v = fract(index * 0.754_877 + 0.41);
  const w = fract(index * 0.569_840 + 0.77);
  return {
    x: Math.round(area.left + (area.right - area.left) * u),
    y: Math.round(area.top + (area.bottom - area.top) * v),
    size: Math.round(size.min + (size.max - size.min) * w),
    color: colors[index % colors.length],
    duration: Math.round(duration.min + (duration.max - duration.min) * v),
    delay: Math.round(gap.min + (gap.max - gap.min) * u),
    front: index % frontEvery === frontEvery - 1,
  };
}

function fract(value: number): number {
  return value - Math.floor(value);
}

/** 이름줄 가운데 자리. */
export function welcomeCastNameY(index: number): number {
  return WELCOME_CAST.spots[index].groundY + WELCOME_CAST.name.dy;
}

/** 가장 높은 머리끝 — 제목 라벨 줄보다 아래여야 한다(복제 그림자가 비껴 오르는 몫 포함). */
export function welcomeCastTop(): number {
  const lift = Math.max(...WELCOME_CAST.echo.map((step) => -step.dy));
  return Math.min(...WELCOME_CAST.spots.map((spot) => spot.groundY - spot.height - lift));
}

/** 가장 낮은 이름줄의 밑변 — SSR 확정 판 윗변보다 위여야 한다. */
export function welcomeCastBottom(): number {
  const { name } = WELCOME_CAST;
  return Math.max(...WELCOME_CAST.spots.map((_, index) => welcomeCastNameY(index))) + name.size / 2 + name.stroke / 2;
}

/** 제목 라벨 줄의 밑변. */
export function labTitleTagsBottom(): number {
  return LAB_TITLE.tagY + LAB_TITLE.tagHeight / 2;
}

/** SSR 확정 판의 윗변. */
export function labPityTop(): number {
  return LAB_CHROME.pity.y - LAB_CHROME.pity.height / 2;
}
