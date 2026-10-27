import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 길드 화면의 자리 — 1080×1920 기준 월드 좌표. 위에서부터 상단 재화 줄 → 제목·탈퇴 칩 → 요약 → 조작 줄 → 본문이고,
 * 맨 아래에 **큰 탭 셋**(정보 · 길드전 · 수호전)이, 그 바로 위에 정보 안의 **작은 탭**(정보 · 멤버)이 선다.
 * 오른쪽 아래는 공용 뒤로가기 자리라 비워 둔다.
 */
export const GUILD_SCREEN = {
  side: 75,
  width: BASE_WIDTH - 150,
  title: { x: 54, y: 168 },
  /** 오른쪽 위 작은 칩 — 다른 길드 찾기·탈퇴를 여는 창의 입구. */
  menuChip: { right: BASE_WIDTH - 40, y: 168, width: 170, height: 60 },
  summary: { y: 244 },
  controls: { y: 320, height: 68 },
  /** 길드가 있으면 작은 탭 위까지, 없으면 큰 탭이 없으니 화면 밑동까지 목록이 흐른다. */
  body: { top: 390, bottom: 1620, browseBottom: 1760 },
  row: { height: 156, gap: 14 },
  /** 정보 안의 작은 탭(정보 · 멤버). */
  tabs: { y: 1690, width: 200, height: 72, gap: 14 },
  /** 화면을 가르는 큰 탭(정보 · 길드전 · 수호전) — 뒤로가기(왼쪽 끝 920)를 피해 셋이 나눠 선다. */
  pages: { y: BASE_HEIGHT - 96, width: 262, height: 96, gap: 14, labelSize: 34 },
} as const;

/** 작은 탭 `index`의 가운데 x. */
export function guildTabX(index: number): number {
  const { width, gap } = GUILD_SCREEN.tabs;
  return GUILD_SCREEN.side + width / 2 + index * (width + gap);
}

/** 큰 탭 `index`의 가운데 x. */
export function guildPageX(index: number): number {
  const { width, gap } = GUILD_SCREEN.pages;
  return GUILD_SCREEN.side + width / 2 + index * (width + gap);
}

/** 목록 줄 `index`의 가운데 y — 목록 컨테이너 안의 좌표다. */
export function guildRowY(index: number): number {
  const { height, gap } = GUILD_SCREEN.row;
  return index * (height + gap) + height / 2;
}

/** 줄 수에서 끌어 올릴 수 있는 한계(음수). 창보다 짧으면 0이다. */
export function guildMinScroll(rows: number, bottom: number = GUILD_SCREEN.body.bottom): number {
  const { top } = GUILD_SCREEN.body;
  const { height, gap } = GUILD_SCREEN.row;
  const content = rows > 0 ? rows * (height + gap) - gap : 0;
  return Math.min(0, bottom - top - content);
}

/** 줄 안의 자리 — 줄 가운데가 0이다. */
export const GUILD_ROW = {
  badge: { x: -360, size: 112 },
  textX: -280,
  nameY: -38,
  subY: 6,
  noteY: 46,
  button: { width: 170, height: 72, padRight: 28 },
} as const;

/** 줄 오른쪽 끝에서 `index`번째(0이 오른쪽 끝) 버튼의 가운데 x. */
export function guildRowButtonX(index: number): number {
  const { width, padRight } = GUILD_ROW.button;
  return GUILD_SCREEN.width / 2 - padRight - width / 2 - index * (width + 12);
}

/**
 * 정보 탭의 자리. 왼쪽 옆줄에 길드 순위·길드 상점 칩이 서고(`rail` — 연구소·고고학 상점과 같은 자리), 내용은 그 오른쪽에서
 * 시작한다. 위에서부터 뱃지·이름 → 부흥도 → 혜택 → 공지 → 내 정보, 맨 아래 조작.
 */
export const GUILD_INFO = {
  rail: { x: 84, size: 104, ranking: 470, shop: 620 },
  left: 170,
  width: GUILD_SCREEN.side + GUILD_SCREEN.width - 170,
  badge: { x: 290, y: 480, size: 220 },
  name: { x: 425, y: 418 },
  level: { x: 425, y: 482 },
  capacity: { x: 425, y: 536 },
  leader: { x: 425, y: 584 },
  bar: { y: 690, height: 30 },
  barText: { y: 740 },
  perks: { y: 820, gap: 50 },
  notice: { y: 940, height: 250 },
  /** 길드 전용 플레이어 카드 — 윗변 y와 높이. 안쪽 자리는 카드 가운데 기준이다. */
  card: { y: 1212, height: 176, avatar: 104 },
  actions: { y: 1452, width: 280, height: 84, gap: 20 },
} as const;

/**
 * 출석 도장 레이어 — 창 가운데가 0이다. 맨 위에 기여도 경쟁 줄 둘(나 · 바로 위 한 사람)이 서고, 그 아래 일곱 칸이
 * 위 넷 · 아래 셋으로 서며, 7일차 칸은 아래 줄 끝에서 한 뼘 크다.
 */
export const GUILD_ATTENDANCE = {
  width: 920,
  height: 1160,
  race: { rows: [-424, -326], width: 820, height: 86, avatar: 64 },
  cell: { width: 200, height: 230, gap: 14 },
  rows: [-40, 220],
  info: 430,
  hint: 520,
  stampSize: 120,
} as const;

/** 출석 칸 `index`(0~6)의 가운데 — 위 줄 넷, 아래 줄 셋. */
export function guildStampSlot(index: number): { x: number; y: number; width: number; height: number } {
  const { cell, rows } = GUILD_ATTENDANCE;
  const top = index < 4;
  const count = top ? 4 : 3;
  const at = top ? index : index - 4;
  const last = index === 6;
  const widths = Array.from({ length: count }, (_, i) => (!top && i === 2 ? cell.width + 70 : cell.width));
  const span = widths.reduce((sum, w) => sum + w, 0) + cell.gap * (count - 1);
  const x = -span / 2 + widths.slice(0, at).reduce((sum, w) => sum + w + cell.gap, 0) + widths[at] / 2;
  return { x, y: rows[top ? 0 : 1], width: widths[at], height: last ? cell.height + 10 : cell.height };
}

/**
 * 출석 칸 하나의 보상 줄 — 그날 보상 액자 · `+` · 길드 코인 액자. 칸 폭 안에 셋이 들도록 칸 폭에서 거꾸로 잡는다.
 * 코인 액자는 한 뼘 작아 주인공이 그날 보상임을 크기가 말한다.
 */
export function guildStampRewardPair(cellWidth: number, last: boolean): { mainX: number; mainSize: number; plusX: number; coinX: number; coinSize: number } {
  const mainSize = last ? 104 : 88;
  const coinSize = last ? 72 : 62;
  const plus = 26;
  const span = mainSize + plus + coinSize;
  const left = -Math.min(span, cellWidth - 16) / 2;
  const mainX = left + mainSize / 2;
  const plusX = left + mainSize + plus / 2;
  const coinX = left + mainSize + plus + coinSize / 2;
  return { mainX, mainSize, plusX, coinX, coinSize };
}

/** 길드전·수호전 쪽 — 큰 판 하나에 지금 단계와 남은 시간, 그 아래 줄들. */
export const GUILD_EVENT_PAGE = {
  plate: { y: 760, height: 620 },
  heading: 520,
  phase: 610,
  timer: 690,
  lines: { y: 800, gap: 56 },
  note: 1180,
} as const;

/** 길드 만들기·뱃지 창의 자리 — 창 가운데가 0이다. */
export const GUILD_EDITOR = {
  width: 900,
  nameLabel: -520, nameInput: -450,
  joinMode: -350,
  preview: { y: -190, size: 230 },
  cyclers: { top: 10, gap: 84 },
  note: 400,
  submit: 490,
} as const;
