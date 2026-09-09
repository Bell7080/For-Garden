import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** BattleScene의 Canvas 표현은 DOM 단위 테스트가 불가능해 공개 경계의 코드 순서를 회귀 계약으로 고정한다. */
describe("BattleScene 전투원 원자적 공개", () => {
  const source = readFileSync(new URL("../../src/scenes/BattleScene.ts", import.meta.url), "utf8");

  it("모든 spawn을 allSettled로 준비하고 세대가 지난 결과를 폐기한다", () => {
    // 직렬 await로 돌아가면 먼저 끝난 SD가 보이는 중간 프레임이 생기므로 병렬 장벽 자체를 검사한다.
    expect(source).toContain("Promise.allSettled(this.state.fighters.map(prepare))");
    expect(source).toContain("token === this.spawnGeneration && this.scene.isActive()");
    expect(source).toContain("this.spawnGeneration += 1");
  });

  it("숨긴 Puppet 전원을 views에 등록한 뒤 같은 공개 단계에서 표시한다", () => {
    const hidden = source.indexOf("creature.setVisible(false)");
    const registered = source.indexOf("this.views.set(fighter.id");
    const revealed = source.indexOf("prepared.forEach(({ creature }) => creature.setVisible(true))");
    const started = source.indexOf("this.spawned = true", revealed);
    // 0명/일부만 보이는 상태가 전투 시작 상태로 관찰되지 않는 핵심 순서를 직접 잠근다.
    expect(hidden).toBeGreaterThan(-1);
    expect(registered).toBeGreaterThan(hidden);
    expect(revealed).toBeGreaterThan(registered);
    expect(started).toBeGreaterThan(revealed);
  });
});
