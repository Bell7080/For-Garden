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
    expect(DEFAULT_ULTIMATE_PRESENTATION.cameraShakeIntensity).toBeLessThanOrEqual(0.006);
  });
});
