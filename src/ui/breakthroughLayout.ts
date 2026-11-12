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
  /** 만능 파편이 함께 쓰여 칸이 넷일 때의 간격 — 바깥 액자가 판 안에 들게 좁힌다. */
  costStepCompact: 186,
  /** 만능 파편이 함께 소모된다는 한 줄. 상한 줄과 액자 사이에 선다. */
  universalNoticeY: 298,
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
 * 표 — **돌파 단계마다 무엇이 열리는가**를 카드 넷으로 읽는 창이다.
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
  /** 첫 카드 가운데(최소 높이 기준). 제목표 띠와 깎인 모서리를 함께 피한다. */
  firstRowY: 212,
  /**
   * 카드 한 장의 최소 높이와 카드 간격.
   *
   * 카드는 **머리 띠 + 몸통**이다. 머리 띠(`header`)에는 돌파 등급 · 슬롯 이름 · 스킬 이름 · 능력치 성장 ·
   * 요구 레벨이 한 줄로 서고, 몸통에는 스킬 액자와 열리는 효과 문장이 선다. height는 최소 높이이고 실제
   * 효과 문장의 높이와 위아래 여백을 재서 더 긴 카드만 늘린다. step과 height의 차이가 카드 사이 여백이다.
   */
  row: { height: 184, step: 216 },
  /** 카드 머리 띠의 높이. */
  header: 56,
  textPadY: 20,
  /**
   * 열린 카드와 아직 안 열린 카드의 색.
   *
   * **아직 안 열린 카드도 또렷하게 읽혀야 한다.** 돌파 등급 I로 시작하는 개체는 넷이 **모두** 안 열린
   * 카드라, 어둡게 눌러 두면 이 창을 처음 여는 사람이 캄캄한 판 넷을 본다. 그래서 **가른 것은 밝기가 아니라
   * 결**이다: 열린 카드는 따뜻한 호박빛 면과 밝은 머리 띠, 안 열린 카드는 차가운 남색 면에 흐린 머리 띠를
   * 얻는다. 글과 그림의 진하기는 둘이 거의 같다 — 어느 쪽이든 읽으러 온 내용이다.
   */
  tone: {
    reached: { fill: 0x2a2418, alpha: 0.95, edgeAlpha: 0.9, gradeMark: 1, header: 0x4a3b1c, headerAlpha: 0.85 },
    locked: { fill: 0x161d27, alpha: 0.92, edgeAlpha: 0.42, gradeMark: 0.55, header: 0x1f2a38, headerAlpha: 0.9 },
    /**
     * 뚫어 두었지만 **꺼진** 카드 — 레벨 초기화로 요구 레벨에 못 미친 단계(`activeBreakthrough`).
     * 호박빛도 남색도 아닌 잿빛이라 "아직 안 뚫음"과도 "켜져 있음"과도 갈린다.
     */
    dormant: { fill: 0x1e2024, alpha: 0.94, edgeAlpha: 0.28, gradeMark: 1, header: 0x2c2f35, headerAlpha: 0.9 },
  },
  /** 다음에 뚫을 카드 — 테두리 안쪽에서 강조 빛이 느리게 숨 쉰다(움직임 줄이기에서는 멈춘 빛). */
  next: { glowStrength: 0.42, breatheMs: 1100, tagHeight: 34, tagSize: 20, tagPadX: 18, tagLift: 5 },
  /** 아직 안 열린 카드의 스킬 액자 진하기 — 액자는 그 카드의 주제라 알아볼 수 있어야 한다. */
  lockedIconAlpha: 0.82,
  /** 머리 띠 안에서 돌파 등급 표식이 서는 자리와 크기. */
  gradeMark: { x: -402, size: 30 },
  /** 머리 띠의 글 — 슬롯 이름(작고 흐림)과 스킬 이름(크고 굵게). */
  headerText: { x: -360, slotSize: 21, nameSize: 28, gap: 12 },
  /** 머리 띠 오른쪽 — 요구 레벨 칩과 능력치 성장. 오른쪽 변에서 남기는 여백과 둘 사이 간격. */
  headerRight: { margin: 22, levelSize: 24, growthSize: 20, gap: 22 },
  /** 꺼진 카드의 「필요 LV.N」 크기. 요구 레벨 칩 자리에 선다. */
  dormantNeed: { size: 20 },
  /** 몸통 안에서 스킬 액자가 서는 자리와 크기. */
  icon: { x: -380, size: 100 },
  /** 설명 글이 시작하는 x와 줄 오른쪽 변에서 남기는 여백. */
  textX: -310,
  textRightMargin: 26,
  /** 설명 글 크기 — 이 창에서 읽으러 온 것이 그 문장 하나다. */
  textSize: 26,
  /** 마지막 줄 아래끝에서 판 밑변까지. */
  bottomMargin: 56,
} as const;

/** 표 한 장의 자리. `y`는 모두 판 윗변 기준이다. */
export interface BreakthroughStepsLayout {
  height: number;
  rowWidth: number;
  rows: readonly number[];
  rowHeights: readonly number[];
  /** 설명 글이 넘지 않아야 하는 폭. */
  textWrap: number;
}

/** 단계 수에서 표의 높이와 모든 줄 자리를 구한다. */
export function breakthroughStepsLayout(stepCount: number, textHeights: readonly number[] = []): BreakthroughStepsLayout {
  const panel = BREAK_STEPS;
  const rowHeights = Array.from({ length: Math.max(0, stepCount) }, (_, index) =>
    Math.max(panel.row.height, panel.header + Math.ceil((textHeights[index] ?? 0) + panel.textPadY * 2)));
  const rows: number[] = [];
  let nextTop = panel.firstRowY - panel.row.height / 2;
  for (const height of rowHeights) {
    rows.push(nextTop + height / 2);
    nextTop += height + panel.row.step - panel.row.height;
  }
  const lastBottom = (rows.at(-1) ?? panel.firstRowY) + (rowHeights.at(-1) ?? panel.row.height) / 2;
  const rowWidth = panel.width - panel.rowInset;
  return {
    height: lastBottom + panel.bottomMargin,
    rowWidth,
    // 설명은 줄 판 안에서 오른쪽 여백까지만 흐른다.
    textWrap: rowWidth / 2 - panel.textRightMargin - panel.textX,
    rows,
    rowHeights,
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
  const rowTop = (layout.rows[0] ?? BREAK_STEPS.firstRowY) - (layout.rowHeights[0] ?? BREAK_STEPS.row.height) / 2;
  const markLeft = BREAK_STEPS.gradeMark.x - BREAK_STEPS.gradeMark.size;
  // 깎임보다 아래에서 시작하면 왼쪽 변이 직선이므로 줄 판 폭만 지키면 된다.
  if (rowTop >= bevel) return markLeft >= -BREAK_STEPS.width / 2;
  return markLeft >= -BREAK_STEPS.width / 2 + (bevel - rowTop);
}
