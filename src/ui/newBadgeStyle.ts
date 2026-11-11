/** 「NEW」 표식(`NewContentBadge.ts`)의 값. Phaser 없이 테스트가 읽는다. */
export const NEW_BADGE = {
  width: 62,
  height: 28,
  bevel: 8,
  fontSize: 18,
  shadowY: 4,
  /** 숨 쉬는 크기와 한 번의 길이(ms). */
  pulseScale: 1.1,
  pulseMs: 620,
  /** 모서리 별의 크기·반짝임 길이·쉬는 틈(ms). */
  starSize: 9,
  twinkleMs: 360,
  twinkleGapMs: 1500,
  /** 풀린 자물쇠 뒤에 튀어나오는 길이(ms). */
  popMs: 360,
} as const;

/** 입구마다 「NEW」가 앉는 자리. 붉은 점(우상단)과 모서리를 나눠 갖도록 좌상단에 둔다. */
export const RAIL_BADGE = { x: -30, y: -50, scale: 0.85 } as const;
/** 출격 판의 칸 — 칸의 좌상단 모서리에서 안쪽으로 이만큼. */
export const SORTIE_ENTRY_BADGE = { x: 52, y: 6, scale: 1.1 } as const;
/** 하단 탭 — 아이콘 오른쪽 위. */
export const NAV_BADGE = { x: 40, y: -52, scale: 0.85 } as const;
