import { describe, expect, it } from "vitest";
import { archaeologyNodeState } from "../../src/core/archaeologyMap";
import { beginStrataSiteCooldown, createArchaeologyState, strataSiteCooldownUntil } from "../../src/core/strataDig";
import { STRATA_SITE_COOLDOWN_MS } from "../../src/data/strataLayers";
import { archaeologySitePopupLayout, POPUP_BODY_BEVEL_RATIO } from "../../src/ui/archaeologySitePopupLayout";
import { archaeologyRatingColor, STRATA_ZONE_TONE } from "../../src/ui/strataTones";

const NOW = new Date("2026-03-01T00:00:00.000Z");

describe("유적 재사용 대기", () => {
  it("는 판 적 없는 자리를 잠그지 않는다", () => {
    expect(createArchaeologyState().siteCooldowns).toEqual({});
    expect(strataSiteCooldownUntil({}, "garden-gate", NOW)).toBeNull();
  });

  it("는 여섯 시간 뒤에 저절로 풀린다", () => {
    const cooldowns = beginStrataSiteCooldown({}, "garden-gate", NOW);
    expect(strataSiteCooldownUntil(cooldowns, "garden-gate", NOW)).toBe(new Date(NOW.getTime() + STRATA_SITE_COOLDOWN_MS).toISOString());
    // 충전 간격(3시간)의 두 배다 — 한 바퀴 도는 동안 처음 판 자리가 다시 열린다.
    const justBefore = new Date(NOW.getTime() + STRATA_SITE_COOLDOWN_MS - 1000);
    expect(strataSiteCooldownUntil(cooldowns, "garden-gate", justBefore)).not.toBeNull();
    expect(strataSiteCooldownUntil(cooldowns, "garden-gate", new Date(NOW.getTime() + STRATA_SITE_COOLDOWN_MS))).toBeNull();
    // 다른 자리는 함께 잠기지 않는다 — 다섯 번이 서로 다른 자리로 흩어지게 하는 것이 이 규칙의 뜻이다.
    expect(strataSiteCooldownUntil(cooldowns, "rust-canal", NOW)).toBeNull();
  });

  it("는 읽을 수 없는 시각을 「열려 있음」으로 만들지 않는다", () => {
    // 손상된 저장이 제한을 통째로 지우는 쪽보다, 지금 막 시작한 것으로 보는 쪽이 안전하다.
    expect(strataSiteCooldownUntil({ "garden-gate": "어제" }, "garden-gate", NOW))
      .toBe(new Date(NOW.getTime() + STRATA_SITE_COOLDOWN_MS).toISOString());
  });
});

describe("지도 노드 상태", () => {
  const base = { siteId: "garden-gate", unlocked: true, completed: false, cooling: false };

  it("는 진행 중인 판을 무엇보다 먼저 말한다", () => {
    // 이미 횟수를 치른 자리라 잠김·대기·완료 어느 것도 그보다 앞설 수 없다.
    expect(archaeologyNodeState({ ...base, unlocked: false, completed: true, cooling: true, activeSiteId: "garden-gate" })).toBe("active");
  });

  it("는 못 가는 이유를 한 낱말로 뭉치지 않는다", () => {
    expect(archaeologyNodeState({ ...base, unlocked: false })).toBe("locked");
    expect(archaeologyNodeState({ ...base, cooling: true })).toBe("cooling");
    expect(archaeologyNodeState({ ...base, completed: true })).toBe("completed");
    expect(archaeologyNodeState(base)).toBe("available");
    // 대기는 완료보다 앞선다 — 완료는 지난 일이고 대기는 지금 막는 것이다.
    expect(archaeologyNodeState({ ...base, completed: true, cooling: true })).toBe("cooling");
  });
});

describe("유적 미리보기 창", () => {
  const spot = archaeologySitePopupLayout(3);

  it("의 높이는 보상 줄 수에서 자란다", () => {
    expect(archaeologySitePopupLayout(4).height).toBeGreaterThan(spot.height);
    expect(spot.rowYs).toHaveLength(3);
  });

  it("의 기대 획득 줄은 모두 그 판 안에 선다", () => {
    const top = spot.panel.y - spot.panel.height / 2;
    const bottom = spot.panel.y + spot.panel.height / 2;
    for (const y of spot.rowYs) {
      expect(y).toBeGreaterThan(top);
      expect(y).toBeLessThan(bottom);
    }
    // 줄 간격이 고르다 — 한 줄만 붙어 서면 그 보상이 다른 무게로 읽힌다.
    expect(spot.rowYs[1] - spot.rowYs[0]).toBeCloseTo(spot.rowYs[2] - spot.rowYs[1]);
  });

  it("의 판과 버튼은 몸판의 깎인 모서리 밖으로 나가지 않는다", () => {
    const bevel = Math.min(spot.width, spot.height) * POPUP_BODY_BEVEL_RATIO;
    const panelLeft = -spot.panel.width / 2;
    const panelTop = spot.panel.y - spot.panel.height / 2;
    // 왼쪽 위 빗변: (x + w/2) + (y + h/2) 가 깎인 길이보다 커야 그 안에 든다.
    expect((panelLeft + spot.width / 2) + (panelTop + spot.height / 2)).toBeGreaterThan(bevel);
    // 두 버튼이 판 폭 안에서 겹치지 않는다.
    expect(spot.buttonCenters[0] + spot.buttonWidth / 2).toBeLessThan(spot.buttonCenters[1] - spot.buttonWidth / 2);
    expect(spot.buttonCenters[0] - spot.buttonWidth / 2).toBeGreaterThan(-spot.width / 2);
    expect(spot.buttonY + spot.buttonHeight / 2).toBeLessThan(spot.height / 2);
    // 게이지도 판 오른쪽 변 안에 든다.
    expect(spot.gaugeX + spot.gauge.width / 2).toBeLessThanOrEqual(spot.panel.width / 2);
    expect(spot.gaugeX - spot.gauge.width / 2).toBeGreaterThan(spot.labelX);
  });
});

describe("구역 색", () => {
  it("은 가장 흔한 흙빛을 칠하지 않는다", () => {
    // 넷 중 가장 흔한 색이라 칠하면 판 전체가 물들어 특화 구역이 도리어 묻힌다.
    expect(STRATA_ZONE_TONE.soil.alpha).toBe(0);
    for (const tone of ["teal", "gold", "deep"] as const) expect(STRATA_ZONE_TONE[tone].alpha).toBeGreaterThan(0);
  });

  it("의 기대도 게이지는 칸이 찰수록 다른 색으로 선다", () => {
    const colors = [1, 2, 3, 4, 5].map((filled) => archaeologyRatingColor(filled));
    expect(new Set(colors).size).toBe(5);
    // 빈 줄도 색을 고르지 못해 던지지 않는다.
    expect(archaeologyRatingColor(0)).toBe(colors[0]);
  });
});
