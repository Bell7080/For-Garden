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
import { BACKGROUND, BACKGROUND_ASSETS, BACKGROUND_BOOT_KEYS } from "../../src/ui/backgroundAssets";

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
    for (const key of BACKGROUND_PINNED) expect(BACKGROUND_BOOT_KEYS as readonly string[]).toContain(key);
    expect(BACKGROUND_PINNED).toContain(BACKGROUND.cardBackdrop);
  });

  it("부트가 읽는 것은 화면 배경 전체가 아니라 손에 꼽는 몇 장이다", () => {
    // 열여덟 장을 한꺼번에 올리면 텍스처만 434MB가 되어 모바일에서 로비 전에 죽는다.
    expect(BACKGROUND_BOOT_KEYS.length).toBeLessThanOrEqual(BACKGROUND_IDLE_KEEP + 1);
    expect(BACKGROUND_BOOT_KEYS.length).toBeLessThan(BACKGROUND_ASSETS.length);
  });
});
