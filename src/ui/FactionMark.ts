import Phaser from "phaser";
import { squadEmblemKey, type SquadId } from "../data/factions";

/**
 * 소속 스쿼드 엠블럼.
 *
 * **모든 스쿼드가 같은 양식을 쓴다.** 화면마다 다르게 세우면 같은 표식이 어디서는 도장,
 * 어디서는 아이콘으로 읽힌다. 새 스쿼드가 늘어도 여기 값만 그대로 따라온다.
 *
 * 판때기를 뒤에 받치지 않는다. 대신 **같은 그림을 검게 여러 겹 복제해** 크기를 조금씩 키우며
 * 겹친다 — 겹칠수록 가장자리가 흐려져 어둠이 번진 것처럼 보인다. 도형 하나로 그림자를 그리면
 * 엠블럼 모양과 무관한 네모가 뒤에 남고, 캔버스 흐리기(`shadowBlur`)는 그릴 때마다 CPU가
 * 다시 계산해 팝업이 열릴 때마다 프레임이 튄다.
 */
export const FACTION_MARK = {
  /** 검게 복제할 겹 수. 늘리면 더 부드럽지만 그리는 비용도 그만큼 늘어난다. */
  shadowLayers: 3,
  /** 겹마다 커지는 비율. 바깥 겹일수록 크고 옅어 가장자리가 번진다. */
  shadowGrow: 0.085,
  /** 가장 안쪽 검은 겹의 진하기. 바깥 겹은 이 값을 나눠 갖는다. */
  shadowAlpha: 0.5,
  /** 복제 겹을 아래로 미는 거리(엠블럼 크기 대비). */
  shadowOffsetRatio: 0.045,
  /** 엠블럼 자체의 진하기. 표식이지 주인공이 아니므로 온전히 칠하지 않는다. */
  alpha: 0.9,
} as const;

export interface FactionMarkOptions {
  /** 엠블럼 한 변의 길이. */
  size: number;
  /** 컨테이너 깊이. 팝업 본문에 넣을 때는 생략한다. */
  depth?: number;
}

/**
 * 엠블럼 한 장과 그 뒤로 번지는 어둠을 한 컨테이너에 담는다.
 *
 * 엠블럼 그림이 아직 없으면 **아무것도 세우지 않는다** — 빈 네모나 물음표를 대신 두면 그것이
 * 무슨 표식인지 묻게 만든다. 아트 한 장이 도착하면 이 함수가 저절로 그린다.
 */
export function addFactionMark(scene: Phaser.Scene, x: number, y: number, squad: SquadId, options: FactionMarkOptions): Phaser.GameObjects.Container | undefined {
  const key = squadEmblemKey(squad);
  if (!scene.textures.exists(key)) return undefined;
  const container = scene.add.container(x, y);
  const offset = options.size * FACTION_MARK.shadowOffsetRatio;
  for (let layer = FACTION_MARK.shadowLayers; layer >= 1; layer -= 1) {
    const grow = 1 + FACTION_MARK.shadowGrow * layer;
    container.add(scene.add
      .image(0, offset, key)
      .setDisplaySize(options.size * grow, options.size * grow)
      .setTint(0x000000)
      // 안쪽 겹이 가장 진하고 바깥으로 갈수록 옅어져 경계가 번진다.
      .setAlpha(FACTION_MARK.shadowAlpha / layer));
  }
  container.add(scene.add.image(0, 0, key).setDisplaySize(options.size, options.size).setAlpha(FACTION_MARK.alpha));
  if (options.depth !== undefined) container.setDepth(options.depth);
  return container;
}
