/**
 * 옆으로 흐르는 라벨 줄의 순수 규칙 — 프리미엄 상점과 업적 창이 같은 셈을 쓴다.
 *
 * 줄 좌표(스크롤 0)에서 첫 라벨이 창 왼쪽 끝에 붙고, 고른 라벨은 창 가운데로 모이되 끝에서는 줄의
 * 한계에 멈춘다. 창 밖에 가려진 라벨에 받을 것이 남았는지(`hiddenDotSides`)도 여기서 가른다 —
 * 화면이 라벨 좌표를 다시 셈하면 끝 발광이 가리키는 쪽과 실제로 가려진 쪽이 갈린다.
 */
export interface TabStripSpec {
  /** 창의 왼쪽·오른쪽 끝(줄을 담은 좌표계). */
  left: number;
  right: number;
  /** 라벨 한 장의 폭과 라벨 사이. */
  width: number;
  gap: number;
  count: number;
}

/** 스크롤 0에서 `index`번째 라벨의 중심 x. */
export function tabStripSpotX(spec: TabStripSpec, index: number): number {
  return spec.left + spec.width / 2 + index * (spec.width + spec.gap);
}

/** 줄이 왼쪽으로 밀릴 수 있는 끝(음수). 다 보이면 0이다. */
export function tabStripMinScroll(spec: TabStripSpec): number {
  const span = spec.count * spec.width + Math.max(0, spec.count - 1) * spec.gap;
  return Math.min(0, spec.right - spec.left - span);
}

/** `index`번째 라벨을 창 가운데로 모으는 스크롤. */
export function tabStripScrollFor(spec: TabStripSpec, index: number): number {
  const centered = (spec.left + spec.right) / 2 - tabStripSpotX(spec, index);
  return Math.max(tabStripMinScroll(spec), Math.min(0, centered));
}

/**
 * 받을 것이 남은 라벨이 창 밖(절반 넘게 가려진 채)에 있는 쪽. 반쯤 걸친 라벨은 제 점이 이미 보이므로
 * 세지 않는다 — 점은 라벨의 오른쪽 위에 서므로 오른쪽은 점 자리까지 들어와야 보인 것으로 본다.
 */
export function hiddenDotSides(spec: TabStripSpec, scroll: number, dotted: readonly boolean[]): { left: boolean; right: boolean } {
  let left = false; let right = false;
  for (let index = 0; index < spec.count; index += 1) {
    if (!dotted[index]) continue;
    const center = tabStripSpotX(spec, index) + scroll;
    if (center < spec.left) left = true;
    // 점은 라벨 오른쪽 위 모서리 안쪽에 선다 — 그 자리가 창 밖이면 가려진 것이다.
    if (center + spec.width / 2 - 22 > spec.right) right = true;
  }
  return { left, right };
}

/** 가려진 쪽에서 창에 가장 가까운, 받을 것이 남은 라벨. 끝 발광을 누르면 그 라벨로 간다. */
export function nearestHiddenDot(spec: TabStripSpec, scroll: number, dotted: readonly boolean[], side: "left" | "right"): number | undefined {
  const hidden: number[] = [];
  for (let index = 0; index < spec.count; index += 1) {
    if (!dotted[index]) continue;
    const center = tabStripSpotX(spec, index) + scroll;
    if (side === "left" ? center < spec.left : center + spec.width / 2 - 22 > spec.right) hidden.push(index);
  }
  if (hidden.length === 0) return undefined;
  return side === "left" ? hidden[hidden.length - 1] : hidden[0];
}
