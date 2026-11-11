import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 전투의 「스킬 한눈에 보기」 판 자리.
 *
 * 판은 화면 위쪽에 바짝 붙여 크게 세운다 — 아군 셋의 네 칸(패시브·일반 공격·궁극기·폭주)을 한 번에 읽는
 * 판이라 글자를 줄이기보다 판을 키우는 편이 낫다. 밑변은 판 밖 우하단 뒤로가기의 윗변보다 위에서 끊는다.
 * 이 표는 Phaser를 읽지 않아 테스트가 같은 값을 잰다.
 */
export const SKILL_GLANCE = {
  width: 980,
  /** 판이 커질 수 있는 끝. 내용이 짧으면 그만큼 짧아지고 가운데는 그대로 둔다. */
  height: 1600,
  /** 판의 가운데 y. */
  centerY: 880,
  depth: 2300,
  /** 위 렐릭 고르기 줄 — 얼굴 액자와 이름. */
  tabs: { y: 128, face: 118, gap: 270, plate: 156, nameGap: 84, nameSize: 26 },
  /** 스킬 칸들이 쓰는 세로 띠(판 윗변 기준). */
  cards: { top: 262, bottomPad: 44, side: 36, gap: 18, pad: 24, icon: 124, textGap: 26, nameSize: 38, nameGap: 12 },
  /** 본문 글자 크기 사다리 — 큰 것부터 넣어 보고 띠 안에 들 때까지 한 칸씩 낮춘다. */
  descSizes: [31, 29, 27, 25, 23, 22, 21, 20],
  /** 렐릭을 바꿀 때 칸이 옆에서 밀려 들어오는 거리와 칸마다 늦는 시간. */
  slide: { distance: 36, duration: 220, stagger: 45 },
} as const;

/** 스킬 칸들이 쓸 수 있는 세로 길이. */
export function skillGlanceCardRoom(): number {
  return SKILL_GLANCE.height - SKILL_GLANCE.cards.top - SKILL_GLANCE.cards.bottomPad;
}

/** 칸 하나의 높이 — 아이콘 칸과 (이름 + 본문) 중 큰 쪽에 위아래 여백을 더한다. */
export function skillGlanceCardHeight(bodyHeight: number, nameHeight: number): number {
  const { pad, icon, nameGap } = SKILL_GLANCE.cards;
  return Math.max(icon, nameHeight + nameGap + bodyHeight) + pad * 2;
}

/** 판 밑변(화면 좌표)과 판 밖 뒤로가기 윗변. 테스트가 둘이 겹치지 않는지 본다. */
export function skillGlanceBottom(): number { return SKILL_GLANCE.centerY + SKILL_GLANCE.height / 2; }
export function skillGlanceBackTop(): number { return BACK_SLOT.y - BACK_BUTTON_SIZE / 2; }

/** 렐릭 고르기 칸의 가운데 x(판 가운데 기준). 인원이 몇이든 가운데로 모인다. */
export function skillGlanceTabX(index: number, count: number): number {
  return (index - (count - 1) / 2) * SKILL_GLANCE.tabs.gap;
}
