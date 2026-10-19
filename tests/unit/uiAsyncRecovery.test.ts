import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

/** 실제 UI 클래스의 제어 흐름을 실행한다. Phaser 표시 객체만 대체하며 제품 메서드는 복제하지 않는다. */
function sourceClass(file: string, name: string, dependencies: Record<string, unknown>): any {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find((node): node is ts.ClassDeclaration => ts.isClassDeclaration(node) && node.name?.text === name)!;
  const js = ts.transpileModule(node.getText(source).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), js + `\nreturn ${name};`)(...Object.values(dependencies));
}

describe("비동기 UI 실패 복구", () => {
  it("업적 지급 뒤 목록·알림 조회 실패에도 다음 수령이 잠기지 않는다", async () => {
    const claim = vi.fn(async () => ({ wallet: { gems: 1 }, granted: [], newModifierIds: [] }));
    const Popup = sourceClass("src/ui/AchievementsPopup.ts", "AchievementsPopup", {
      hasRemoteState: () => false,
      withBusy: async (_scene: unknown, promise: Promise<unknown>) => promise,
      session: { wallet: {} }, notificationManager: { refresh: async () => { throw Error("offline"); } },
    });
    const popup = Object.assign(Object.create(Popup.prototype), {
      scene: {}, api: { claimAchievementRewards: claim, getAchievements: async () => { throw Error("offline"); } }, render: vi.fn(),
    });
    await popup.claim(["first"]);
    expect(popup.claiming).toBe(false);
    await popup.claim(["second"]);
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("파견 통신 실패 뒤 마지막 렌더는 다시 누를 수 있는 상태다", async () => {
    const Popup = sourceClass("src/ui/InteractionCityPopup.ts", "InteractionCityPopup", { formationMembers: (party: unknown[]) => party.filter(Boolean), t: (key: string) => key });
    const renders: boolean[] = [];
    const popup = Object.assign(Object.create(Popup.prototype), {
      party: ["torika", null, null], body: {}, popups: { confirm: vi.fn() },
      manager: { start: async () => { throw Error("offline"); } }, hopFarewell: async () => undefined,
      render(this: { busy: boolean }) { renders.push(Boolean(this.busy)); },
    });
    await popup.start({ city: { id: "doppel-upper", displayName: "city", partySize: { min: 1 } } });
    expect(renders).toEqual([true, false]);
    expect(popup.busy).toBe(false);
  });

  it("이야기 저장 실패 때 다음 장면으로 가지 않고 같은 완료를 재시도한다", async () => {
    const completeWithReceipt = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue({ gemsGranted: 0 });
    const startScene = vi.fn(), showStorySaveFailure = vi.fn();
    const Scene = sourceClass("src/scenes/StageStoryScene.ts", "StageStoryScene", {
      Phaser: { Scene: class {} }, storyManager: { completeWithReceipt }, startScene, showStorySaveFailure,
    });
    const scene = Object.assign(Object.create(Scene.prototype), {
      story: { id: "opening-train" }, exitTo: "stageMap", popups: {}, claimChapterGems: async () => undefined,
    });
    scene.finish();
    await vi.waitFor(() => expect(showStorySaveFailure).toHaveBeenCalledOnce());
    expect(startScene).not.toHaveBeenCalled(); expect(scene.leaving).toBe(false);
    showStorySaveFailure.mock.calls[0][2]();
    await vi.waitFor(() => expect(startScene).toHaveBeenCalledWith(scene, "stageMap"));
  });

  it.each([false, true])("소개 닫기·씬 종료 뒤 잔류 트윈과 독립 섬광을 정리한다: %s", (sceneAlreadyDestroyed) => {
    let destroyed = false;
    const handles: Array<{ remove: () => void; tick: () => void }> = [];
    const text = { active: true, width: 50, height: 20, setAlpha() { return this; }, setCrop() { if (destroyed) throw Error("destroyed Text"); return this; } };
    const scene = { tweens: { add(config: { onUpdate?: () => void }) {
      let active = true;
      const tween = { remove() { active = false; }, tick() { if (active) config.onUpdate?.(); } };
      handles.push(tween); return tween;
    } }, time: { delayedCall: () => ({ remove: vi.fn() }) }, events: { off: vi.fn() } };
    const Showcase = sourceClass("src/ui/NewRelicShowcase.ts", "NewRelicShowcase", {
      SHOWCASE_VOICE: { y: 100, wipeMs: 760, holdMs: 1300, line: { ms: 520 } },
      setDebugRelicShowcase: vi.fn(), Phaser: { Scenes: { Events: { SHUTDOWN: "shutdown" } } },
    });
    const showcase = Object.assign(Object.create(Showcase.prototype), {
      scene, phase: "stage", options: {}, voiceText: text, voiceLine: { setScale: vi.fn() },
      ownedTweens: [], voiceTweens: [], detachedEffects: [{ destroy: vi.fn() }], puppets: [], stopOmen: vi.fn(),
      info: { destroy: vi.fn() }, root: { destroy() { destroyed = true; } }, resolve: vi.fn(),
    });
    showcase.startVoice();
    expect(handles).toHaveLength(3);
    const detached = showcase.detachedEffects[0];
    if (sceneAlreadyDestroyed) { destroyed = true; text.active = false; }
    showcase.close();
    expect(detached.destroy).toHaveBeenCalledOnce();
    expect(() => handles.forEach(tween => tween.tick())).not.toThrow();
    expect(showcase.resolve).toHaveBeenCalledOnce();
    showcase.close();
    expect(showcase.resolve).toHaveBeenCalledOnce();
  });
});
