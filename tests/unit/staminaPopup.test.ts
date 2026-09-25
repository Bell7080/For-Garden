import { describe, expect, it } from "vitest";
import { staminaTimerLine } from "../../src/ui/staminaDisplay";
import { heroStack, insidePopupBody, STAMINA_CELL, STAMINA_SWAP, staminaPopupLayout } from "../../src/ui/staminaPopupLayout";
import { STAMINA_RECHARGE_SOURCES, staminaAdSlot, staminaConsumable, staminaCurrencyRecharge } from "../../src/data/staminaRecharge";
import { STAMINA_REGEN_INTERVAL_MS } from "../../src/core/stamina";

describe("스테미나 창의 순수 규칙", () => {
  it("은 가득 찼을 때 아무 줄도 만들지 않는다", () => {
    // "가득 참" 같은 문구는 같은 창의 두 수가 이미 말하고 있고 조작을 바꾸지 않는다.
    expect(staminaTimerLine(120, 120, new Date().toISOString(), Date.now())).toBeUndefined();
    expect(staminaTimerLine(121, 120, new Date().toISOString(), Date.now())).toBeUndefined();
  });

  it("은 남은 시간을 분:초로 적고 다음 한 칸까지만 센다", () => {
    const now = Date.parse("2026-09-02T00:00:00Z");
    // 방금 회복한 직후라면 한 구간(5분)이 통째로 남는다.
    expect(staminaTimerLine(10, 120, "2026-09-02T00:00:00Z", now)).toBe("다음 회복까지 5:00");
    // 구간의 절반이 지나면 남은 절반만 센다.
    expect(staminaTimerLine(10, 120, "2026-09-02T00:00:00Z", now + STAMINA_REGEN_INTERVAL_MS / 2)).toBe("다음 회복까지 2:30");
    // 기준 시각이 없는 신규 저장도 창을 비우지 않고 한 구간을 그대로 보여 준다.
    expect(staminaTimerLine(10, 120, "", now)).toBe("다음 회복까지 5:00");
  });

  it("은 세 충전 수단이 모두 실제 서버 경계를 갖는지 확인한다", () => {
    // 경계가 없는 수단을 표에 넣으면 눌러도 아무 일이 없는 칸이 선다.
    expect(STAMINA_RECHARGE_SOURCES.map(({ kind }) => kind)).toEqual(["consumable", "currency", "ad"]);
    for (const source of STAMINA_RECHARGE_SOURCES) {
      if (source.kind === "consumable") {
        // 한 칸이 여러 소비품을 맡으므로 **전부** 실제 회복 효과를 가져야 한다 — 하나라도
        // 비면 좌우로 넘기다 빈 칸이 뜨고, 고른 사람은 무엇이 잘못됐는지 알 수 없다.
        expect(source.itemIds.length).toBeGreaterThan(0);
        for (const itemId of source.itemIds) {
          const item = staminaConsumable(itemId);
          expect(item, itemId).toBeDefined();
          expect(item!.amount).toBeGreaterThan(0);
        }
        // 순서는 기본이 먼저다 — 회복량이 작은 것부터 서야 좌우가 세기 순으로 읽힌다.
        const amounts = source.itemIds.map((itemId) => staminaConsumable(itemId)!.amount);
        expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
      } else if (source.kind === "currency") {
        // 서버가 차감할 값은 화면이 아니라 이 표가 소유한다.
        expect(staminaCurrencyRecharge(source.id)).toBe(source);
        expect(source.cost).toBeGreaterThan(0);
        expect(source.amount).toBeGreaterThan(0);
      } else {
        // 광고는 이미 있는 보상 슬롯을 그대로 쓴다 — 회복량과 일일 한도를 새로 적지 않는다.
        const ad = staminaAdSlot(source.slotId);
        expect(ad, source.slotId).toBeDefined();
        expect(ad!.amount).toBeGreaterThan(0);
        expect(ad!.slot.dailyLimitUtc).toBeGreaterThan(0);
      }
    }
  });
});

describe("스테미나 창의 자리", () => {
  const layout = staminaPopupLayout(1);

  it("의 위쪽 판은 팝업 몸판의 깎인 모서리 안에 든다", () => {
    // 판을 네모(`slantedRect`)로 두면 몸판의 왼쪽 위 빗변을 넘어 밖으로 삐져나온다.
    expect(insidePopupBody(layout, layout.hero)).toBe(true);
    // 제목표가 윗변에 걸터앉으므로 판은 그보다 확실히 아래에서 시작해야 한다.
    expect(layout.hero.y - layout.hero.height / 2).toBeGreaterThan(-layout.height / 2 + 40);
  });

  it("의 충전 칸 셋은 폭도 간격도 같고 가운데를 기준으로 대칭이다", () => {
    const [left, middle, right] = layout.cell.centers;
    expect(middle).toBeCloseTo(0);
    expect(left).toBeCloseTo(-right);
    // 가운데 칸과 양옆 칸의 간격이 같아야 "ㅁㅁㅁ"으로 읽힌다.
    expect(middle - left).toBeCloseTo(right - middle);
    // 세 칸과 그 사이 여백이 판 폭을 정확히 채운다.
    expect(right + layout.cell.width / 2).toBeCloseTo(layout.hero.width / 2);
    expect(left - layout.cell.width / 2).toBeCloseTo(-layout.hero.width / 2);
  });

  it("의 칸과 마지막 사용처 줄은 창 안에 남는다", () => {
    for (const x of layout.cell.centers) {
      expect(Math.abs(x) + layout.cell.width / 2).toBeLessThanOrEqual(layout.width / 2);
      // 양옆 칸도 몸판의 깎인 두 모서리 안쪽에 앉아야 한다.
      expect(insidePopupBody(layout, { y: layout.cell.y, width: (Math.abs(x) + layout.cell.width / 2) * 2, height: layout.cell.height })).toBe(true);
    }
    expect(layout.cell.y + layout.cell.height / 2).toBeLessThan(layout.hairlineY);
    expect(layout.usesFirstRowY).toBeLessThan(layout.height / 2);
  });

  it("의 사용처가 늘면 창이 그만큼 자란다", () => {
    // 높이를 손으로 적으면 줄이 늘어난 순간 마지막 줄이 판 밖으로 밀린다.
    expect(staminaPopupLayout(3).height).toBe(layout.height + layout.usesRowHeight * 2);
  });

  it("의 액자·수치·시간은 시간 줄이 없어도 판 가운데에 머문다", () => {
    const withTimer = heroStack(0, true);
    const withoutTimer = heroStack(0, false);
    const span = (stack: { frameY: number; valueY: number; timerY?: number }, frame: number, tail: number) =>
      ((stack.frameY - frame / 2) + ((stack.timerY ?? stack.valueY) + tail / 2)) / 2;
    // 두 경우 모두 덩어리의 중심이 판 중심(0)에 있다 — 시간이 사라져도 위로 쏠리지 않는다.
    expect(span(withTimer, layout.frameSize, 30)).toBeCloseTo(0);
    expect(span(withoutTimer, layout.frameSize, 58)).toBeCloseTo(0);
    // 시간 줄이 사라지면 남은 둘은 오히려 아래로 내려와 가운데를 지킨다.
    expect(withoutTimer.frameY).toBeGreaterThan(withTimer.frameY);
  });
});

describe("소비품 갈아 끼우기", () => {
  const layout = staminaPopupLayout(3);

  it("는 좌우 버튼이 칸 밖으로 나가지 않는다", () => {
    // 92로 잡았던 때는 바깥 끝이 칸 반폭(114.7)을 0.3px 넘었다.
    const outer = STAMINA_SWAP.x + STAMINA_SWAP.size / 2;
    expect(outer).toBeLessThan(layout.cell.width / 2);
  });

  it("는 좌우 버튼이 액자를 덮지 않는다", () => {
    // 갈아 끼우는 것이 그 그림이라 액자 옆에 붙되, 겹치면 무엇이 바뀌는지 가린다.
    const inner = STAMINA_SWAP.x - STAMINA_SWAP.size / 2;
    expect(inner).toBeGreaterThan(108 / 2);
  });
});

describe("충전 칸 한 장의 세로 자리", () => {
  it("액자 → 회복량 → 이름 → 남은 횟수 → 버튼이 서로 겹치지 않고 칸 안에 든다", () => {
    // 「3/3 남음」 줄이 버튼 윗변에 걸쳐 덮이던 회귀다. 글줄은 글자 크기만큼의 높이를 차지한다고 본다.
    const c = STAMINA_CELL;
    const rows = [
      { top: c.frameY - c.frameSize / 2, bottom: c.frameY + c.frameSize / 2 },
      { top: c.gainY - c.gainSize * 0.6, bottom: c.gainY + c.gainSize * 0.6 },
      { top: c.nameY - c.nameSize * 0.6, bottom: c.nameY + c.nameSize * 0.6 },
      { top: c.detailY - c.detailSize * 0.6, bottom: c.detailY + c.detailSize * 0.6 },
      { top: c.buttonY - c.buttonHeight / 2, bottom: c.buttonY + c.buttonHeight / 2 },
    ];
    for (let index = 1; index < rows.length; index++) expect(rows[index].top).toBeGreaterThanOrEqual(rows[index - 1].bottom);
    const half = staminaPopupLayout(3).cell.height / 2;
    expect(rows[0].top).toBeGreaterThanOrEqual(-half);
    expect(rows[rows.length - 1].bottom).toBeLessThanOrEqual(half);
    // 갈아 끼우는 화살표는 액자 밖에 선다.
    expect(STAMINA_SWAP.x - STAMINA_SWAP.size / 2).toBeGreaterThan(c.frameSize / 2);
  });
});
