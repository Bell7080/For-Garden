import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 길드 화면의 자리 — 1080×1920 기준 월드 좌표. 친구 화면과 같은 틀(제목 → 요약 → 조작 줄 → 본문, 좌하단 라벨 탭)을 쓴다.
 * 오른쪽 아래는 공용 뒤로가기 자리라 비워 둔다.
 */
export const GUILD_SCREEN = {
  side: 75,
  width: BASE_WIDTH - 150,
  title: { x: 54, y: 76 },
  summary: { y: 186 },
  controls: { y: 270, height: 68 },
  body: { top: 340, bottom: 1730 },
  row: { height: 156, gap: 14 },
  tabs: { y: BASE_HEIGHT - 96, width: 200, height: 84, gap: 14 },
} as const;

/** 라벨 탭 `index`의 가운데 x. */
export function guildTabX(index: number): number {
  const { width, gap } = GUILD_SCREEN.tabs;
  return GUILD_SCREEN.side + width / 2 + index * (width + gap);
}

/** 목록 줄 `index`의 가운데 y — 목록 컨테이너 안의 좌표다. */
export function guildRowY(index: number): number {
  const { height, gap } = GUILD_SCREEN.row;
  return index * (height + gap) + height / 2;
}

/** 줄 수에서 끌어 올릴 수 있는 한계(음수). 창보다 짧으면 0이다. */
export function guildMinScroll(rows: number): number {
  const { top, bottom } = GUILD_SCREEN.body;
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

/** 정보 탭의 자리. 위에서부터 뱃지·이름 → 부흥도 → 혜택 → 공지 → 내 정보, 맨 아래 조작. */
export const GUILD_INFO = {
  badge: { x: 190, y: 470, size: 240 },
  name: { x: 340, y: 410 },
  level: { x: 340, y: 476 },
  capacity: { x: 340, y: 532 },
  leader: { x: 340, y: 582 },
  bar: { y: 690, height: 30 },
  barText: { y: 740 },
  perks: { y: 830, gap: 52 },
  notice: { y: 1010, height: 260 },
  me: { y: 1340 },
  actions: { y: 1500, width: 280, height: 84, gap: 20 },
} as const;

/** 출석 탭의 자리. 도장 일곱 칸이 한 줄이고 그 아래에 고르는 두 버튼이 선다. */
export const GUILD_ATTENDANCE = {
  slots: { y: 560, height: 240, gap: 10 },
  info: { y: 910 },
  pick: { y: 1080, width: 440, height: 150, gap: 50 },
  bonus: { y: 1280 },
} as const;

/** 출석 칸 `index`의 가운데 x와 폭. */
export function guildStampSlot(index: number): { x: number; width: number } {
  const { gap } = GUILD_ATTENDANCE.slots;
  const width = (GUILD_SCREEN.width - gap * 6) / 7;
  return { x: GUILD_SCREEN.side + width / 2 + index * (width + gap), width };
}

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
