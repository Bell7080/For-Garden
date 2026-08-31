import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import {
  DEFAULT_ULTIMATE_PRESENTATION,
  ULTIMATE_PRESENTATIONS,
  ultimatePresentationFor,
} from "../../src/data/ultimatePresentations";
import { ultimateCutInMaskLayout, type CutInPoint } from "../../src/ui/ultimateCutInLayout";

/** 테스트 표본이 폴리곤 안에 있는지 판정하는 광선 교차 방식의 순수 검사다. */
function containsPoint(polygon: readonly CutInPoint[], point: CutInPoint): boolean {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("ultimate presentation presets", () => {
  it("keeps an explicit preset for every currently shipped relic", () => {
    // 신규 정의에 프리셋을 깜빡하면 이 차집합이 해당 렐릭 ID를 바로 보여 준다.
    const missing = RELICS.map((relic) => relic.id).filter((id) => !ULTIMATE_PRESENTATIONS[id]);
    expect(missing).toEqual([]);
  });

  it("uses the restrained shared default for an unknown future relic", () => {
    // 아직 표에 등록되지 않은 콘텐츠도 Phaser 객체 생성 전에 안전한 값을 얻는다.
    expect(ultimatePresentationFor("future-relic")).toBe(DEFAULT_ULTIMATE_PRESENTATION);
    // 흔들림과 발돋움은 "한 대 세게 쳤다"를 알리는 정도까지다. 화면을 덮는 연출이 사라진
    // 자리를 여기서 과하게 키우면 전투가 다시 느려진다.
    expect(DEFAULT_ULTIMATE_PRESENTATION.cameraShakeIntensity).toBeLessThanOrEqual(0.012);
    expect(DEFAULT_ULTIMATE_PRESENTATION.zoomScale).toBeLessThanOrEqual(1.35);
    expect(DEFAULT_ULTIMATE_PRESENTATION.zoomMs).toBeLessThanOrEqual(200);
    // 컷인은 이름을 읽을 만큼만 머문다. 여기가 늘면 전투가 매번 그만큼 멈춘다.
    expect(DEFAULT_ULTIMATE_PRESENTATION.cutInHoldMs).toBeLessThanOrEqual(160);
  });
});

describe("ultimate cut-in artwork mask layout", () => {
  const layout = ultimateCutInMaskLayout(1080);
  // 실제 GeometryMask와 똑같이 두 폴리곤의 합집합을 판정한다.
  const visible = (point: CutInPoint): boolean => containsPoint(layout.panel, point) || containsPoint(layout.upperBand, point);

  it("clips the pelvis and screen bottom at the slanted panel boundary", () => {
    expect(visible({ x: 540, y: 1200 })).toBe(true);
    expect(visible({ x: 540, y: 1420 })).toBe(false);
  });

  it("allows the head and shoulders through only the upper band", () => {
    expect(visible({ x: 540, y: 250 })).toBe(true);
    // 띠 옆의 같은 높이는 열지 않아 상단 전체가 무제한으로 돌출되지 않는다.
    expect(visible({ x: 40, y: 250 })).toBe(false);
  });

  it("preserves the panel's asymmetric left and right slanted edges", () => {
    expect(visible({ x: -30, y: 500 })).toBe(true);
    expect(visible({ x: -30, y: 1300 })).toBe(false);
    expect(visible({ x: 1110, y: 1100 })).toBe(true);
    expect(visible({ x: 1110, y: 400 })).toBe(false);
  });
});
