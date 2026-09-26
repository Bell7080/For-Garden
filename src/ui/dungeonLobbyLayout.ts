import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 던전 입구(현상수배·치즈케이크 대작전)의 **세로 좌표 소유자**.
 *
 * 두 화면은 같은 일을 한다 — 단계를 고르고, 출격하거나 몇 번 소탕할지 골라 소탕한다. 각자 배치표를
 * 갖던 때는 현상수배만 아래에 편성 칸을 세우고 대작전만 배율 칩을 세워, 같은 손짓이 화면마다
 * 다른 자리에 섰다. 이제 한 표를 읽고, 편성은 두 곳 모두 **스토리와 같은 편성 화면**이 맡는다.
 *
 * **아래 세 줄(요약 판 · 소탕 횟수 · 조작)은 목록 길이와 무관하게 같은 자리에 선다.** 목록 밑변에서
 * 거꾸로 쌓으면 단계가 다섯인 현상수배와 여덟인 대작전의 요약 판이 서로 다른 높이에 서서,
 * "같은 양식"이 자리부터 갈린다. 목록은 그 위에서 끝나야 하며 테스트가 그것을 지킨다.
 *
 * Phaser를 모르는 순수 표다 — 화면과 회귀 테스트가 같은 값을 읽는다.
 */
export const DUNGEON_LOBBY = {
  title: { x: 72, y: 190 },
  /** 목록 첫 줄의 **윗변**. */
  listTop: 250,
  row: {
    width: 920,
    height: 118,
    gap: 10,
    /** 줄 왼쪽 안쪽 여백 — 이름과 레벨이 서는 자리다. */
    padding: 34,
    /** 한 판의 보상 액자. 줄 오른쪽 끝에 선다. */
    rewardSize: 84,
    /** 그 판에 서는 적 얼굴(현상수배의 세 라운드). 보상 액자 왼쪽으로 늘어선다. */
    faceSize: 78,
    faceGap: 90,
  },
  /**
   * 고른 단계의 **적 전투력 · 보상** 판.
   *
   * 현상수배 아래에 서던 "출전 순서" 자리를 이 판이 맡는다. 순서는 편성 화면이 이미 적과 나란히
   * 보여 주므로 입구에서는 **들어갈지 말지를 정하는 두 수**만 남긴다.
   *
   * 두 이름표는 판 안의 회색 글자가 아니라 **판 윗변에 걸터앉는 제목표**다(`addSectionTitle`) —
   * 다른 판의 제목과 같은 위계라 같은 양식으로 선다. 그 표가 판 위로 반 뼘 솟으므로 목록은
   * 그 끝(`dungeonSummaryTitleTop`)보다 위에서 끝난다.
   */
  summary: {
    y: 1378, width: 920, height: 136, titleGap: 24,
    /** 적 속성 뱃지 — 적 전투력 줄의 오른쪽 끝(가르는 선 앞)에서 왼쪽으로 늘어선다. */
    element: { size: 38, step: 42, rightInset: 24 },
  },
  /**
   * 소탕 횟수 줄. 왼쪽은 **− 횟수 + MAX**, 오른쪽은 (멤버십이 없으면) **소탕권과 광고 버튼**이다.
   *
   * 한때 이 자리에 x1·x2·x3 배율 칩이 섰다. 소탕이 횟수를 고를 수 있으면 배율은 "한 번에 여러
   * 판"을 두 번 말하는 손잡이라 걷어 냈다 — 스테미나를 한 번에 녹이는 일은 이 줄이 맡는다.
   */
  sweep: { y: 1508, height: 92, left: 80, right: BASE_WIDTH - 80, step: 92, count: 130, max: 130, gap: 14, ticket: 84, ad: 230 },
  action: { y: 1650, width: 400, height: 116, gap: 32 },
} as const;

/** 줄 `index`(0부터)의 중심 y. */
export function dungeonRowCenterY(index: number): number {
  const { listTop, row } = DUNGEON_LOBBY;
  return listTop + row.height / 2 + index * (row.height + row.gap);
}

/** 목록이 끝나는 세로 좌표(마지막 줄의 **밑변**). */
export function dungeonListBottom(count: number): number {
  const { listTop, row } = DUNGEON_LOBBY;
  return listTop + count * row.height + Math.max(0, count - 1) * row.gap;
}

/** 요약 판의 윗변. 목록은 그보다 위에서 끝나야 한다. */
export function dungeonSummaryTop(): number {
  return DUNGEON_LOBBY.summary.y - DUNGEON_LOBBY.summary.height / 2;
}

/** 요약 판의 제목표가 솟는 끝. 제목표(글자 34 → 높이 52)가 윗변 4px 위에 걸터앉는다. */
export function dungeonSummaryTitleTop(): number {
  return dungeonSummaryTop() - 4 - Math.round(34 * 1.52) / 2;
}

/** 소탕 횟수 줄의 각 조작의 중심 x. 왼쪽 묶음은 줄 왼쪽 끝에서, 오른쪽 묶음은 오른쪽 끝에서 쌓는다. */
export function dungeonSweepControlX(): { minus: number; count: number; plus: number; max: number; ticket: number; ad: number } {
  const { left, right, step, count, max, gap, ticket, ad } = DUNGEON_LOBBY.sweep;
  const minus = left + step / 2;
  const countX = minus + step / 2 + gap + count / 2;
  const plus = countX + count / 2 + gap + step / 2;
  const maxX = plus + step / 2 + gap + max / 2;
  const adX = right - ad / 2;
  const ticketX = adX - ad / 2 - gap - ticket / 2;
  return { minus, count: countX, plus, max: maxX, ticket: ticketX, ad: adX };
}

/** 조작 버튼 `index`의 중심 x(0 = 출격, 1 = 소탕). */
export function dungeonActionButtonX(index: number): number {
  const { width, gap } = DUNGEON_LOBBY.action;
  const span = 2 * width + gap;
  return BASE_WIDTH / 2 - span / 2 + width / 2 + index * (width + gap);
}

/** 조작 줄 밑변이 우하단 뒤로가기 윗변보다 위인가. */
export function dungeonActionFitsAboveBackButton(): boolean {
  const bottom = DUNGEON_LOBBY.action.y + DUNGEON_LOBBY.action.height / 2;
  return bottom <= BACK_SLOT.y - BACK_BUTTON_SIZE / 2 && bottom <= BASE_HEIGHT;
}

/** 줄 안에서 `slot`번째 적 얼굴의 x(줄 중심 기준). 보상 액자 왼쪽에서부터 왼쪽으로 늘어선다. */
export function dungeonRowFaceX(slot: number, count: number): number {
  const { width, padding, rewardSize, faceGap } = DUNGEON_LOBBY.row;
  const right = width / 2 - padding - rewardSize - 36;
  return right - (count - 1 - slot) * faceGap - DUNGEON_LOBBY.row.faceSize / 2;
}
