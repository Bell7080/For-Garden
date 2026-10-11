import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 친구 화면의 자리 — 1080×1920 기준 월드 좌표. 세 탭(친구·신청·찾기)이 같은 틀을 쓴다.
 * 위에서부터 **제목 → 요약 줄 → 조작 줄 → 목록**이고, 아래는 좌하단 라벨 탭이다. 오른쪽 아래는 공용 뒤로가기 자리라 비워 둔다.
 */
export const FRIENDS_SCREEN = {
  side: 75,
  width: BASE_WIDTH - 150,
  title: { x: 54, y: 76 },
  /** 요약 줄(친구 수·신청 수·검색 결과 수). 조작이 아니라 지금 상태만 말한다. */
  summary: { y: 186 },
  /** 필터·정렬·검색 칸이 서는 줄. */
  controls: { y: 270, height: 68 },
  list: { top: 340, bottom: 1730 },
  row: { height: 168, gap: 14 },
  tabs: { y: BASE_HEIGHT - 96, width: 240, height: 84, gap: 16 },
} as const;

/** 라벨 탭 `index`의 가운데 x. */
export function friendsTabX(index: number): number {
  const { width, gap } = FRIENDS_SCREEN.tabs;
  return FRIENDS_SCREEN.side + width / 2 + index * (width + gap);
}

/** 목록 줄 `index`의 가운데 y — 목록 컨테이너 안의 좌표다. */
export function friendsRowY(index: number): number {
  const { height, gap } = FRIENDS_SCREEN.row;
  return index * (height + gap) + height / 2;
}

/** 줄 수에서 끌어 올릴 수 있는 한계(음수). 창보다 짧으면 0이다. */
export function friendsMinScroll(rows: number): number {
  const { top, bottom } = FRIENDS_SCREEN.list;
  const { height, gap } = FRIENDS_SCREEN.row;
  const content = rows > 0 ? rows * (height + gap) - gap : 0;
  return Math.min(0, bottom - top - content);
}

/**
 * 줄 안의 자리 — 줄 가운데가 0이다. 글은 왼쪽에서 오른쪽 조작 칸 앞까지만 선다.
 * 오른쪽에는 **버튼이 있는 줄**(신청·찾기)과 **마지막 접속이 서는 줄**(친구)이 갈린다.
 */
export const FRIEND_ROW = {
  avatar: { x: -355, size: 112 },
  /** 접속 중 초록 원 — 얼굴 오른쪽 아래 모서리에 걸친다. */
  online: { dx: 42, dy: 42, radius: 14 },
  textX: -275,
  nameY: -44,
  levelY: -4,
  bioY: 40,
  /** 줄 오른쪽 안쪽 여백. */
  padRight: 28,
  /** 친구 줄의 별(즐겨찾기) 입력면과 마지막 접속 글자. */
  star: { size: 84, y: -34 },
  age: { y: 52, room: 190 },
  button: { width: 150, height: 68, gap: 12 },
} as const;

const HALF_ROW = FRIENDS_SCREEN.width / 2;

/** 오른쪽에서부터 세운 버튼 `index`(0이 왼쪽)의 가운데 x. */
export function friendRowButtonX(index: number, count: number): number {
  const { width, gap } = FRIEND_ROW.button;
  return HALF_ROW - FRIEND_ROW.padRight - width / 2 - (count - 1 - index) * (width + gap);
}

/** 글이 설 수 있는 오른쪽 끝(줄 안 좌표). 버튼이 `buttons`개면 맨 왼쪽 버튼 앞, 친구 줄(0)이면 별·접속 글자 앞이다. */
export function friendRowTextRight(buttons: number): number {
  if (buttons === 0) return HALF_ROW - FRIEND_ROW.age.room;
  return friendRowButtonX(0, buttons) - FRIEND_ROW.button.width / 2 - 24;
}

/** 별 입력면의 가운데 x. */
export function friendRowStarX(): number {
  return HALF_ROW - FRIEND_ROW.padRight - FRIEND_ROW.star.size / 2;
}

/** 조작 줄의 칩 규격. */
export const FRIENDS_CONTROLS = {
  filter: { width: 170, height: 64, gap: 12 },
  subTab: { width: 240, height: 64, gap: 12 },
  bulk: { width: 180, height: 64, gap: 12 },
  mode: { width: 150, height: 64, gap: 12 },
  search: { width: 160, height: 64, gap: 12 },
  /** 정렬 칩과 방향 칩(도감과 같은 한 장). */
  sort: { width: 240, dirWidth: 80, gap: 12 },
} as const;

/** 왼쪽에서부터 같은 폭의 칩 `index`의 가운데 x. */
export function friendsChipX(index: number, chip: { width: number; gap: number }): number {
  return FRIENDS_SCREEN.side + chip.width / 2 + index * (chip.width + chip.gap);
}

/** 오른쪽 끝에서부터 같은 폭의 칩 `index`(0이 왼쪽)의 가운데 x. */
export function friendsChipXFromRight(index: number, count: number, chip: { width: number; gap: number }): number {
  return FRIENDS_SCREEN.side + FRIENDS_SCREEN.width - chip.width / 2 - (count - 1 - index) * (chip.width + chip.gap);
}

/** 정렬 칩의 가운데 x — 방향 칩이 오른쪽 끝에 닿는다. */
export function friendsSortX(): number {
  const { width, dirWidth, gap } = FRIENDS_CONTROLS.sort;
  return FRIENDS_SCREEN.side + FRIENDS_SCREEN.width - dirWidth - gap - width / 2;
}

/** 찾기 줄: 방식 칩 둘 · 입력 칸 · 검색 버튼. 입력 칸은 남은 폭을 모두 쓴다. */
export function friendsSearchRow(): { modeX: (index: number) => number; input: { x: number; width: number }; button: { x: number } } {
  const { mode, search } = FRIENDS_CONTROLS;
  const left = FRIENDS_SCREEN.side + 2 * mode.width + mode.gap + 16;
  const right = FRIENDS_SCREEN.side + FRIENDS_SCREEN.width - search.width - search.gap;
  return {
    modeX: (index) => friendsChipX(index, mode),
    input: { x: (left + right) / 2, width: right - left },
    button: { x: FRIENDS_SCREEN.side + FRIENDS_SCREEN.width - search.width / 2 },
  };
}
