/**
 * 룬 액자 뒷배경의 순수 규칙.
 *
 * 액자는 모서리를 깎은 칩이라 뒷배경을 네모(삼각형 두 장)로 칠하면 깎인 자리로 색이 삐져
 * 나와 액자 틀 밖에 색 조각이 남는다. 기하 마스크는 컨테이너 이동을 물려받지 않아 스크롤하는
 * 가방 목록에서 어긋나므로, 마스크 대신 **칠할 도형 자체를 액자 안으로 잘라** 둔다.
 *
 * 자르는 선은 액자를 좌상/우하로 가르는 대각선이고, 두 주 옵션이 그 두 조각을 나눠 가진다.
 */

/** 대각선이 나눈 두 조각 중 어느 쪽인가. 위 주 옵션이 `upper`, 아래 주 옵션이 `lower`다. */
export type RuneBackdropSide = "upper" | "lower";

/** 대각선 기준의 부호. 0이면 선 위, 음수면 좌상, 양수면 우하다. */
function sideValue(x: number, y: number, width: number, height: number): number {
  return x / (width / 2) + y / (height / 2);
}

/**
 * 액자 도형을 대각선으로 잘라 한쪽 조각만 남긴다(Sutherland–Hodgman).
 *
 * 들어온 도형이 액자 자신이므로 결과는 언제나 액자 안이다 — 깎인 모서리든 어떤 비율이든
 * 칠이 틀을 넘지 않는다.
 */
export function clipShapeByDiagonal(shape: readonly number[], width: number, height: number, side: RuneBackdropSide): number[] {
  const keep = (value: number): boolean => (side === "upper" ? value <= 0 : value >= 0);
  const count = shape.length / 2;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const ax = shape[i * 2];
    const ay = shape[i * 2 + 1];
    const bx = shape[((i + 1) % count) * 2];
    const by = shape[((i + 1) % count) * 2 + 1];
    const av = sideValue(ax, ay, width, height);
    const bv = sideValue(bx, by, width, height);
    if (keep(av)) out.push(ax, ay);
    if (keep(av) !== keep(bv)) {
      // 두 점의 부호가 다르면 반드시 그 사이에서 선을 지난다. 나누는 값이 0이 될 수 없다.
      const t = av / (av - bv);
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  return out;
}

/** 도형을 중심 기준으로 줄인다. 같은 조각을 겹겹이 줄여 깔면 가운데가 밝은 발광이 된다. */
export function scaleShape(shape: readonly number[], factor: number): number[] {
  return shape.map((value) => value * factor);
}

/**
 * 발광을 몇 겹으로 깔지와 각 겹의 크기·진하기.
 *
 * 한 겹을 진하게 깔면 색이 면 전체를 덮어 조각까지 그 색으로 물든다. 아주 옅은 겹을 안쪽으로
 * 갈수록 겹치면 가장자리는 거의 비치고 가운데만 밝아져 "빛이 든" 것처럼 읽힌다 — 겹쳐 밝아지는
 * 합성이라 다 더한 값이 곧 가운데 밝기이므로, 합이 0.5를 넘지 않게 잡는다.
 */
export function runeBackdropBands(bands = 14): readonly { factor: number; alpha: number }[] {
  // 겹이 적으면 줄어드는 도형의 윤곽이 계단으로 보인다. 아주 옅은 겹을 여럿 깔아 그 계단을
  // 눈이 잇지 못할 만큼 잘게 나눈다. 겹은 만들 때 한 번만 그리므로 프레임 비용이 아니다.
  return Array.from({ length: bands }, (_, index) => ({
    factor: 1 - (index * 0.8) / bands,
    alpha: 0.032,
  }));
}
