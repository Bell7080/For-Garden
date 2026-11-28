import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ATTENDANCE_PREFETCH_FRESH_MS, AttendanceManager } from "../../src/managers/AttendanceManager";
import type { AttendanceStatusResponse, GameApi } from "../../src/api/contracts";
import { session } from "../../src/state/session";

describe("첫 실행 — 타이틀이 먼저 서고, 나머지는 타이틀에서 다 받는다", () => {
  const steps = readFileSync("src/scenes/loadingSteps.ts", "utf8");
  const essential = steps.slice(steps.indexOf("export const LOADING_STEPS"), steps.indexOf("/** 끝내 못 받은 필수 파일"));
  const title = readFileSync("src/scenes/TitleScene.ts", "utf8");

  it("Puppet·뽑기 연출·캐시 받기는 입장 전 단계에 남는다(인게임에서 늦게 서지 않게)", () => {
    expect(essential).toContain("preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[0])");
    expect(essential).toContain("preloadPuppetAssets(PUPPET_PRELOAD_GROUPS[1])");
    expect(essential).toContain("preloadResearchCinematic");
    expect(essential).toContain("SKILL_ART_ASSETS.map");
  });

  it("무거운 단계는 제목이 열린 뒤(영상 재생·대체 시한)에 시작한다", () => {
    expect(steps).toContain("if (i === 1 && holdHeavy)");
    expect(title).toContain("this.releaseHeavy?.();");
    expect(title).toContain("new Promise<void>((resolve) => { this.releaseHeavy = resolve; })");
  });

  it("끝내 못 받은 필수 파일은 입장 뒤 살아 있는 겹의 로더로 다시 받는다", () => {
    expect(steps).toContain("failed.forEach((file) => unresolvedFiles.set(file.key, file));");
    expect(title).toContain('retryUnresolvedLater(() => game.scene.getScene("effect-overlay")');
  });

  it("타이틀 영상은 실패하면 다시 걸고, 형식이 문제면 다른 한 벌로 바꾼다", () => {
    const movie = readFileSync("src/ui/titleMovie.ts", "utf8");
    expect(movie).toContain("Phaser.GameObjects.Events.VIDEO_ERROR");
    expect(movie).toContain("Phaser.GameObjects.Events.VIDEO_UNSUPPORTED");
    expect(movie).toContain("video.loadURL(titleMovieRetrySource(");
  });
});

describe("출석 판 — 로비가 서는 동안 미리 묻는다", () => {
  const status = { autoShow: true, tracks: [] } as unknown as AttendanceStatusResponse;
  const managerWith = (getAttendance: () => Promise<AttendanceStatusResponse>) =>
    new AttendanceManager({ getAttendance } as unknown as GameApi, session);

  it("미리 물어 둔 답이 따끈하면 다시 묻지 않는다", async () => {
    const get = vi.fn(() => Promise.resolve(status));
    const manager = managerWith(get);
    manager.prefetch(1000);
    manager.prefetch(1500);
    expect(await manager.takeStatus(2000)).toBe(status);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("오래된 답이나 실패한 답은 버리고 새로 묻는다", async () => {
    const get = vi.fn(() => Promise.resolve(status));
    const stale = managerWith(get);
    stale.prefetch(0);
    await stale.takeStatus(ATTENDANCE_PREFETCH_FRESH_MS + 1);
    expect(get).toHaveBeenCalledTimes(2);

    let calls = 0;
    const flaky = managerWith(() => (calls++ === 0 ? Promise.reject(new Error("net")) : Promise.resolve(status)));
    flaky.prefetch(0);
    expect(await flaky.takeStatus(10)).toBe(status);
  });

  it("로비는 첫 출석 판을 미리 받은 답으로 곧바로 세운다", () => {
    const lobby = readFileSync("src/scenes/LobbyScene.ts", "utf8");
    expect(lobby).toContain("attendanceManager.takeStatus()");
    expect(lobby).toContain("const read = initial ? Promise.resolve(initial) : attendanceManager.status();");
  });
});
