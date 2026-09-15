/**
 * 돌진이 지나간 길에 남는 잔상.
 *
 * **3배속에서도 무슨 일이 일어났는지 읽혀야 한다.** 돌진은 그림만 출발점에 남았다가 일정한
 * 속도로 끝점까지 따라붙는 연출인데(`SKIRMISH.chargeGlideSeconds` 0.34초), 3배속에서는 그 전부가
 * 0.11초 만에 지나가 **순간이동한 뒤 푹 박은 것**처럼 보인다. 무엇이 어디서 어디로 지나갔는지가
 * 화면에서 사라지면 그 기술이 왜 셋을 함께 때렸는지도 읽히지 않는다.
 *
 * 그래서 몸 하나가 아니라 **지나온 길 위에 같은 몸을 몇 겹 세운다.** 한 프레임만 봐도 선이
 * 그어져 있어 어느 방향으로 얼마나 뚫고 들어갔는지가 남고, 배속을 올려도 그 선은 그대로다.
 *
 * 값을 화면이 아니라 여기에 두는 이유는 Phaser 없이 검사하기 위해서다 — 겹 수·진하기·간격은
 * 눈대중으로 정하면 개체마다 다른 무게로 읽힌다.
 */

/** 잔상 한 겹. 지금 몸에서 얼마나 뒤에 있고 얼마나 옅은가. */
export interface AfterimageStep {
  /** 지금 그리는 몸 기준의 가로 변위(px). 지나온 쪽이 양수가 아니라 **출발점 쪽**이다. */
  dx: number;
  dy: number;
  alpha: number;
}

export const CHARGE_AFTERIMAGE = {
  /**
   * 세우는 겹 수.
   *
   * **셋이면 선이 되고 그보다 적으면 두 덩어리로 읽힌다.** 다섯까지 늘려 봤자 짧은 돌진에서는
   * 서로 겹쳐 한 뭉치가 되고, 긴 돌진에서는 그만큼 draw가 늘 뿐이다.
   */
  steps: 3,
  /**
   * 가장 진한 겹의 알파.
   *
   * 검은 실루엣이라 진하면 그 자체가 몸으로 읽혀 **누가 진짜인지** 흐려진다. 섬광 상한(0.6)
   * 아래에 두고, 뒤로 갈수록 옅어져 지나온 방향이 밝기로도 읽히게 한다.
   */
  nearAlpha: 0.34,
  /** 가장 옅은(가장 먼) 겹의 알파. 0으로 두면 마지막 겹이 보이지 않아 선이 짧아 보인다. */
  farAlpha: 0.08,
  /**
   * 출발점까지의 변위 중 잔상이 차지하는 몫.
   *
   * 1로 두면 가장 먼 겹이 출발점에 정확히 겹쳐 **출발한 자리에 몸이 하나 더 서 있는** 것으로
   * 보인다. 조금 못 미치게 두면 길 위에 흩어진 잔상으로 읽힌다.
   */
  reach: 0.85,
} as const;

/**
 * 지금 남아 있는 돌진 변위에서 잔상 겹을 만든다.
 *
 * `dashX`·`dashY`는 **출발점이 지금 몸에서 얼마나 떨어져 있는가**이므로(`renderPose`가 같은
 * 값을 더해 그림을 뒤에 남긴다) 그 방향으로 고르게 나눠 세우기만 하면 된다. 변위가 사실상
 * 0이면 세울 길이 없어 빈 목록을 돌려준다 — 제자리에서 겹만 쌓이면 몸이 두꺼워 보인다.
 */
export function chargeAfterimageSteps(dashX: number, dashY: number): readonly AfterimageStep[] {
  const distance = Math.hypot(dashX, dashY);
  if (distance < 1) return [];
  const { nearAlpha, farAlpha, reach } = CHARGE_AFTERIMAGE;
  const steps: number = CHARGE_AFTERIMAGE.steps;
  return Array.from({ length: steps }, (_unused, index) => {
    // 1/steps … steps/steps로 나눠 가장 먼 겹이 `reach`에 닿는다.
    const ratio = ((index + 1) / steps) * reach;
    // 멀수록 옅다. 겹이 하나뿐일 때는 가장 진한 값을 쓴다.
    const fade = steps === 1 ? 0 : index / (steps - 1);
    return { dx: dashX * ratio, dy: dashY * ratio, alpha: nearAlpha + (farAlpha - nearAlpha) * fade };
  });
}
