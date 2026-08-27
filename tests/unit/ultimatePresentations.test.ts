import { describe, expect, it } from "vitest";
import { RELICS } from "../../src/data/relics";
import {
  DEFAULT_ULTIMATE_PRESENTATION,
  ULTIMATE_PRESENTATIONS,
  ultimatePresentationFor,
} from "../../src/data/ultimatePresentations";

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
