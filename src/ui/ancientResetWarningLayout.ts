/**
 * 고대 지층 초기화 예고 창의 자리와 결(응태 — 마감 3일 전, 아모가 허둥지둥 알린다).
 * 좌표는 판 가운데를 원점으로 한 본문 좌표다. 위에서부터 말풍선 → 허둥대는 아모 → 붉은 남은 시간 → 확인 버튼.
 */
export const ANCIENT_RESET_WARNING = {
  width: 820, height: 960,
  /** 아모의 한마디. 크림빛 판에 짙은 글씨라 어두운 창 안에서 먼저 읽힌다. 꼬리는 아모 쪽(왼쪽 아래)을 향한다. */
  bubble: { y: -268, width: 720, height: 236, bevel: 26, fill: 0xfff4e2, edge: 0xff8fa8,
    tail: { x: -150, width: 54, depth: 40 },
    line: { y: -42, size: 34, color: "#3a2430", wrap: 640 },
    body: { y: 56, size: 27, color: "#7a5a66", wrap: 640 } },
  /** 아모. 판 가운데보다 조금 왼쪽에서 좌우로 바들바들 떨며 콩콩 뛴다. */
  sd: { x: -40, groundY: 196, height: 230, shadowWidth: 150,
    shake: { distance: 9, duration: 62 },
    hop: { rise: 22, duration: 300, rest: 260 } },
  /** 머리 옆의 놀란 표식과 흩날리는 땀방울. 동그라미가 아니라 마름모다. */
  alarm: { x: 120, y: 64, size: 64, color: "#ff6f8e", swing: 14, duration: 180 },
  sweat: { color: 0x8fd8ff, every: 240, size: 13, originY: 40, spread: 150, rise: 70, life: 620 },
  /** 마감까지 남은 시간 — 하단에 붉게 크게. */
  timer: { labelY: 252, valueY: 310, labelSize: 26, valueSize: 54 },
  ok: { y: 408, width: 440, height: 92, fontSize: 32 },
} as const;
