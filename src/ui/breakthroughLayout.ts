/**
 * 한계 돌파 두 창의 **순수 배치표**.
 *
 * 창이 둘이다 — 별 옆의 버튼이 여는 **확정 창**(드는 재료와 열리는 효과 하나)과, 등급 돋보기가
 * 여는 **표**(별 다섯까지 무엇이 열리는지 한눈에)다. 두 창의 값을 한 파일에 두는 이유는 같은
 * 기능의 두 얼굴이라, 한쪽만 고치면 같은 별이 창마다 다른 것을 말하기 때문이다.
 *
 * 모든 `y`는 **판 윗변에서 아래로 잰 거리(px)**다. 화면은 `판 중심 - 높이/2`에 이 값을 더한다.
 * 높이를 손으로 적지 않고 쌓인 내용에서 거꾸로 구하는 것도 다른 판과 같다.
 */
import { BASE_HEIGHT } from "../config/gameConfig";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";

/**
 * 확정 창 — 드는 재료 셋과 이 별에서 열리는 효과 한 줄.
 *
 * 「돌파하기」는 액자 밑의 두 줄(이름·`필요 N`)보다 충분히 내려앉아야 한다. 붙이면 버튼 판이
 * 그 글자를 파고들어 요구 수치가 버튼에 눌린 것처럼 보인다.
 *
 * **버튼 아래에 열리는 효과를 적지 않는다.** 그 문장은 등급 돋보기가 여는 표와 그 기술의 스킬
 * 쪽지가 이미 말하고(돌파로 붙은 줄은 노란 글씨로 따로 선다), 확정 창에서 읽어야 하는 것은
 * "무엇이 들고 무엇이 확정되는가"다 — 궁금하면 어디서든 열 수 있는 설명을 이 자리에 다시 두면
 * 판만 길어진다.
 */
export const BREAK_CONFIRM = {
  width: 780,
  gradeY: 112,
  gradeSize: 96,
  /**
   * 상한 줄과 「돌파하기」는 **위쪽 덩어리에서 한 뼘씩 더 내려앉는다.**
   *
   * 등급 표식 바로 아래에 붙이면 세 줄(등급 · 상한 · 액자)이 한 덩어리로 뭉쳐 어느 것이
   * 무엇을 말하는지 갈라 읽히지 않고, 버튼도 액자 밑 두 줄(이름·`필요 N`)을 파고들어 요구
   * 수치가 눌린 것처럼 보인다. 판 높이는 버튼 아래 여백에서 거꾸로 잡는다.
   */
  capY: 236,
  costY: 396,
  costFrame: 124,
  costStep: 236,
  actionY: 612,
  action: { width: 420, height: 88 },
  /** 버튼 아래끝에서 판 밑변까지. 이보다 넓으면 빈 판이 한 뼘 더 길어 보인다. */
  actionBottomMargin: 64,
} as const;

/** 확정 창의 높이는 버튼 아래 여백에서 거꾸로 나온다. 화면이 높이를 손으로 적지 않는다. */
export function breakConfirmHeight(): number {
  return BREAK_CONFIRM.actionY + BREAK_CONFIRM.action.height / 2 + BREAK_CONFIRM.actionBottomMargin;
}

/**
 * 표 — **별마다 무엇이 열리는가**만 읽는 창이다.
 *
 * 여기에는 파편 수도, 가진 파편도, 별 몇 개인지도 적지 않는다. 그 셋은 **확정 창**이 이미
 * 말하고(액자 셋과 `필요 N`), 여기서 다시 말하면 같은 수가 두 창에 서서 어느 쪽이 맞는지
 * 물어보게 된다. 이 창이 맡는 것은 "다섯까지 키우면 이 개체가 무엇을 얻는가" 하나다.
 *
 * 안내 문구도 두지 않는다 — "연구소에서 같은 개체를 다시 획득하면 파편이 쌓인다" 같은 설명은
 * 규칙을 옮겨 적은 것이라 플레이어가 지금 할 일을 바꾸지 않는다(화면 문구 규칙).
 */
export const BREAK_STEPS = {
  /** 설명이 두 줄로 들어갈 만큼 넓다. 좁으면 네 줄이 모두 세 줄짜리 문단이 된다. */
  width: 980,
  /** 판 가운데가 앉는 화면 y. 돋보기 자리에 붙이지 않고 **화면 가운데**에 세운다. */
  centerY: BASE_HEIGHT / 2,
  /** 줄 판이 판 좌우에서 안으로 들어오는 여백(양쪽 합). */
  rowInset: 88,
  /** 첫 줄 가운데. 제목표 띠와 깎인 모서리를 함께 피한다. */
  firstRowY: 196,
  /**
   * 줄 한 장의 높이와 줄 간격.
   *
   * 글을 키운 만큼 줄이 함께 자란다 — 27px 넉 줄이 들어가야 가장 긴 설명(폭주 돌파)이 줄 판
   * 밖으로 흐르지 않고, 줄 사이도 그만큼 벌려야 네 장이 한 덩어리로 뭉쳐 보이지 않는다.
   * 판 높이는 이 둘에서 거꾸로 나오므로 값을 키우면 창이 저절로 세로로 늘어난다.
   */
  row: { height: 168, step: 200 },
  /**
   * 열린 줄과 아직 안 열린 줄의 색.
   *
   * **아직 안 열린 줄도 또렷하게 읽혀야 한다.** 별 하나로 시작하는 개체는 네 줄이 **모두**
   * 안 열린 줄이라, 그 줄을 어둡게 눌러 두면 이 창을 처음 여는 사람이 캄캄한 판 넷을 본다 —
   * 정작 여기서 읽어야 하는 것이 "다섯까지 키우면 무엇을 얻는가"인데 그것만 안 보이는 셈이다.
   *
   * 그래서 **가른 것은 밝기가 아니라 결**이다: 열린 줄은 따뜻한 호박빛 면과 밝은 윗선을 얻고,
   * 안 열린 줄은 차가운 남색 면에 흐린 윗선을 얻는다. 글과 그림의 진하기는 둘이 거의 같다 —
   * 어느 쪽이든 읽으러 온 내용이기 때문이다. "어디까지 왔는가"는 별 표식이 말한다.
   */
  tone: {
    reached: { fill: 0x2a2418, alpha: 0.95, edgeAlpha: 0.9, gradeMark: 1 },
    locked: { fill: 0x161d27, alpha: 0.92, edgeAlpha: 0.42, gradeMark: 0.5 },
  },
  /**
   * 아직 안 열린 줄의 스킬 액자 진하기.
   *
   * 액자는 그 줄의 **주제**라 알아볼 수 있어야 한다. 예전 0.42는 어느 기술이 열리는지 그림으로
   * 읽을 수 없었다 — 이 창에서 액자를 세운 이유가 사라진다.
   */
  lockedIconAlpha: 0.82,
  /** 줄 안에서 돌파 등급 표식이 서는 자리와 크기. */
  gradeMark: { x: -368, size: 32 },
  /** 줄 안에서 스킬 액자가 서는 자리와 크기. */
  icon: { x: -262, size: 108 },
  /** 설명 글이 시작하는 x와 줄 오른쪽 변에서 남기는 여백. */
  textX: -176,
  textRightMargin: 26,
  /**
   * 설명 글 크기.
   *
   * 이 창에서 읽으러 온 것이 **그 문장 하나**다. 23px은 판이 980이나 되는데도 네 줄이 작은
   * 각주처럼 보였다 — 줄 사이를 넓히고(step) 글을 키운 만큼 판이 세로로 함께 자란다.
   */
  textSize: 27,
  /** 마지막 줄 아래끝에서 판 밑변까지. */
  bottomMargin: 56,
} as const;

/** 표 한 장의 자리. `y`는 모두 판 윗변 기준이다. */
export interface BreakthroughStepsLayout {
  height: number;
  rowWidth: number;
  rows: readonly number[];
  /** 설명 글이 넘지 않아야 하는 폭. */
  textWrap: number;
}

/** 단계 수에서 표의 높이와 모든 줄 자리를 구한다. */
export function breakthroughStepsLayout(stepCount: number): BreakthroughStepsLayout {
  const panel = BREAK_STEPS;
  const rows = Array.from({ length: Math.max(0, stepCount) }, (_, index) => panel.firstRowY + index * panel.row.step);
  const lastBottom = (rows.at(-1) ?? panel.firstRowY) + panel.row.height / 2;
  const rowWidth = panel.width - panel.rowInset;
  return {
    height: lastBottom + panel.bottomMargin,
    rowWidth,
    // 설명은 줄 판 안에서 오른쪽 여백까지만 흐른다.
    textWrap: rowWidth / 2 - panel.textRightMargin - panel.textX,
    rows,
  };
}

/**
 * 표의 첫 줄이 깎인 왼쪽 위 모서리를 피하는지.
 *
 * 판이 980 × (4단계에서 714)이라 깎임은 짧은 변(714)의 14% — 100px이다. 돌파 등급 표식은 줄의 가장
 * 왼쪽에 서므로 그 점이 대각선 안에 들어야 한다.
 */
export function stepsFirstRowClearsBevel(layout: BreakthroughStepsLayout): boolean {
  const bevel = Math.min(BREAK_STEPS.width, layout.height) * POPUP_BODY_BEVEL_RATIO;
  const rowTop = (layout.rows[0] ?? BREAK_STEPS.firstRowY) - BREAK_STEPS.row.height / 2;
  const markLeft = BREAK_STEPS.gradeMark.x - BREAK_STEPS.gradeMark.size;
  // 깎임보다 아래에서 시작하면 왼쪽 변이 직선이므로 줄 판 폭만 지키면 된다.
  if (rowTop >= bevel) return markLeft >= -BREAK_STEPS.width / 2;
  return markLeft >= -BREAK_STEPS.width / 2 + (bevel - rowTop);
}
