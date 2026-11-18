import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAUSE_REPORT_MS, ULTIMATE_STALL_MS } from "../../src/core/battleControls";

/**
 * 전투가 시작하자마자 캐릭터만 서 있던 고장(v0.510.4) — 조작 칩은 다 눌리는데 코어 시간이 흐르지 않았다.
 * 코어 시간을 멈추는 것은 `anyPopupOpen`이었고, 그 값이 전역 셈이라 한 번 어긋나면 보이지 않는 판이 판을 붙잡았다.
 * 화면 동작은 Canvas 안이라 값으로 남지 않으므로 소스의 모양으로 지킨다.
 */
describe("전투 멈춤 방지", () => {
  const layer = readFileSync("src/ui/PopupLayer.ts", "utf8");
  const battle = readFileSync("src/scenes/BattleScene.ts", "utf8");

  it("열린 판은 전역 셈이 아니라 살아 있는 층을 훑어 센다", () => {
    expect(layer).not.toMatch(/openLayerCount/);
    expect(layer).toMatch(/LIVE_LAYERS\.some\(\(layer\) => layer\.holdsOpenPopup\(\)\)/);
  });

  it("돌지 않는 씬(잠듦·내려감)의 판과 부서진 판은 세지 않는다", () => {
    const body = layer.slice(layer.indexOf("  holdsOpenPopup(): boolean {"), layer.indexOf("  holdsOpenPopup(): boolean {") + 400);
    expect(body).toContain("this.scene.sys.isActive()");
    expect(body).toContain("layer.active");
  });

  it("이미 내려간 화면에 늦게 열린 판은 장부에 올리지 않는다", () => {
    const open = layer.slice(layer.indexOf("  open("));
    const guard = open.indexOf("if (sceneGone(this.scene)) return body;");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(open.indexOf("this.stack.push(layer);"));
  });

  it("전투는 풀리지 않는 궁극기 잠금을 스스로 풀고, 오래 멈춘 이유를 보고한다", () => {
    expect(battle).toContain("this.watchUltimateSequence(now)");
    expect(battle).toContain("this.watchPausedSimulation(now)");
    expect(battle).toContain("this.ultimateSequenceSince = performance.now();");
    // 새 순서 상태로 갈아 끼워야 늦게 끝난 옛 연출의 토큰이 새 잠금을 풀지 못한다.
    const watch = battle.slice(battle.indexOf("  private watchUltimateSequence"), battle.indexOf("  private watchPausedSimulation"));
    expect(watch).toContain("this.ultimateSequence = createUltimateSequenceState();");
    expect(watch).toContain("this.ultimateSequenceActive = false;");
  });

  it("감시 시간은 가장 긴 연출보다 넉넉하고, 판을 읽는 손보다 길다", () => {
    expect(ULTIMATE_STALL_MS).toBeGreaterThanOrEqual(8_000);
    expect(PAUSE_REPORT_MS).toBeGreaterThan(ULTIMATE_STALL_MS);
  });
});
