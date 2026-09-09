import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** BattleScene의 Canvas 표현은 DOM 단위 테스트가 불가능해 공개 경계의 코드 순서를 회귀 계약으로 고정한다. */
describe("BattleScene 전투원 원자적 공개", () => {
  const source = readFileSync(new URL("../../src/scenes/BattleScene.ts", import.meta.url), "utf8");

  it("각 spawn을 독립적으로 준비하고 세대가 지난 결과를 게시 직전에 폐기한다", () => {
    const prepared = source.indexOf("prepared = await prepare(fighter)");
    const guarded = source.indexOf("if (!this.isCurrentSpawn(token))", prepared);
    const registered = source.indexOf("this.views.set(fighter.id", guarded);
    // 세대 검사는 각 비동기 결과의 await와 실제 view 소유권 이전 사이에 있어야 한다.
    expect(source).not.toContain("Promise.allSettled(this.state.fighters.map(prepare))");
    expect(prepared).toBeGreaterThan(-1);
    expect(guarded).toBeGreaterThan(prepared);
    expect(registered).toBeGreaterThan(guarded);
    expect(source).toContain("token === this.spawnGeneration && this.scene.isActive()");
    expect(source).toContain("this.spawnGeneration += 1");
  });

  it("한 Fighter의 Puppet과 부속을 모두 views에 등록한 뒤 같은 게시 구간에서 표시한다", () => {
    const hidden = source.indexOf("creature.setVisible(false)");
    const registered = source.indexOf("this.views.set(fighter.id");
    const shadowRevealed = source.indexOf("shadow.setVisible(true)", registered);
    const healthRevealed = source.indexOf("hpBar.setVisible(true)", shadowRevealed);
    const statusRevealed = source.indexOf("statusChips.setVisible(true)", healthRevealed);
    const revealed = source.indexOf("creature.setVisible(true)", statusRevealed);
    // 몸과 부속이 views 소유권을 얻기 전에 노출되지 않고 Puppet은 완성된 단위의 마지막에 열린다.
    expect(hidden).toBeGreaterThan(-1);
    expect(registered).toBeGreaterThan(hidden);
    expect(shadowRevealed).toBeGreaterThan(registered);
    expect(healthRevealed).toBeGreaterThan(shadowRevealed);
    expect(statusRevealed).toBeGreaterThan(healthRevealed);
    expect(revealed).toBeGreaterThan(statusRevealed);
  });

  it("view 등록 뒤 fallback을 제거하고 그 뒤에만 Puppet을 공개한다", () => {
    const registered = source.indexOf("this.views.set(fighter.id");
    const removed = source.indexOf("this.fighterFallbacks.delete(fighter.id)", registered);
    const revealed = source.indexOf("creature.setVisible(true)", removed);
    // 같은 이벤트 루프 안의 교체 순서를 잠가 마커와 본체가 함께 합성되는 프레임을 막는다.
    expect(removed).toBeGreaterThan(registered);
    expect(revealed).toBeGreaterThan(removed);
  });

  it("빠른 Fighter는 전체 준비 Promise를 기다리기 전에 공개된다", () => {
    const revealed = source.indexOf("creature.setVisible(true)");
    const allFinished = source.indexOf("await Promise.all(pending)", revealed);
    // 전체 await는 전투 시계만 정렬하며, 개별 공개가 그보다 앞이라는 계약을 고정한다.
    expect(revealed).toBeGreaterThan(-1);
    expect(allFinished).toBeGreaterThan(revealed);
  });
});
