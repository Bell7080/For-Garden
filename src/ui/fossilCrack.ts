/**
 * 화석을 깨는 그림.
 *
 * 연구소의 첫 순간은 "무언가 부서졌다"가 아니라 **화석 하나가 갈라져 안의 것이 나온다**여야
 * 한다. 그래서 균열은 아무 데나 긋는 선이 아니라 화석 그림 위를 지나는 한 줄기와 거기서
 * 갈라지는 가지들이고, 파편은 그 껍질 조각이다.
 *
 * 값은 화석 한 변에 대한 **비율**이라 크기를 바꿔도 그림이 같고, Phaser를 모르는 모듈이라
 * 회귀 테스트가 씬과 같은 도형을 읽는다.
 */

export const FOSSIL_CRACK = {
  /** 화면에 서는 화석 그림의 한 변. */
  size: 470,
  /** 화석이 놓이는 세로 자리. 결과판보다 위라 껍질이 깨진 자리에서 칸이 내려온다. */
  centerY: 880,
  /** 깨질 때 튀는 껍질 조각 수. 한 자리 수로 끊는다 — 잔뜩 흩뿌리면 무엇이 깨졌는지 흐려진다. */
  shards: 9,
  /** 조각 한 장의 기준 크기. */
  shardSize: 46,
  /** 조각이 날아가는 거리. */
  shardSpread: 560,
  /**
   * 조각이 퍼지는 부채꼴의 폭(라디안).
   *
   * 위에서 내려다보는 화면이 아니라 정면이지만, 조각이 발밑으로 쏟아지면 "터졌다"가 아니라
   * "흘렸다"로 보인다. 그래서 위쪽으로 벌어지는 부채꼴만 쓴다.
   */
  arc: 2.3,
} as const;

/**
 * 균열. 첫 배열이 몸통이고 나머지는 **몸통 위의 한 점**에서 갈라지는 가지다.
 *
 * 가지가 몸통에 닿지 않으면 화석 위에 선 몇 개를 흩어 놓은 것으로 보인다.
 */
export const CRACK_BRANCHES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[0.02, -0.46], [0.06, -0.22], [-0.05, -0.02], [0.04, 0.2], [-0.01, 0.46]],
  [[-0.05, -0.02], [-0.22, 0.07], [-0.37, 0.27]],
  [[0.04, 0.2], [0.21, 0.23], [0.35, 0.13]],
  [[0.06, -0.22], [0.25, -0.31]],
];

/** 비율 좌표를 실제 크기의 평평한 좌표 배열로 편다. */
export function crackBranchPoints(branch: ReadonlyArray<readonly [number, number]>, size: number): number[] {
  return branch.flatMap(([x, y]) => [x * size, y * size]);
}

export interface FossilShard {
  /** 날아가는 방향(라디안). 화면 좌표라 위쪽이 음수다. */
  angle: number;
  distance: number;
  size: number;
  /** 날아가는 동안 도는 각도(도). */
  spin: number;
}

/**
 * 껍질 조각이 흩어지는 방향.
 *
 * 난수를 쓰지 않는다 — 같은 연출이 매번 같은 그림으로 터져야 회귀 테스트가 비례를 지킬 수
 * 있고, 실제로 눈에 띄는 차이도 없다.
 */
export function fossilShards(
  count: number = FOSSIL_CRACK.shards,
  spread: number = FOSSIL_CRACK.shardSpread,
  size: number = FOSSIL_CRACK.shardSize,
): FossilShard[] {
  const shards: FossilShard[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    // 위쪽(-90도)을 가운데로 두고 좌우로 벌린다. 조각마다 조금씩 어긋나게 흔들어 부채꼴이
    // 반듯한 빗살로 보이지 않게 한다.
    const jitter = (((index * 37) % 11) - 5) / 44;
    shards.push({
      angle: -Math.PI / 2 + (t - 0.5) * FOSSIL_CRACK.arc + jitter,
      distance: spread * (0.58 + (0.42 * ((index * 5) % count)) / Math.max(1, count - 1)),
      size: size * (0.7 + (0.5 * ((index * 3) % 4)) / 3),
      spin: (index % 2 === 0 ? 1 : -1) * (180 + ((index * 47) % 160)),
    });
  }
  return shards;
}

/**
 * 조각 한 장의 모양 — **마름모**다.
 *
 * 좌우 꼭짓점의 높이를 어긋나게 깎아 반듯한 보석이 되지 않게 한다. 화면의 다른 파편과 같은
 * 문법이라 연구소만 다른 모양으로 터지지 않는다.
 */
export function shardPoints(size: number): number[] {
  const half = size / 2;
  return [0, -half, half, -half * 0.12, half * 0.36, half, -half * 0.86, half * 0.24];
}
