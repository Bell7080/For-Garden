/**
 * 궁극기 컷인의 결 — 값만 두는 순수 표다(`UltimateCutIn.ts`가 그린다).
 *
 * 한 장의 흐름은 **왼쪽에서 오른쪽으로, 비스듬히 위로 밀어 올리는** 한 방향이다. 유리판이
 * 왼쪽에서 들어오고, 그 안의 전신이 왼쪽 아래에서 오른쪽 위로 촤락 밀려 올라가며, 속도선이 그
 * 뒤를 샤라라락 따라붙는다. 도트 무늬는 **반대쪽**(왼쪽 아래)으로 쏟아져 인물이 앞으로 치고
 * 나가는 속도를 받쳐 준다. 모두 판의 실루엣 안에만 서고, 도트·속도선은 원화보다 **뒤**다 — 인물
 * 위에 덮이면 누가 쓰는지가 무늬에 묻힌다.
 *
 * 도트는 동그라미가 아니라 화면 전체의 문법대로 **작은 마름모**다. 난수를 쓰지 않아 같은
 * 궁극기는 늘 같은 그림을 그린다.
 */

/** 밀어 올리는 방향(단위 벡터) — 오른쪽 위로 25° 남짓. 판의 윗변보다 가파르게 올라 치고 나간다. */
export const CUT_IN_PUSH_ANGLE = -0.44;

export function cutInPushDirection(): { x: number; y: number } {
  return { x: Math.cos(CUT_IN_PUSH_ANGLE), y: Math.sin(CUT_IN_PUSH_ANGLE) };
}

/** 전신이 밀려 올라오는 거리(px, 밀어 올리는 방향으로)와 머무는 동안 더 밀리는 몫. */
export const CUT_IN_PORTRAIT_PUSH = { from: 380, drift: 36 } as const;

export const CUT_IN_HALFTONE = {
  /** 무늬 한 칸(px). 흐르는 거리가 이 수의 배수여야 되감을 때 이음매가 없다. */
  cell: 44,
  dot: 5,
  alpha: 0.24,
  /** 한 번 흐를 때 옮겨 가는 칸 수(가로·세로). 밀어 올리는 방향의 반대(왼쪽 아래)로 흐른다. */
  travel: { x: 15, y: 7 },
} as const;

/** 인물을 따라붙는 속도선. 굵기·밝기를 어긋나게 두어 같은 무게의 줄이 셋 이상 겹치지 않게 한다. */
export const CUT_IN_STREAKS = {
  lines: [
    { offset: -330, width: 3, alpha: 0.5 },
    { offset: -210, width: 7, alpha: 0.38 },
    { offset: -90, width: 2, alpha: 0.55 },
    { offset: 30, width: 5, alpha: 0.42 },
    { offset: 150, width: 2, alpha: 0.5 },
    { offset: 270, width: 9, alpha: 0.28 },
    { offset: 390, width: 3, alpha: 0.45 },
  ],
  /** 한 줄이 늘어나는 길이와 밀려가는 거리(px). */
  length: 640,
  travel: 1100,
  ms: 380,
  /** 줄마다 늦게 떠나는 간격 — 이것이 "샤라라락"이다. */
  staggerMs: 38,
  /** 줄이 출발하는 자리 — 판 왼쪽 아래. 밀어 올리는 방향의 수직으로 `offset`만큼 벌어진다. */
  origin: { x: -180, y: 1060 },
} as const;

/** 진입 순간 판을 한 번 훑고 지나가는 빛 띠. 겹쳐 밝아지는 합성이라 상한(0.6)보다 옅다. */
export const CUT_IN_SWEEP = { width: 200, alpha: 0.3, ms: 460 } as const;

/**
 * 제목 — 위에 개체 이름, 아래에 **크게** 스킬 이름. 스킬 이름이 이 한 장의 주인공이라 이름보다
 * 두 배 가까이 크고 강조색이며, 왼쪽의 굵은 빗금이 제목표와 같은 문법으로 둘을 판에 묶는다.
 * 둘 다 왼쪽에서 오른쪽으로 **닦아 내듯** 드러난다(`wipeMs`) — 글자가 통째로 미끄러지면 판과 같은
 * 움직임이라 따로 읽히지 않는다. 긴 언어는 칸을 넓히지 않고 글자만 줄인다(`maxWidth`).
 */
export const CUT_IN_TITLE = {
  x: 96,
  name: { y: 1000, size: 44 },
  skill: { y: 1112, size: 96, maxWidth: 900 },
  slash: { x: 58, top: 948, bottom: 1174, width: 18, lean: 30 },
  underline: { y: 1178, height: 5 },
  /** 닦이는 띠 — 이름 줄과 스킬 줄이 `split`에서 갈린다. 빗금은 두 줄을 함께 덮는 제 띠를 쓴다. */
  wipe: { top: 930, split: 1040, bottom: 1200, nameDelay: 60, skillDelay: 150, ms: 340, edge: 14 },
} as const;
