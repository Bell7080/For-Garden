import { describe, expect, it } from "vitest";
import { ARENA_ROOM_LAYOUT as L } from "../../src/ui/arenaRoomLayout";

/** 아레나 밴픽 화면의 버튼·빛·칸이 서로 겹치지 않는다(겹치면 누른 손이 엉뚱한 것에 닿거나 빛이 이웃을 덮는다). */
type Box = { left: number; right: number; top: number; bottom: number };
const box = (x: number, y: number, w: number, h: number): Box => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("아레나 밴픽 배치", () => {
  const c = L.confirm;
  const confirmGlow = box(c.x, c.y, c.width + c.glow.x * 2, c.height + c.glow.y * 2);
  const undo = box(L.undo.x, L.undo.y, L.undo.width, L.undo.height);
  // 고른 내 칸의 빛은 칸보다 사방 12px 크다.
  const allySlots = L.slotX.map((x) => box(x, L.allyRow, L.slot.width + 24, L.slot.height + 24));

  it("픽 확정과 그 빛은 격자 창 아래, 내 칸 위의 띠 안에 든다", () => {
    expect(confirmGlow.top).toBeGreaterThan(L.grid.bottom);
    for (const slot of allySlots) expect(overlaps(confirmGlow, slot)).toBe(false);
  });

  it("되돌리기는 확정의 빛·내 칸·밴 띠와 겹치지 않는다", () => {
    expect(overlaps(undo, confirmGlow)).toBe(false);
    for (const slot of allySlots) expect(overlaps(undo, slot)).toBe(false);
    const ban = L.banColumn;
    expect(undo.top).toBeGreaterThan(ban.y[1] + ban.card.height / 2);
    expect(undo.top).toBeGreaterThan(L.grid.bottom);
  });

  it("밴 확정과 빛은 밴 칸 안에 든다", () => {
    const b = L.banConfirm;
    const glow = box(b.x, b.y, b.width + b.glow.x * 2, b.height + b.glow.y * 2);
    const slot = box(L.banSlot.x, L.banSlot.y, L.banSlot.width, L.banSlot.height);
    expect(glow.left).toBeGreaterThanOrEqual(slot.left);
    expect(glow.right).toBeLessThanOrEqual(slot.right);
    expect(glow.top).toBeGreaterThanOrEqual(slot.top);
    expect(glow.bottom).toBeLessThanOrEqual(slot.bottom);
  });

  it("밴 띠는 격자와 겹치지 않고 안에 든다", () => {
    const ban = L.banColumn;
    expect(ban.x + ban.card.width / 2).toBeLessThan(L.grid.left);
    for (const y of ban.y) {
      expect(y - ban.card.height / 2 - 50).toBeGreaterThan(L.grid.top);
      expect(y + ban.card.height / 2).toBeLessThan(L.grid.bottom);
    }
  });

  it("왼쪽 위 기권 · 가운데 제목 · 오른쪽 위 시계가 한 줄에서 떨어져 선다", () => {
    expect(L.forfeit.x + L.forfeit.width / 2).toBeLessThan(540 - 260);
    expect(L.clock.x - 85).toBeGreaterThan(540 + 260);
  });
});
