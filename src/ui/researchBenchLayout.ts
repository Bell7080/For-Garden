/**
 * 특성 연구대의 순수 배치표다.
 *
 * **연구대는 하나다.** 룬을 늘어놓고 고르는 목록이 아니라, 칸 하나에 룬을 끼우고 그 룬만
 * 들여다보는 자리다 — 목록이면 어느 룬을 만지는 중인지 화면이 말하지 않고, 조작 버튼이
 * 룬마다 따로 서야 한다.
 *
 * 세로 좌표는 **위가 연구대, 아래가 버튼**이다. 룬을 끼우면 연구대가 왼쪽으로 밀리고 그
 * 오른쪽에 상세 레이어가 열린다.
 */

/** 연구대 한 판의 자리와 크기. 모든 y는 화면 좌표다. */
export const RESEARCH_BENCH = {
  /** 연구대 판의 윗변. 제목·횟수 줄 아래다. */
  top: 348,
  /** 연구대 판의 높이. 룬 칸 하나와 그 이름줄이 드는 만큼이다. */
  height: 470,
  /** 판이 화면 좌우에서 안으로 들어오는 거리. */
  inset: 60,
  /** 룬을 끼우는 칸 한 변. */
  slot: 260,
  /** 비었을 때 칸이 판 가운데에 선다. 끼우면 왼쪽으로 이만큼 밀린다. */
  slideX: -190,
  /** 미는 데 걸리는 시간(ms). */
  slideMs: 260,
  /** 상세 레이어가 판 안에서 시작하는 x(판 왼쪽 변 기준). */
  detailLeft: 430,
  actionHeight: 96,
  actionGap: 16,
  /** 버튼 폭. 좌우 여백은 판과 같은 기둥을 쓴다. */
  actionWidth: 880,
} as const;

/**
 * 특성 판.
 *
 * **연구대와 버튼 사이에 판 한 장으로 선다.** 제목표(`/특성`)만 있고 판이 없던 때는 그 아래
 * 글이 바탕 위에 떠 있어 어디까지가 특성 이야기인지 말하지 않았고, 곧바로 버튼 줄이 시작해
 * **특성 본문이 버튼에 덮였다.** 판을 깔고 버튼을 그 아래로 내린다.
 *
 * 높이는 특성 한 줄(등급·이름)과 두어 줄짜리 설명이 드는 만큼이며, 특성이 없을 때는 같은 판
 * 안에 「특성 없음」 한 줄만 선다 — 판이 사라지면 룬을 끼울 때마다 버튼 줄이 오르내린다.
 */
export const RESEARCH_TRAIT = {
  /** 연구대 밑변에서 이만큼 아래에 윗변이 선다. */
  gap: 30,
  height: 250,
  /** 판 안쪽 글자 여백. */
  inset: 34,
  /** 판 밑변에서 버튼 첫 줄까지의 거리. */
  actionsGap: 30,
} as const;

/** 특성 판이 쓰는 자리(화면 좌표). 좌우는 연구대 판과 같은 기둥을 쓴다. */
export function researchTraitBounds(screenWidth: number): { left: number; right: number; top: number; bottom: number } {
  const top = RESEARCH_BENCH.top + RESEARCH_BENCH.height + RESEARCH_TRAIT.gap;
  return { left: RESEARCH_BENCH.inset, right: screenWidth - RESEARCH_BENCH.inset, top, bottom: top + RESEARCH_TRAIT.height };
}

/**
 * 조작 버튼 줄이 시작하는 y.
 *
 * **손으로 적지 않고 특성 판 밑변에서 거꾸로 구한다** — 적어 두었을 때는 판이 자라자 그
 * 밑변이 버튼 줄을 파고들어 특성 본문이 버튼에 가려졌다.
 */
export function researchActionsTop(): number {
  return researchTraitBounds(0).bottom + RESEARCH_TRAIT.actionsGap;
}

/** 판의 실제 가로 폭이다. 화면 폭에서 여백을 뺀 값 하나만 쓴다. */
export function researchBenchWidth(screenWidth: number): number {
  return screenWidth - RESEARCH_BENCH.inset * 2;
}

/** 룬 칸의 중심. 룬을 끼우면 왼쪽으로 밀려 오른쪽에 상세가 들어설 자리를 낸다. */
export function researchSlotCenter(screenWidth: number, slotted: boolean): { x: number; y: number } {
  return {
    x: screenWidth / 2 + (slotted ? RESEARCH_BENCH.slideX : 0),
    y: RESEARCH_BENCH.top + RESEARCH_BENCH.height / 2,
  };
}

/** 상세 레이어가 쓰는 자리(화면 좌표). 룬을 끼웠을 때만 선다. */
export function researchDetailBounds(screenWidth: number): { left: number; right: number; top: number; bottom: number } {
  const left = RESEARCH_BENCH.inset + RESEARCH_BENCH.detailLeft;
  return {
    left,
    right: screenWidth - RESEARCH_BENCH.inset - 28,
    top: RESEARCH_BENCH.top + 40,
    bottom: RESEARCH_BENCH.top + RESEARCH_BENCH.height - 34,
  };
}

/** 조작 버튼 한 줄의 중심 y. 버튼이 늘어도 배치표 하나만 읽는다. */
export function researchActionY(index: number): number {
  return researchActionsTop() + RESEARCH_BENCH.actionHeight / 2
    + index * (RESEARCH_BENCH.actionHeight + RESEARCH_BENCH.actionGap);
}

/** 버튼 줄이 실제로 차지하는 아래끝이다. 라벨 줄을 파고들지 않는지 테스트가 이 값으로 잰다. */
export function researchActionsBottom(count: number): number {
  return count <= 0 ? researchActionsTop() : researchActionY(count - 1) + RESEARCH_BENCH.actionHeight / 2;
}
