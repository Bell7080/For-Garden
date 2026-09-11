import { describe, expect, it } from "vitest";
import { RESEARCH_PRESENTATION_STAGES, ResearchPresentationController, firstMeetingRelicIds, highestRarity } from "../../src/core/researchPresentation";

describe("연구소 획득 연구 연출 상태", () => {
  it("단계를 순서대로 넘기고 전체 건너뛰기는 카드로 간다", () => {
    const controller = new ResearchPresentationController();
    controller.begin();
    expect(controller.stage).toBe("research");
    expect(controller.advance()).toBe("crack");
    expect(controller.advance()).toBe("rarityReveal");
    expect(controller.advance()).toBe("chips");
    expect(controller.advance()).toBe("cards");
    controller.begin();
    expect(controller.skipAll()).toBe("cards");
  });

  it("첫 대면을 자동 단계로 두지 않는다", () => {
    // 새로 만난 렐릭이 든 칸을 여는 그 순간의 연출이다. 자동으로 흘러가는 목록에 끼우면
    // 어느 칸에서 나왔는지와 무관하게 먼저 재생되어 칸을 열 이유가 사라진다.
    expect(RESEARCH_PRESENTATION_STAGES).not.toContain("firstMeeting" as never);
    expect(RESEARCH_PRESENTATION_STAGES.indexOf("chips")).toBeLessThan(RESEARCH_PRESENTATION_STAGES.indexOf("cards"));
  });

  it("연속 요청과 씬 정리로 오래된 비동기 요청을 무효화한다", () => {
    const controller = new ResearchPresentationController();
    const oldRequest = controller.begin();
    const currentRequest = controller.begin();
    expect(controller.isCurrent(oldRequest)).toBe(false);
    expect(controller.isCurrent(currentRequest)).toBe(true);
    controller.invalidate();
    expect(controller.isCurrent(currentRequest)).toBe(false);
  });

  it("배치형 자원 발굴과 혼동되는 단계 식별자를 공개하지 않는다", () => {
    // 연출 단계는 저장/DTO가 아닌 런타임 상수이며, CLAUDE.md의 두 기능 구분을 이름으로도 지킨다.
    expect(RESEARCH_PRESENTATION_STAGES).not.toContain("excavation" as never);
  });

  it("서버 결과의 최고 등급과 다중 신규 첫 대면 순서를 보존한다", () => {
    expect(highestRarity(["R", "SSR", "SR"])).toBe("SSR");
    expect(highestRarity(["GRAY", "GRAY"])).toBe("GRAY");
    const slot = (relicId: string, kind: "new" | "fragment") => ({ type: "relic" as const, relicId, kind, fragments: kind === "fragment" ? 1 : 0, overflowFragments: 0 });
    expect(firstMeetingRelicIds([slot("rex", "new"), slot("anky", "new"), slot("rex", "new"), slot("spino", "fragment")]))
      .toEqual(["rex", "anky"]);
    // 수량형 슬롯은 첫 대면 후보에서 구조적으로 제외된다.
    expect(firstMeetingRelicIds([{ type: "currency", currency: "gold", amount: 10, grade: "GRAY" }])).toEqual([]);
  });
});
