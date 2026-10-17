import { describe, expect, it } from "vitest";
import { LAUNCH_EPOCH_STORAGE_KEY, launchEpochWipeKeys, reconcileLaunchEpoch } from "../../src/api/launchEpoch";
import { fetchPublicConfig } from "../../src/api/backendConfig";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
const [TOKENS, LINK, SAVE] = launchEpochWipeKeys();

describe("출시 초기화 세대", () => {
  it("지우는 키는 토큰·서버 연결 표식·로컬 저장 셋이다", () => {
    expect(launchEpochWipeKeys()).toHaveLength(3);
    expect(new Set(launchEpochWipeKeys()).size).toBe(3);
    expect(launchEpochWipeKeys()).not.toContain(LAUNCH_EPOCH_STORAGE_KEY);
  });

  it("세대가 같으면 아무것도 지우지 않는다", () => {
    const s = memory({ [LAUNCH_EPOCH_STORAGE_KEY]: "E1", [TOKENS]: "t", [SAVE]: "s" });
    expect(reconcileLaunchEpoch("E1", s)).toBe(false);
    expect([...s.data.keys()].sort()).toEqual([LAUNCH_EPOCH_STORAGE_KEY, SAVE, TOKENS].sort());
  });

  it("세대가 달라지면 초기화 이전의 토큰·연결 표식·저장을 지우고 새 세대를 적는다", () => {
    const s = memory({ [LAUNCH_EPOCH_STORAGE_KEY]: "E1", [TOKENS]: "t", [LINK]: "u", [SAVE]: "s", other: "keep" });
    expect(reconcileLaunchEpoch("E2", s)).toBe(true);
    expect(s.data.get(LAUNCH_EPOCH_STORAGE_KEY)).toBe("E2");
    expect(s.data.has(TOKENS) || s.data.has(LINK) || s.data.has(SAVE)).toBe(false);
    expect(s.data.get("other")).toBe("keep");
  });

  it("세대를 적은 적 없는 기기(이 기능 이전에 테스트하던 기기)도 토큰이 있으면 초기화 뒤에는 걸러진다", () => {
    const s = memory({ [TOKENS]: "t", [SAVE]: "s" });
    expect(reconcileLaunchEpoch("E1", s)).toBe(true);
    expect(s.data.has(TOKENS)).toBe(false);
  });

  it("서버 계정과 이어진 적 없는 첫 실행 기기는 방금 만든 로컬 저장을 지우지 않는다", () => {
    const s = memory({ [SAVE]: "first-run" });
    expect(reconcileLaunchEpoch("E1", s)).toBe(false);
    expect(s.data.get(SAVE)).toBe("first-run");
    expect(s.data.get(LAUNCH_EPOCH_STORAGE_KEY)).toBe("E1");
  });

  it("지울 것이 없던 새 기기는 세대만 적고 다시 시작하지 않는다", () => {
    const s = memory();
    expect(reconcileLaunchEpoch("E1", s)).toBe(false);
    expect(s.data.get(LAUNCH_EPOCH_STORAGE_KEY)).toBe("E1");
    expect(reconcileLaunchEpoch("E1", s)).toBe(false);
  });

  it("서버가 세대를 주지 않으면(빈 값) 아무것도 지우지 않는다", () => {
    const s = memory({ [LAUNCH_EPOCH_STORAGE_KEY]: "E1", [SAVE]: "s" });
    expect(reconcileLaunchEpoch("", s)).toBe(false);
    expect(s.data.get(SAVE)).toBe("s");
    expect(s.data.get(LAUNCH_EPOCH_STORAGE_KEY)).toBe("E1");
  });

  it("저장소가 없거나 예외를 던져도 터지지 않는다", () => {
    expect(reconcileLaunchEpoch("E1", undefined)).toBe(false);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => undefined, removeItem: () => undefined };
    expect(reconcileLaunchEpoch("E1", broken)).toBe(false);
  });

  it("공개 설정 응답의 launch_epoch를 읽고, 없으면 빈 문자열이다", async () => {
    const reply = (extra: object) => (async () => new Response(JSON.stringify({ maintenance: false, ...extra }))) as typeof fetch;
    const withEpoch = await fetchPublicConfig(reply({ launch_epoch: "E9" }), "https://x", "k");
    const without = await fetchPublicConfig(reply({}), "https://x", "k");
    expect(withEpoch.ok && withEpoch.config.launchEpoch).toBe("E9");
    expect(without.ok && without.config.launchEpoch).toBe("");
  });
});
