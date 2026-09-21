import { describe, expect, it } from "vitest";
import {
  BACKGROUND_IDLE_KEEP,
  BACKGROUND_PINNED,
  emptyBackgroundResidency,
  isBackgroundResident,
  releaseBackground,
  retainBackground,
  type BackgroundResidency,
} from "../../src/ui/backgroundResidency";
import { BACKGROUND, BACKGROUND_ASSETS, BACKGROUND_BOOT_KEYS, NAV_BACKGROUND } from "../../src/ui/backgroundAssets";
import { NAV_TABS } from "../../src/core/navTabs";

/** 여러 키를 차례로 붙잡는다. 화면을 옮겨 다니는 흐름을 짧게 세우는 용도다. */
function retainAll(state: BackgroundResidency, keys: readonly string[]): BackgroundResidency {
  return keys.reduce(retainBackground, state);
}

const LIMITS = { idleKeep: 2, pinned: ["pinned"] } as const;

describe("배경 원화 잔류 규칙", () => {
  it("쓰는 곳이 남아 있으면 내리지 않는다", () => {
    // 같은 원화를 두 화면이 쓰는 중에 하나가 닫히는 상황이다(로비 위에 정보창).
    const state = retainAll(emptyBackgroundResidency(), ["a", "a"]);
    const { state: next, evict } = releaseBackground(state, "a", LIMITS);

    expect(evict).toEqual([]);
    expect(isBackgroundResident(next, "a")).toBe(true);
  });

  it("마지막 사용자가 죽어도 곧바로 내리지 않는다", () => {
    // 되돌아오는 한 걸음까지 다시 읽으면 화면을 오갈 때마다 배경이 한 번씩 빈다.
    const state = retainBackground(emptyBackgroundResidency(), "a");
    const { state: next, evict } = releaseBackground(state, "a", LIMITS);

    expect(evict).toEqual([]);
    expect(isBackgroundResident(next, "a")).toBe(true);
  });

  it("남겨 둘 장수를 넘기면 가장 오래 놓인 것부터 내린다", () => {
    let state = retainAll(emptyBackgroundResidency(), ["a", "b", "c"]);
    for (const key of ["a", "b"]) state = releaseBackground(state, key, LIMITS).state;
    const { state: next, evict } = releaseBackground(state, "c", LIMITS);

    expect(evict).toEqual(["a"]);
    expect(isBackgroundResident(next, "a")).toBe(false);
    expect(isBackgroundResident(next, "b")).toBe(true);
    expect(isBackgroundResident(next, "c")).toBe(true);
  });

  it("놓였던 것을 다시 쓰면 내려갈 차례에서 빠진다", () => {
    let state = retainAll(emptyBackgroundResidency(), ["a", "b"]);
    state = releaseBackground(state, "a", LIMITS).state;
    // 로비로 되돌아왔다. 다시 붙잡혔으므로 뒤에 무엇이 놓이든 이 키는 내려가지 않는다.
    state = retainBackground(state, "a");
    state = retainAll(state, ["c", "d"]);
    for (const key of ["b", "c"]) state = releaseBackground(state, key, LIMITS).state;
    const { state: next, evict } = releaseBackground(state, "d", LIMITS);

    expect(evict).toEqual(["b"]);
    expect(isBackgroundResident(next, "a")).toBe(true);
  });

  it("붙잡아 두기로 한 키는 내려가지도, 남은 자리를 차지하지도 않는다", () => {
    let state = retainAll(emptyBackgroundResidency(), ["pinned", "a", "b"]);
    const pinnedRelease = releaseBackground(state, "pinned", LIMITS);
    state = pinnedRelease.state;

    expect(pinnedRelease.evict).toEqual([]);
    expect(isBackgroundResident(state, "pinned")).toBe(true);

    // pinned가 idle 자리를 먹었다면 여기서 a가 먼저 밀려난다.
    state = releaseBackground(state, "a", LIMITS).state;
    expect(releaseBackground(state, "b", LIMITS).evict).toEqual([]);
  });

  it("붙잡을 곳이 남은 키는 절대 내보내지 않는다", () => {
    // evict 목록이 곧 GPU에서 지우는 목록이라, 살아 있는 표시 객체의 원화가 여기 오르면
    // 그 화면이 물음표 텍스처로 그려진다.
    let state = retainAll(emptyBackgroundResidency(), ["a", "b", "c", "d", "d"]);
    const evicted: string[] = [];
    for (const key of ["a", "b", "c", "d"]) {
      const step = releaseBackground(state, key, LIMITS);
      state = step.state;
      evicted.push(...step.evict);
    }
    expect(evicted).not.toContain("d");
    expect(isBackgroundResident(state, "d")).toBe(true);
  });
});

describe("부트가 미리 읽는 배경", () => {
  it("경로 표에 있는 키만 미리 읽는다", () => {
    // 표에 없는 키를 적으면 부트는 조용히 건너뛰고 그 화면만 배경 없이 뜬다.
    const known = new Set<string>(BACKGROUND_ASSETS.map(([key]) => key));
    for (const key of BACKGROUND_BOOT_KEYS) expect(known.has(key)).toBe(true);
  });

  it("붙잡아 두는 카드 뒷배경은 반드시 부트가 읽는다", () => {
    // 늦게 읽으면 카드 그리드가 처음 뜰 때 카드 뒤가 한 번씩 빈다.
    expect(BACKGROUND_PINNED).toContain(BACKGROUND.cardBackdrop);
    expect(BACKGROUND_BOOT_KEYS as readonly string[]).toContain(BACKGROUND.cardBackdrop);
  });

  it("못 박은 다섯은 부트가 읽지 않는다", () => {
    /*
     * 못 박는 것과 미리 읽는 것은 다른 판단이다. 다섯은 한 장이 25.2MB라 로비에 닿기도 전에
     * 126MB를 올리게 되고, 그것이 v0.84.1에서 고친 바로 그 문제다. 그 화면에 처음 들어갈 때
     * 읽고 그 뒤로 내리지 않는 것이지, 처음부터 들고 시작하는 것이 아니다.
     */
    for (const key of Object.values(NAV_BACKGROUND)) {
      if (key === BACKGROUND.lobby) continue; // 로비는 타이틀 다음 화면이라 미리 읽는다.
      expect(BACKGROUND_BOOT_KEYS as readonly string[], key).not.toContain(key);
    }
  });

  it("못 박은 키는 모두 경로 표에 있다", () => {
    // 표에 없는 키를 못 박으면 영영 올라오지 않는 것을 영영 붙잡고 있게 된다.
    const known = new Set<string>(BACKGROUND_ASSETS.map(([key]) => key));
    for (const key of BACKGROUND_PINNED) expect(known.has(key), key).toBe(true);
  });

  it("부트가 읽는 것은 화면 배경 전체가 아니라 손에 꼽는 몇 장이다", () => {
    // 열여덟 장을 한꺼번에 올리면 텍스처만 434MB가 되어 모바일에서 로비 전에 죽는다.
    expect(BACKGROUND_BOOT_KEYS.length).toBeLessThanOrEqual(BACKGROUND_IDLE_KEEP + 1);
    expect(BACKGROUND_BOOT_KEYS.length).toBeLessThan(BACKGROUND_ASSETS.length);
  });
});

/**
 * 다섯 탭을 오가는 걸음.
 *
 * 화면이 실제로 붙잡는 키는 제 배경 하나가 아니다 — 연구소는 배너 원화를, 렐릭은 정보창을
 * 함께 세운 채로 산다. 그 둘까지 넣어야 남은 예산이 실제로 어디에 쓰이는지 보인다.
 */
const NAV_HOLDS: Readonly<Record<string, readonly string[]>> = {
  archaeology: [NAV_BACKGROUND.archaeology],
  relics: [NAV_BACKGROUND.relics, BACKGROUND.info],
  lobby: [NAV_BACKGROUND.lobby],
  lab: [NAV_BACKGROUND.lab, BACKGROUND.recruitFossil],
  premium: [NAV_BACKGROUND.premium],
};

describe("핵심 화면 다섯을 오가는 걸음", () => {
  /** 탭을 차례로 눌러 보고, 그때마다 다시 읽어야 했던 키를 돌려준다. */
  function walkTabs(walk: readonly string[]): string[][] {
    let state = emptyBackgroundResidency();
    const loaded = new Set<string>(BACKGROUND_BOOT_KEYS);
    state = retainBackground(state, BACKGROUND.cardBackdrop);
    let held: readonly string[] = [];
    return walk.map((tab) => {
      for (const key of held) {
        const step = releaseBackground(state, key);
        state = step.state;
        for (const evicted of step.evict) loaded.delete(evicted);
      }
      held = NAV_HOLDS[tab];
      const again = held.filter((key) => !loaded.has(key));
      for (const key of held) { loaded.add(key); state = retainBackground(state, key); }
      return again;
    });
  }

  it("은 다섯 탭 전부에 배경을 정해 둔다", () => {
    // 여섯 번째 탭이 생기면 타입이 먼저 막지만, 값을 빠뜨리는 것까지는 막지 못한다.
    for (const tab of NAV_TABS) expect(NAV_BACKGROUND[tab.key], tab.key).toBeTruthy();
  });

  it("은 한 번 들른 화면을 다시 읽지 않는다", () => {
    /*
     * 다시 읽는 동안 화면에는 아무 배경도 없어 캔버스 클리어색만 남고, 도착하면 페이드로
     * 밝아진다 — 그 암전이 탭을 누를 때마다 되풀이되는 것이 "번쩍임"의 정체였다. 실측에서
     * 열한 번 중 열 번이 그랬다.
     */
    const walk = ["lobby", "lab", "premium", "lab", "lobby", "relics", "archaeology", "relics", "lobby", "lab", "lobby"];
    const visited = new Set<string>();
    walkTabs(walk).forEach((again, index) => {
      const tab = walk[index];
      // 그 화면에 처음 들어가는 걸음만 읽는다. 두 번째부터는 이미 올라가 있어야 한다.
      if (visited.has(tab)) expect(again, `${index}번째 ${tab}`).toEqual([]);
      visited.add(tab);
    });
  });

  it("은 배경 아닌 원화까지 예산 밖으로 밀어내지 않는다", () => {
    // 다섯을 예산에서 빼 준 만큼 남는 두 자리가 연구소 배너·렐릭 정보창의 몫이 된다.
    const walk = ["lab", "relics", "lab", "relics"];
    expect(walkTabs(walk).slice(2)).toEqual([[], []]);
  });
});
