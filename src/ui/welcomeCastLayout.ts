import { LAB_CHROME } from "./labLayout";

/**
 * 첫 복원 연구 원화 위에 서는 SSR 넷의 자리.
 *
 * 원화는 인물 없이 비워 둔 방이라 **누가 나오는 판인지를 SD가 말한다.** 넷을 한 줄로 세우면 단체
 * 사진처럼 딱딱해 **바깥 둘은 앞(크게·낮게), 안쪽 둘은 뒤(작게·높게)**로 엇갈려 반원을 그린다.
 * 이름판은 발밑에 서고, 모두 SSR 확정 판(`LAB_CHROME.pity`)보다 위에서 끝난다 — 판 아래로 파고들면
 * 이름이 확정 수에 가린다. 순서는 배너의 `castRelicIds` 순서 그대로 왼쪽 앞 → 왼쪽 뒤 → 오른쪽
 * 뒤 → 오른쪽 앞이다.
 */
export const WELCOME_CAST = {
  spots: [
    { x: 190, groundY: 1160, height: 290 },
    { x: 405, groundY: 910, height: 250 },
    { x: 675, groundY: 910, height: 250 },
    { x: 890, groundY: 1160, height: 290 },
  ],
  /** 발밑 그림자 폭은 SD 키에 비례한다. */
  shadowRatio: 0.72,
  /** 이름판 — 발밑에서 `dy`만큼 아래에 가운데가 선다. */
  plate: { dy: 40, width: 240, height: 58, slant: 14, nameSize: 28, raritySize: 22 },
  /** 속성 뱃지는 이름판 왼쪽 끝에, 돋보기는 오른쪽 끝에 걸린다. */
  badge: { size: 52, dx: -106 },
  magnifier: { dx: 100, size: 26, hit: 64 },
  /** 들어올 때 차례로 톡 떨어지는 간격(ms). */
  enterStagger: 90,
  depth: LAB_CHROME.depth.panels - 1,
} as const;

/** 이름판 가운데 자리. */
export function welcomeCastPlateY(index: number): number {
  return WELCOME_CAST.spots[index].groundY + WELCOME_CAST.plate.dy;
}

/** 가장 낮은 이름판의 밑변 — SSR 확정 판 윗변보다 위여야 한다. */
export function welcomeCastBottom(): number {
  return Math.max(...WELCOME_CAST.spots.map((_, index) => welcomeCastPlateY(index))) + WELCOME_CAST.plate.height / 2;
}

/** SSR 확정 판의 윗변. */
export function labPityTop(): number {
  return LAB_CHROME.pity.y - LAB_CHROME.pity.height / 2;
}
