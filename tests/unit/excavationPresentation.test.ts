import { describe, expect, it } from "vitest";
import { ExcavationPresentationController, firstMeetingRelicIds, highestRarity } from "../../src/core/excavationPresentation";

describe("발굴 연출 상태", () => {
  it("단계를 순서대로 넘기고 전체 건너뛰기는 카드로 간다", () => {
    const controller = new ExcavationPresentationController();
    controller.begin();
    expect(controller.stage).toBe("excavation");
    expect(controller.advance()).toBe("crack");
    expect(controller.advance()).toBe("rarityReveal");
    expect(controller.skipAll()).toBe("cards");
  });

  it("연속 요청과 씬 정리로 오래된 비동기 요청을 무효화한다", () => {
    const controller = new ExcavationPresentationController();
    const oldRequest = controller.begin();
    const currentRequest = controller.begin();
    expect(controller.isCurrent(oldRequest)).toBe(false);
    expect(controller.isCurrent(currentRequest)).toBe(true);
    controller.invalidate();
    expect(controller.isCurrent(currentRequest)).toBe(false);
  });

  it("서버 결과의 최고 등급과 다중 신규 첫 대면 순서를 보존한다", () => {
    expect(highestRarity(["R", "SSR", "SR"])).toBe("SSR");
    const slot = (relicId: string, kind: "new" | "mastery") => ({ relicId, kind, dnaBefore: 0, dnaAfter: 0, overflowFragments: 0 });
    expect(firstMeetingRelicIds([slot("rex", "new"), slot("anky", "new"), slot("rex", "new"), slot("spino", "mastery")]))
      .toEqual(["rex", "anky"]);
  });
});
