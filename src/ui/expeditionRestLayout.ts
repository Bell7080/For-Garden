/**
 * 원정 휴식 창의 자리와 결. 좌표는 판 가운데를 원점으로 한 본문 좌표다.
 *
 * 위에서부터 회복 규칙 한 줄 → 편성 셋의 카드 → (쓰러진 렐릭이 있으면) 고르라는 한 줄 → 휴식 버튼.
 * 카드는 출격 선택판과 같은 문법이다 — 원화를 깐 깎인 칩에 SD가 서고, 머리만 윗변 밖으로 빠져나온다.
 * 카드 사이는 그 머리가 윗 카드에 닿지 않을 만큼 벌린다(`cardGap` > SD가 내미는 높이).
 */
export const EXPEDITION_REST = {
  width: 900,
  height: 1280,
  summary: { y: -548, size: 28, lineGap: 42 },
  card: {
    width: 820, height: 214, bevel: 46,
    /** 첫 카드 가운데. 그 아래로 `height + gap`씩 내려간다. */
    firstY: -330, gap: 66,
    art: { alpha: 0.32 },
    sd: { x: -282, footFromBottom: 18, height: 240, shadow: 150 },
    /** 글 줄은 SD 오른쪽에서 시작한다. */
    textX: -138, rightX: 372,
    name: { y: -58, size: 34, levelSize: 24 },
    gain: { y: -58, size: 46 },
    bar: { y: 6, height: 26 },
    hp: { y: 60, size: 26 },
    /** 고른 카드 둘레로 번지는 금빛. 같은 칩 실루엣을 키워 두 겹 깐다. */
    glow: { grow: [18, 9], alpha: [0.16, 0.3] },
  },
  /** 쓰러진 렐릭의 SD는 몸을 검게 덮어 실루엣으로 둔다. 고르면 걷힌다. */
  downFill: 0.72,
  hint: { y: 448, size: 27 },
  confirm: { y: 538, width: 420, height: 100, fontSize: 34 },
} as const;

/** i번째 카드의 가운데 y. */
export function restCardY(index: number): number {
  const C = EXPEDITION_REST.card;
  return C.firstY + index * (C.height + C.gap);
}
