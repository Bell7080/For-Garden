import { describe, expect, it } from "vitest";
import { DIALOGUE_PANEL, dialogueBodyHeight, dialogueChoiceShade, dialogueChoiceY } from "../../src/ui/dialoguePanelLayout";
import { DIALOGUE_PANEL_TOP } from "../../src/ui/dialogueStageLayout";
import { ANNIHILATION_TITLED_IDS, dialogueSpeakerId, dialogueSpeakerTitle } from "../../src/ui/dialogueSpeakerTitle";
import { RELICS } from "../../src/data/relics";

describe("대사판 자리표", () => {
  it("수식어 줄은 이름표 아래·본문 위에 서고, 본문은 진행 표식 위에서 끝난다", () => {
    const { name, title, body, next } = DIALOGUE_PANEL;
    expect(title.y - title.size / 2).toBeGreaterThan(name.y + name.size / 2 - 8);
    expect(body.y).toBeGreaterThan(title.y + title.size / 2);
    expect(dialogueBodyHeight()).toBeGreaterThanOrEqual(260);
    expect(body.bottom).toBeLessThan(next.y);
  });

  it.each([1, 2, 3, 4])("선택지 %i개는 겹치지 않고 조작 칩 줄 위에서 끝난다", (count) => {
    const { height } = DIALOGUE_PANEL.choice;
    for (let index = 1; index < count; index += 1) {
      expect(dialogueChoiceY(index, count) - dialogueChoiceY(index - 1, count)).toBeGreaterThanOrEqual(height);
    }
    expect(dialogueChoiceY(count - 1, count) + height / 2).toBeLessThan(DIALOGUE_PANEL.toolsTop);
    expect(dialogueChoiceY(0, count) - height / 2).toBeGreaterThan(200);
    const shade = dialogueChoiceShade(count);
    expect(shade.top).toBeLessThan(dialogueChoiceY(0, count) - height / 2);
    expect(shade.bottom).toBe(DIALOGUE_PANEL_TOP - 10);
  });
});

describe("대사판 화자 수식어", () => {
  it("공멸 직책표의 개체는 모두 실제 공멸 렐릭이다", () => {
    for (const id of ANNIHILATION_TITLED_IDS) {
      const relic = RELICS.find((entry) => entry.id === id);
      expect(relic, id).toBeDefined();
      expect(relic?.squad, id).toBe("annihilation");
      expect(dialogueSpeakerTitle(id)?.text, id).toBeTruthy();
    }
  });

  it("지문·정체를 감춘 화자에는 수식어가 서지 않는다", () => {
    expect(dialogueSpeakerId("")).toBeUndefined();
    expect(dialogueSpeakerId("???", "koma")).toBeUndefined();
    expect(dialogueSpeakerTitle(undefined)).toBeUndefined();
  });

  it("스탠딩이 없어도 이름으로 화자를 찾는다", () => {
    const koma = RELICS.find((entry) => entry.id === "koma");
    expect(dialogueSpeakerId(koma!.name)).toBe("koma");
  });
});
