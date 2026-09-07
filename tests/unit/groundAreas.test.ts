import { describe, expect, it } from "vitest";
import {
  battlefieldWashBands,
  groundAreaStyle,
  HOSTILE_AREA_COLOR,
  laneAreaPoints,
  radialAreaPoints,
  SUPPORTIVE_AREA_COLOR,
  statusAreaColor,
} from "../../src/ui/groundAreas";
import { UNIT_STATUS_COLOR } from "../../src/ui/unitStatusModel";
import { AREA_IMPACT } from "../../src/ui/effectPresets";
import { DAMAGE_FLAVOR_COLOR } from "../../src/ui/damageNumbers";
import { readFileSync } from "node:fs";

describe("바닥 범위 표시의 색", () => {
  it("우리 편이 맞는 범위는 피해 종류를 가리지 않고 붉은 계열 하나다", () => {
    // 난전에서 먼저 읽어야 하는 것은 "무엇으로 때리나"가 아니라 "여기 서 있으면 맞는다"다.
    for (const damageType of ["physical", "magical", "true"] as const) {
      expect(groundAreaStyle({ hostile: true, damageType, ultimate: false }).color).toBe(HOSTILE_AREA_COLOR);
      expect(groundAreaStyle({ hostile: true, damageType, ultimate: true }).color).toBe(HOSTILE_AREA_COLOR);
    }
    // 지원 범위도 적이 깐 것이면 붉다 — 아군 피격이 다른 모든 축보다 먼저다.
    expect(groundAreaStyle({ hostile: true, supportive: true, ultimate: false }).color).toBe(HOSTILE_AREA_COLOR);
  });

  it("적에게 들어가는 범위만 종류별 색을 갖고, 물리와 마법은 가르지 않는다", () => {
    const physical = groundAreaStyle({ hostile: false, damageType: "physical", ultimate: false });
    const magical = groundAreaStyle({ hostile: false, damageType: "magical", ultimate: false });
    // 피해 수치와 같은 규칙이다. 두 곳이 갈리면 같은 타격이 바닥과 숫자에서 다른 색으로 읽힌다.
    expect(physical.color).toBe(magical.color);
    expect(physical.color).toBe(DAMAGE_FLAVOR_COLOR.damage);
    expect(groundAreaStyle({ hostile: false, damageType: "true", ultimate: false }).color).toBe(DAMAGE_FLAVOR_COLOR.true);
    expect(groundAreaStyle({ hostile: false, supportive: true, ultimate: false }).color).toBe(SUPPORTIVE_AREA_COLOR);
  });

  it("상태를 거는 범위는 머리 위 칩과 같은 색으로, 아군 피격보다 먼저 선다", () => {
    // 피해 수치에서 디버프가 받는 쪽에서도 제 색을 지키는 것과 같은 규칙이다 — 같은 상태가
    // 바닥과 머리 위에서 다른 색이면 무엇이 걸렸는지 두 번 읽어야 한다.
    const submerged = groundAreaStyle({ hostile: false, status: "submerged", ultimate: false });
    expect(submerged.color).toBe(statusAreaColor("submerged"));
    expect(statusAreaColor("submerged")).toBe(`#${UNIT_STATUS_COLOR.submerged.toString(16)}`);
    expect(groundAreaStyle({ hostile: true, status: "submerged", ultimate: false }).color).toBe(submerged.color);
  });

  it("궁극기는 색이 아니라 남아 있는 시간으로 갈린다", () => {
    const normal = groundAreaStyle({ hostile: false, damageType: "physical", ultimate: false });
    const ultimate = groundAreaStyle({ hostile: false, damageType: "physical", ultimate: true });
    expect(ultimate.color).toBe(normal.color);
    expect(ultimate.ms).toBeGreaterThan(normal.ms);
  });

  it("모든 범위가 같은 채움·테두리 값을 쓴다", () => {
    // 양식은 하나뿐이다 — 무늬나 두께로 종류를 가르기 시작하면 화면마다 다른 범위 표시가 생긴다.
    const styles = [
      groundAreaStyle({ hostile: true, ultimate: false }),
      groundAreaStyle({ hostile: false, damageType: "true", ultimate: true }),
      groundAreaStyle({ hostile: false, supportive: true, ultimate: false }),
    ];
    for (const style of styles) {
      expect(style.fillAlpha).toBe(AREA_IMPACT.fillAlpha);
      expect(style.backdropAlpha).toBe(AREA_IMPACT.backdropAlpha);
      expect(style.lineAlpha).toBe(AREA_IMPACT.lineAlpha);
      expect(style.lineWidth).toBe(AREA_IMPACT.lineWidth);
    }
    // 채움은 배경 원화가 비쳐야 하므로 옅고, 테두리가 경계를 잡는다.
    expect(AREA_IMPACT.fillAlpha).toBeLessThan(0.3);
    expect(AREA_IMPACT.lineAlpha).toBeGreaterThan(AREA_IMPACT.fillAlpha);
    // 밝은 폐허 도로 위에서도 색이 남으려면 아래로 까는 검은 겹이 색면보다 진해야 한다.
    expect(AREA_IMPACT.backdropAlpha).toBeGreaterThan(AREA_IMPACT.fillAlpha);
    // 그래도 바닥이 통째로 검어지면 배경 원화가 사라진다.
    expect(AREA_IMPACT.backdropAlpha).toBeLessThan(0.5);
  });
});

describe("바닥 범위 표시의 모양", () => {
  it("원은 정원이 아니라 세로로 눌린 마름모다", () => {
    const points = radialAreaPoints(100);
    expect(points).toHaveLength(4);
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    // 정원을 그리면 바닥에 누운 것이 아니라 캐릭터 앞에 세워 둔 고리처럼 보인다.
    expect(height / width).toBeCloseTo(AREA_IMPACT.squash, 5);
  });

  it("통로는 반폭만큼 양 끝이 더 뻗은 늘어난 마름모다", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 400, y: 0 };
    const points = laneAreaPoints(from, to, 110);
    expect(points).toHaveLength(6);
    // 판정이 선분에서 잰 거리라 끝점 너머도 반폭까지 맞는다. 네모로 끊으면 그 몫이 그림에서 빠진다.
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(-110, 5);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(510, 5);
    // 폭은 반폭의 두 배를 바닥으로 누른 값이다.
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(height).toBeCloseTo(220 * AREA_IMPACT.squash, 5);
  });

  it("비스듬한 통로도 폭만 바닥으로 눌린다", () => {
    // 국소 좌표에 그려 두고 컨테이너를 돌리면 눌린 세로까지 함께 돌아가 통로가 일어서 보인다.
    // 눌림을 y 성분에만 적용하므로, 어느 각도로 달려도 **통로의 폭**은 마름모와 같은 만큼만
    // 세로로 벌어진다. 달려간 거리 자체는 실제 전투 좌표라 누르지 않는다.
    const halfWidth = 110;
    for (const angle of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]) {
      const to = { x: Math.cos(angle) * 400, y: Math.sin(angle) * 400 };
      const [, leftSide, , , , rightSide] = laneAreaPoints({ x: 0, y: 0 }, to, halfWidth);
      // 두 옆면 꼭짓점 사이가 곧 통로의 단면이다.
      expect(Math.abs(leftSide.y - rightSide.y)).toBeLessThanOrEqual(2 * halfWidth * AREA_IMPACT.squash + 1e-6);
      expect(Math.abs(leftSide.x - rightSide.x)).toBeLessThanOrEqual(2 * halfWidth + 1e-6);
    }
    // 가로로 달리면 단면이 가장 납작하고, 세로로 달리면 눌림이 걸리지 않아 가장 넓다.
    const flat = laneAreaPoints({ x: 0, y: 0 }, { x: 400, y: 0 }, halfWidth);
    expect(Math.abs(flat[1].y - flat[5].y)).toBeCloseTo(2 * halfWidth * AREA_IMPACT.squash, 5);
    const upright = laneAreaPoints({ x: 0, y: 0 }, { x: 0, y: 400 }, halfWidth);
    expect(Math.abs(upright[1].x - upright[5].x)).toBeCloseTo(2 * halfWidth, 5);
  });

  it("방향이 없는 돌진은 반폭짜리 원으로 되돌린다", () => {
    // 대상이 겹쳐 서 있으면 통로가 길이 0이 되어 그릴 것이 남지 않는다.
    const points = laneAreaPoints({ x: 50, y: 60 }, { x: 50, y: 60 }, 110);
    expect(points).toHaveLength(4);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(160, 5);
  });

  it("전장 워시는 바깥 띠가 가장 진하고 안으로 갈수록 옅어진다", () => {
    const bands = battlefieldWashBands();
    expect(bands.length).toBeGreaterThan(1);
    for (let index = 1; index < bands.length; index += 1) {
      // 안쪽 띠일수록 더 깊이 파고들고 더 옅다 — 빛이 바깥에서 스며드는 결이다.
      expect(bands[index].inset).toBeGreaterThan(bands[index - 1].inset);
      expect(bands[index].alpha).toBeLessThan(bands[index - 1].alpha);
    }
    // 가장 안쪽 띠도 사라지지 않아야 계단이 끊기지 않는다.
    expect(bands[bands.length - 1].alpha).toBeGreaterThan(0);
    // 워시가 전장 절반을 넘게 덮으면 SD와 체력 바가 그 속에 묻힌다.
    expect(bands[bands.length - 1].inset).toBeLessThan(0.5);
  });
});

describe("범위 표시의 단일 소유자", () => {
  it("씬은 범위의 색과 모양을 직접 고르지 않는다", () => {
    const scene = readFileSync(new URL("../../src/scenes/BattleScene.ts", import.meta.url), "utf8");
    const call = scene.slice(scene.indexOf('event.kind === "areaImpact"'), scene.indexOf('event.kind === "teamBuff"'));
    // 사건이 실어 온 모양을 그대로 넘긴다. 씬이 좌표나 반경을 다시 조립하면 판정과 갈린다.
    expect(call).toContain("this.effects.groundArea(event.area");
    // 색은 `groundAreas.ts`가 정한다 — 씬이 시전자 색을 넘기던 옛 경로로 되돌아가지 않는다.
    expect(call).not.toContain("effectColor");
    expect(call).not.toContain("color:");
  });

  it("돌진은 바닥 자국을 두 번 그리지 않는다", () => {
    const scene = readFileSync(new URL("../../src/scenes/BattleScene.ts", import.meta.url), "utf8");
    const charge = scene.slice(scene.indexOf('event.kind === "charge"'), scene.indexOf('event.kind === "damageShared"'));
    // 예전에는 `charge`가 경로 길이만 한 마름모를 따로 깔아, 실제 판정폭보다 훨씬 넓은 범위를
    // 보여 줬다. 통로는 이제 `areaImpact`가 판정과 같은 모양으로 한 번만 그린다.
    expect(charge).not.toContain("groundArea");
  });
});
