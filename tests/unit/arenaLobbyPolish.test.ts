import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARENA_MATCH_INTRO, arenaMatchIntroDuration } from "../../src/ui/arenaMatchIntroStyle";

/** 강조 버튼과 발광의 깎임 계약 — Phaser 없이 같은 공식을 다시 재서 빗변이 평행·같은 간격인지 본다. */
function bevel(height: number, grow: { x: number; y: number }): { button: number; glow: number } {
  const b = height * 0.52;
  const d = (grow.x + grow.y) / 2;
  return { button: b, glow: b + d * (2 - Math.SQRT2) };
}

describe("아레나 확정 버튼 발광", () => {
  it("발광의 빗변이 버튼 빗변을 바깥으로 민 같은 45° 선이다", () => {
    for (const [w, h, grow] of [[500, 96, { x: 14, y: 6 }], [640, 132, { x: 14, y: 8 }]] as const) {
      const { button, glow } = bevel(h, grow);
      // 왼쪽 위 빗변: x + y = 상수. 버튼은 -w/2-h/2+b, 발광은 -(w/2+gx)-(h/2+gy)+b'.
      const buttonLine = -w / 2 - h / 2 + button;
      const glowLine = -(w / 2 + grow.x) - (h / 2 + grow.y) + glow;
      const d = (grow.x + grow.y) / 2;
      expect(buttonLine - glowLine).toBeCloseTo(d * Math.SQRT2, 6);
    }
  });

  it("밴픽 화면이 공용 발광 실루엣을 쓴다(기본 깎임 chipPoints로 되돌리지 않는다)", () => {
    const src = readFileSync("src/scenes/ArenaRoomScene.ts", "utf8");
    expect(src).toContain("primaryButtonGlowShape(at.width, at.height, at.glow)");
    expect(src).not.toMatch(/chipPoints\(at\.width \+ at\.glow/);
  });
});

describe("아레나 입구 도움말", () => {
  it("규칙 글을 로비에 늘 세우지 않고 도움말 버튼이 연다", () => {
    const src = readFileSync("src/scenes/ArenaScene.ts", "utf8");
    expect(src).not.toContain("arena.lobby.rules");
    expect(src).toContain("openArenaHelpPopup(this, this.popups)");
  });
});

describe("매칭 VS 연출", () => {
  it("밴 시계를 오래 붙잡지 않는다", () => {
    expect(arenaMatchIntroDuration(false)).toBeLessThanOrEqual(2000);
    expect(arenaMatchIntroDuration(true)).toBeLessThanOrEqual(2000);
  });
  it("VS가 띠가 거의 선 뒤에 떨어진다", () => {
    const S = ARENA_MATCH_INTRO;
    expect(S.slamDelayMs + S.slamMs).toBeGreaterThanOrEqual(S.slideInMs * 0.8);
  });
});
