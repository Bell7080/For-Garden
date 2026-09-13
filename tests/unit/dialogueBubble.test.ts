import { describe, expect, it } from "vitest";
import {
  DIALOGUE_BUBBLE, dialogueBubbleCenterY, dialogueBubbleHeight, dialogueBubbleWrap,
} from "../../src/ui/dialogueBubbleLayout";
import {
  LOBBY_ACTION_BOUNDS, LOBBY_BOND_MARK, LOBBY_DIALOGUE, LOBBY_RAIL_BOUNDS, lobbyBoundsIntersect,
} from "../../src/ui/lobbyLayout";
import { BASE_WIDTH } from "../../src/config/gameConfig";

describe("공용 대사창", () => {
  it("의 높이는 실제 글 높이에서 거꾸로 구한다", () => {
    // 손으로 적어 두면 대사가 길어지거나 언어를 바꿀 때마다 아래 여백이 어긋난다.
    const tall = dialogueBubbleHeight(300);
    expect(tall).toBe(DIALOGUE_BUBBLE.padTop + 300 + DIALOGUE_BUBBLE.padBottom);
    // 한 줄짜리 짧은 대사도 띠로 읽히는 최소 높이를 지킨다.
    expect(dialogueBubbleHeight(10)).toBe(DIALOGUE_BUBBLE.minHeight);
  });

  it("의 본문은 좌우 여백만큼만 좁아진다", () => {
    expect(dialogueBubbleWrap(600)).toBe(600 - DIALOGUE_BUBBLE.padX * 2);
  });

  it("은 밑변을 걸어 대사가 길어져도 아래로 자라지 않는다", () => {
    const short = dialogueBubbleCenterY(1000, 120);
    const long = dialogueBubbleCenterY(1000, 300);
    expect(short + 120 / 2).toBe(1000);
    expect(long + 300 / 2).toBe(1000);
    // 위·가운데로 걸 수도 있다 — 무엇을 피해야 하는지는 화면이 고른다.
    expect(dialogueBubbleCenterY(1000, 120, "top")).toBe(1060);
    expect(dialogueBubbleCenterY(1000, 120, "center")).toBe(1000);
  });

  it("의 이름표는 본문보다 작고 띠 왼쪽 변 안에 선다", () => {
    // 이름이 본문보다 크면 누가 말하는지가 무슨 말인지보다 먼저 읽힌다.
    expect(DIALOGUE_BUBBLE.nameSize).toBeLessThan(DIALOGUE_BUBBLE.bodySize);
    // 이름표는 깎인 모서리 안쪽에서 시작한다.
    expect(DIALOGUE_BUBBLE.nameInset).toBeGreaterThanOrEqual(DIALOGUE_BUBBLE.slant);
  });
});

/** 대사창이 실제로 서는 상자. 밑변을 걸므로 최소 높이에서 가장 위까지 훑는다. */
function lobbyDialogueBounds(bodyHeight: number) {
  const height = dialogueBubbleHeight(bodyHeight);
  return { x: LOBBY_DIALOGUE.centerX, y: dialogueBubbleCenterY(LOBBY_DIALOGUE.bottom, height), width: LOBBY_DIALOGUE.width, height };
}

describe("로비 대사창의 자리", () => {
  it("는 오른쪽 레일과 결투 버튼 사이의 빈 띠에 든다", () => {
    // 예전 자리(y 900)는 친구·가방 아이콘을 통째로 덮어, 말을 듣는 동안 누를 것이 사라졌다.
    const bounds = lobbyDialogueBounds(0);
    for (const rail of [...Object.values(LOBBY_RAIL_BOUNDS.content), ...Object.values(LOBBY_RAIL_BOUNDS.utility)]) {
      expect(lobbyBoundsIntersect(bounds, rail)).toBe(false);
    }
    expect(lobbyBoundsIntersect(bounds, LOBBY_ACTION_BOUNDS.expedition)).toBe(false);
    expect(lobbyBoundsIntersect(bounds, LOBBY_ACTION_BOUNDS.sortie)).toBe(false);
  });

  it("는 세 줄짜리 긴 대사도 결투 버튼을 넘지 않는다", () => {
    // 밑변을 걸었으므로 길어진 만큼은 위로만 자란다 — 아래의 조작 줄은 언제나 비어 있다.
    const bounds = lobbyDialogueBounds(DIALOGUE_BUBBLE.bodySize * 3);
    expect(bounds.y + bounds.height / 2).toBe(LOBBY_DIALOGUE.bottom);
    expect(LOBBY_DIALOGUE.bottom).toBeLessThan(LOBBY_ACTION_BOUNDS.expedition.y - LOBBY_ACTION_BOUNDS.expedition.height / 2);
  });

  it("는 화면 안에 들고, 유대 표식은 그 바깥 위에 선다", () => {
    const bounds = lobbyDialogueBounds(0);
    expect(bounds.x - bounds.width / 2).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width / 2).toBeLessThanOrEqual(BASE_WIDTH);
    // 오른 유대는 대사 안에 박히지 않고 띠 위에서 떠오른다.
    expect(LOBBY_BOND_MARK.y).toBeLessThan(bounds.y - bounds.height / 2);
  });
});
