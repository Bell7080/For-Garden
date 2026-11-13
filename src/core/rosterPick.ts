/**
 * 편성 목록의 카드를 누른 손이 **목록을 굴리는 손인지, 카드를 집어 칸으로 끄는 손인지**를 가른다.
 *
 * 목록은 세로로만 흐르므로 세로 끌기는 스크롤에게 먼저 준다. 카드를 집는 것은 셋 중 하나다 —
 * 손끝이 목록 창 위로 빠져나가 편성판 쪽으로 올라갔을 때(스크롤로 시작했어도 그 순간 집는다),
 * 목록이 흐를 것이 없을 때, 처음 움직임이 가로였을 때. 누름으로 가르는 꾹 누르기는 정보창이 이미
 * 쓰므로 여기서는 쓰지 않는다.
 */
export type RosterPickIntent = "pending" | "scroll" | "pick";

export interface RosterPickInput {
  dx: number;
  dy: number;
  /** 지금 손끝의 화면 y. */
  pointerY: number;
  /** 목록 창 윗변. 이보다 위로 올라가면 편성판 쪽이다. */
  viewportTop: number;
  /** 목록이 굴러갈 만큼 긴지. */
  scrollable: boolean;
  /** 이미 스크롤로 정해진 손인지. 그때는 창 위로 빠져나갈 때만 집는다. */
  scrolling: boolean;
  slop: number;
}

export function rosterPickIntent(input: RosterPickInput): RosterPickIntent {
  if (input.pointerY < input.viewportTop) return "pick";
  if (input.scrolling) return "scroll";
  if (Math.hypot(input.dx, input.dy) < input.slop) return "pending";
  if (!input.scrollable) return "pick";
  return Math.abs(input.dx) > Math.abs(input.dy) ? "pick" : "scroll";
}
