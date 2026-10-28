import { describe, expect, it } from "vitest";
import { DIALOGUE_ACTS } from "../../src/ui/dialogueStageLayout";
import { POKE_ACTS, LOBBY_FAVORITE_ENTRANCE, pokeAct, lobbyFavoriteGhosts } from "../../src/ui/pokeMotion";
import { TITLE_EXIT_GUARD_MS, TRANSITION, transitionTiming } from "../../src/core/screenTransition";

describe("로비 애착 렐릭의 등장·몸짓", () => {
  it("잔상은 들어서는 동안만 그리고 끝나면 비운다", () => {
    expect(lobbyFavoriteGhosts(0, 1)).toHaveLength(LOBBY_FAVORITE_ENTRANCE.ghosts.length);
    expect(lobbyFavoriteGhosts(1, 1)).toEqual([]);
    // 흰빛 잔상은 눈이 부셨다 — 검은 잔상이다.
    expect(lobbyFavoriteGhosts(0.2, 1).every((ghost) => ghost.color === 0x000000)).toBe(true);
    // 움직임 줄이기에서는 잔상이 없다.
    expect(lobbyFavoriteGhosts(0.2, 0)).toEqual([]);
  });

  it("잔상은 몸 아래로 남았다가 몸으로 모이며 옅어진다", () => {
    const early = lobbyFavoriteGhosts(0.1, 1);
    const late = lobbyFavoriteGhosts(0.8, 1);
    for (let i = 0; i < early.length; i++) {
      expect(early[i].dy).toBeGreaterThan(late[i].dy);
      expect(early[i].alpha).toBeGreaterThan(late[i].alpha);
      expect(early[i].dy).toBeGreaterThanOrEqual(0);
    }
  });

  it("누를 때마다 대사 화면의 몸짓을 차례로 돈다", () => {
    for (const act of POKE_ACTS) expect(DIALOGUE_ACTS[act]).toBeDefined();
    expect(pokeAct(0)).toBe("bounce");
    expect(pokeAct(1)).toBe("recoil");
    expect(pokeAct(POKE_ACTS.length)).toBe(pokeAct(0));
    expect(pokeAct(-1)).toBe(POKE_ACTS[POKE_ACTS.length - 1]);
  });
});

describe("타이틀 → 로비 전환", () => {
  it("타이틀이 잦아드는 기다림은 벽시계 상한 안에 든다", () => {
    expect(TITLE_EXIT_GUARD_MS).toBeGreaterThan(TRANSITION.titleOut.duration);
    expect(TITLE_EXIT_GUARD_MS).toBeLessThanOrEqual(600);
  });
  it("움직임 줄이기에서는 기다리지 않고 완성된 화면이 선다", () => {
    for (const kind of ["titleOut", "titleIn"] as const) {
      const timing = transitionTiming(kind, { factor: 0 });
      expect(timing.duration).toBe(0);
      expect(timing.alpha).toBe(1);
    }
  });
});
