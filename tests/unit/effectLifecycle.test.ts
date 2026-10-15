import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";

vi.mock("phaser", () => ({ default: {
  Display: { Color: { HexStringToColor: () => ({ color: 0x141821 }) } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Geom: { Point: class { constructor(public x: number, public y: number) {} } },
  BlendModes: { NORMAL: 0, ADD: 1 },
} }));

import { EffectManager } from "../../src/managers/EffectManager";
import { INK_PROJECTILE, INK_STRIKE, projectilePosition } from "../../src/ui/effectPresets";

type Animation = { targets: { t: number }; onStart?: () => void; onUpdate?: () => void; onComplete?: () => void };
class Image {
  x = 0; y = 0; alpha = 1; rotation = 0; scaleX = 1; scaleY = 1; visible = false; active = true; destroyed = false;
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setAlpha(value: number) { this.alpha = value; return this; }
  setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; }
  setRotation(value: number) { this.rotation = value; return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  setActive(value: boolean) { this.active = value; return this; }
  setTexture() { return this; } setTint() { return this; } setDepth() { return this; }
  destroy() { this.destroyed = true; }
}
function fixture() {
  const images: Image[] = []; const animations: { config: Animation; stop: ReturnType<typeof vi.fn> }[] = [];
  const scene = { time: { now: 0 }, game: { loop: { frame: 1 } }, events: { once: vi.fn() }, textures: { exists: () => true },
    add: { image: () => { const image = new Image(); images.push(image); return image; } },
    tweens: { add: (config: Animation) => { const animation = { config, stop: vi.fn() }; animations.push(animation); return animation; } },
  };
  const effects = new EffectManager(scene as unknown as Phaser.Scene, { damageNumbers: false });
  return { effects, scene, images, animations };
}

describe("공격 이펙트의 첫 표시와 풀 수명", () => {
  for (const kind of ["slash", "claw", "bite"] as const) {
    it(`${kind}는 onUpdate가 아직 없어도 첫 표시에서 타격 위치·크기·회전을 갖는다`, () => {
      const f = fixture(); f.effects.meleeStrike({ x: 580, y: 900 }, { x: 580, y: 1020 }, kind, 0xffffff, -1);
      for (const [index, animation] of f.animations.entries()) {
        expect(f.images[index].visible).toBe(false);
        animation.config.onStart?.();
        const image = f.images[index];
        expect(image.visible).toBe(true); expect(image.x).toBeGreaterThan(400); expect(image.y).toBeGreaterThan(800);
        expect(image.scaleX).toBeLessThan(0); if (kind !== "bite") expect(image.rotation).not.toBe(0);
      }
    });
  }
  it("완료된 조각은 객체를 추가로 만들지 않고 다시 사용한다", () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) {
      f.effects.meleeStrike({ x: 580, y: 900 }, { x: 580, y: 1020 }, "slash", 0xffffff, 1);
      f.animations.at(-1)!.config.onComplete?.();
    }
    expect(f.images).toHaveLength(1); expect(f.images[0].visible).toBe(false); expect(f.images[0].active).toBe(false);
  });
  it("지연된 조각도 예약을 차지하며 풀 상한에서 이전 트윈을 중단한다", () => {
    const f = fixture();
    for (let i = 0; i < 100; i++) { f.scene.time.now++; f.effects.meleeStrike({ x: 580, y: 900 }, { x: 580, y: 1020 }, "claw", 0xffffff, 1); }
    expect(f.images).toHaveLength(INK_STRIKE.maxLive);
    expect(f.animations[0].stop).toHaveBeenCalledOnce();
    f.effects.destroy(); expect(f.images.every(({ destroyed }) => destroyed)).toBe(true);
  });
  it("상한에서 재사용한 투사체 꼬리는 이전 위치·알파가 첫 프레임에 노출되지 않는다", () => {
    const f = fixture();
    // Public reachStrike drives the same projectile lifecycle as normal ranged attacks.
    f.effects.reachStrike({ x: 900, y: 1600 }, { x: 1000, y: 1780 }, "ranged", 0xff8844, "bullet");
    f.animations[0].config.targets.t = 0.4; f.animations[0].config.onUpdate?.();
    const trail = f.images[1]; expect(trail.alpha).toBeGreaterThan(0);
    for (let i = 0; i < INK_PROJECTILE.maxLive; i++) {
      f.scene.time.now++; f.scene.game.loop.frame++;
      f.effects.reachStrike({ x: 300, y: 1100 }, { x: 600, y: 800 }, "ranged", 0x88ddff, "bullet");
    }
    expect(f.images).toHaveLength(INK_PROJECTILE.maxLive * 2);
    const current = f.animations.at(-1)!; current.config.onStart?.();
    expect(f.images[0].x).toBe(300); expect(f.images[0].y).toBe(1100);
    expect(trail.visible).toBe(true); expect(trail.alpha).toBe(0); expect(trail.x).toBeLessThan(400); expect(trail.y).toBeLessThan(1200);
    current.config.targets.t = 0.3; current.config.onUpdate?.();
    const point = projectilePosition({ x: 300, y: 1100 }, { x: 600, y: 800 }, "bullet", 0.3);
    expect(f.images[0].x).toBe(point.x); expect(f.images[0].y).toBe(point.y); expect(trail.alpha).toBeGreaterThan(0);
  });
});
