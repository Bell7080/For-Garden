import type { DialogueAct } from "../core/dialogue";
import type { PuppetAfterimage } from "../puppets/IndexedPuppetCreature";

/**
 * 로비 애착 렐릭의 **들어서는 몫과 눌렀을 때의 몸짓**. Phaser를 읽지 않아 화면과 회귀 테스트가 같은 값을 읽는다.
 *
 * 로비는 캐릭터를 보는 화면이라, 판이 다 선 뒤에 전신이 툭 튀어나오면 그 한 순간이 「덜 그려진 화면」으로
 * 읽혔다. 한 뼘 아래에서 스르륵 떠오르며 밝아지고, 지나온 자리에 옅은 투영 잔상이 몇 겹 남았다가 몸으로 모인다.
 */
export const LOBBY_FAVORITE_ENTRANCE = {
  /** 밝아지며 떠오르는 시간(ms). */
  durationMs: 820,
  /** 떠오르기 시작하는 거리(px, 아래쪽). */
  rise: 46,
  /**
   * 잔상의 겹. 몸이 지나온 쪽(아래)에 남아 떠오를수록 몸으로 모인다. 색은 근미래 투영의 옅은 푸른빛이다 —
   * 검은 복제는 등장하는 순간 몸을 무겁게 누르고, 개체 색은 발광으로 읽힌다.
   */
  ghosts: [
    { lag: 0.34, alpha: 0.34 },
    { lag: 0.68, alpha: 0.2 },
    { lag: 1, alpha: 0.1 },
  ],
  ghostColor: 0xbfe2ff,
} as const;

/**
 * `progress`(0~1) 시점의 잔상. 진행이 끝나면 비어 있다 — 잔상은 들어서는 동안만 그리고 그 뒤로는
 * draw를 하나도 더하지 않는다(모바일에서 상시 비용이 되지 않게). 움직임 줄이기(`factor` 0)에서는 없다.
 */
export function lobbyFavoriteGhosts(progress: number, factor: number): PuppetAfterimage[] {
  const left = 1 - Math.min(1, Math.max(0, progress));
  if (left <= 0.001 || factor <= 0) return [];
  const { rise, ghosts, ghostColor } = LOBBY_FAVORITE_ENTRANCE;
  return [...ghosts].reverse().map(({ lag, alpha }) => ({
    dx: 0,
    dy: rise * factor * lag * left,
    alpha: alpha * left,
    color: ghostColor,
  }));
}

/**
 * 애착 렐릭을 누를 때마다 차례로 도는 몸짓 — 대사 화면과 같은 걸음 표(`DIALOGUE_ACTS`)를 그대로 쓴다.
 * 뽀용(말랑한 통통) → 띠용(움찔 튀었다 돌아옴) → 통통 두 번 → 퍽 눌림 → 으쓱 → 통.
 * 난수로 고르지 않는다 — 같은 손이 같은 순서를 겪어야 다음에 무엇이 올지 기대하게 된다.
 */
/** 로비 전신이 몸짓의 눌림·늘어남을 살리는 몫(`PuppetActRest.scaleAmount`). 화면을 채운 전신이라 대사 스탠딩보다 얕다. */
export const LOBBY_FAVORITE_SQUISH = 0.35;

export const LOBBY_FAVORITE_ACTS: readonly DialogueAct[] = ["bounce", "recoil", "hopTwice", "squash", "puff", "hop"];

export function lobbyFavoriteAct(index: number): DialogueAct {
  const size = LOBBY_FAVORITE_ACTS.length;
  return LOBBY_FAVORITE_ACTS[((Math.trunc(index) % size) + size) % size];
}
