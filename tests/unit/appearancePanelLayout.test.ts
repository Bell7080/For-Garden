import { describe, expect, it } from "vitest";
import {
  APPEARANCE_PANEL, appearanceBoundsOverlap, appearanceFrames, appearancePanelRegions, appearanceStageRect,
  appearanceStripCardX, appearanceStripContentWidth, appearanceStripMinX, appearanceStripOffsetFor, appearanceStripViewport,
} from "../../src/ui/appearancePanelLayout";
import { appearanceEntries, appearanceState, canEquipAppearance, isAppearanceDimmed } from "../../src/ui/appearanceModel";
import type { RelicSkinDef } from "../../src/data/relicSkins";

const skin = (id: string, extra: Partial<RelicSkinDef> = {}): RelicSkinDef => ({
  id: id as RelicSkinDef["id"], defaultUnlocked: false, relicId: "anky", name: id,
  portraitAssetId: `${id}-portrait`, sdAssetId: `${id}-sd`, ...extra,
});

describe("외형 전시관 자리표", () => {
  it("무대·글줄·조작·띠가 서로 겹치지 않고 판 안에 든다", () => {
    const regions = appearancePanelRegions();
    const order = [regions.hero, regions.name, regions.state, regions.price, regions.action, regions.strip];
    for (let i = 1; i < order.length; i += 1) {
      expect(appearanceBoundsOverlap(order[i - 1], order[i])).toBe(false);
      // 위에서 아래로 쌓인다 — 자리가 뒤섞이면 무엇을 읽고 무엇을 누르는지 흐려진다.
      expect(order[i].top).toBeGreaterThanOrEqual(order[i - 1].bottom);
    }
    const half = { x: APPEARANCE_PANEL.width / 2, y: APPEARANCE_PANEL.height / 2 };
    for (const region of Object.values(regions)) {
      expect(region.left).toBeGreaterThanOrEqual(-half.x);
      expect(region.right).toBeLessThanOrEqual(half.x);
      expect(region.bottom).toBeLessThanOrEqual(half.y);
      expect(region.top).toBeGreaterThanOrEqual(-half.y);
    }
  });

  /**
   * 웹툰 칸 셋은 크기가 곧 위계다 — 같으면 어느 것을 먼저 봐야 하는지 알 수 없다.
   * 홈통(`gutter`)만큼 떨어져 서로 침범하지 않는지도 함께 지킨다.
   */
  it("무대는 큰 칸·중간 칸·작은 칸으로 갈리고 서로 겹치지 않는다", () => {
    const frames = appearanceFrames();
    const area = (rect: { left: number; right: number; top: number; bottom: number }) =>
      (rect.right - rect.left) * (rect.bottom - rect.top);
    expect(area(frames.hero)).toBeGreaterThan(area(frames.face));
    expect(area(frames.face)).toBeGreaterThan(area(frames.sd));
    expect(appearanceBoundsOverlap(frames.hero, frames.face)).toBe(false);
    expect(appearanceBoundsOverlap(frames.hero, frames.sd)).toBe(false);
    expect(appearanceBoundsOverlap(frames.face, frames.sd)).toBe(false);
    // 오른쪽 기둥 둘은 같은 폭으로 서고, 작은 칸이 큰 칸 밑변에 맞춰 끝난다.
    expect(frames.face.left).toBe(frames.sd.left);
    expect(frames.face.right).toBe(frames.sd.right);
    expect(frames.sd.bottom).toBe(frames.hero.bottom);
    expect(frames.sd.top - frames.face.bottom).toBe(APPEARANCE_PANEL.gutter);
    // 무대 전체가 판 안쪽 여백을 지킨다.
    const stage = appearanceStageRect();
    expect(frames.hero.left).toBe(stage.left);
    expect(frames.face.right).toBe(stage.right);
  });

  it("띠는 왼쪽부터 채우고 칸이 창을 못 채우면 흐르지 않는다", () => {
    const view = appearanceStripViewport();
    // 창을 넘치는 목록은 왼쪽 변에서 시작한다.
    expect(appearanceStripCardX(0, 12) - APPEARANCE_PANEL.strip.cardWidth / 2).toBe(view.left);
    expect(appearanceStripCardX(1, 12) - appearanceStripCardX(0, 12)).toBe(APPEARANCE_PANEL.strip.cardWidth + APPEARANCE_PANEL.strip.gap);
    // 창을 못 채우는 목록은 가운데로 모인다 — 왼쪽에 붙이면 오른쪽 빈 자리가 덜 그려진 칸으로 보인다.
    const two = [0, 1].map((index) => appearanceStripCardX(index, 2));
    expect((two[0] + two[1]) / 2).toBeCloseTo((view.left + view.right) / 2, 6);
    expect(appearanceStripContentWidth(0)).toBe(0);
    // 짧은 목록이 헐겁게 밀리면 끝까지 봤는지 알 수 없다.
    expect(appearanceStripMinX(2)).toBe(0);
    expect(appearanceStripMinX(12)).toBeLessThan(0);
  });

  it("띠 밖의 칸을 고르면 그 칸이 창 안으로 따라 들어온다", () => {
    const count = 12;
    const view = appearanceStripViewport();
    const offset = appearanceStripOffsetFor(count - 1, count, 0);
    const left = appearanceStripCardX(count - 1, count) - APPEARANCE_PANEL.strip.cardWidth / 2 + offset;
    expect(left).toBeGreaterThanOrEqual(view.left - 0.001);
    expect(left + APPEARANCE_PANEL.strip.cardWidth).toBeLessThanOrEqual(view.right + 0.001);
    // 이미 창 안에 있는 칸을 고르면 띠가 움직이지 않는다 — 고를 때마다 밀리면 읽던 줄이 흔들린다.
    expect(appearanceStripOffsetFor(0, count, 0)).toBe(0);
    // 한계 밖으로는 밀지 않는다.
    expect(appearanceStripOffsetFor(count - 1, count, 0)).toBeGreaterThanOrEqual(appearanceStripMinX(count));
  });
});

describe("외형 상태", () => {
  const owns = (ids: string[]) => (id: string) => ids.includes(id);

  it("아직 열리지 않은 외형은 가졌는지 묻지 않는다", () => {
    // 값도 조건도 정해지지 않았는데 둘 중 하나를 적으면 플레이어가 찾을 곳을 만들어 낸다.
    expect(appearanceState(skin("a", { comingSoon: true }), { owns: owns(["a"]) })).toBe("comingSoon");
  });

  it("가진 것은 장착 여부로, 못 가진 것은 값이 있는지로 갈린다", () => {
    expect(appearanceState(skin("a"), { owns: owns(["a"]), equippedId: "a" as RelicSkinDef["id"] })).toBe("equipped");
    expect(appearanceState(skin("a"), { owns: owns(["a"]) })).toBe("owned");
    expect(appearanceState(skin("b", { price: { currency: "gems", amount: 300 } }), { owns: owns([]) })).toBe("purchasable");
    // 값이 없으면 보상·이벤트로만 오는 외형이다.
    expect(appearanceState(skin("c"), { owns: owns([]) })).toBe("locked");
  });

  it("기본 외형이 맨 앞에 서고 아무것도 입지 않았을 때 그것이 장착 중이다", () => {
    const entries = appearanceEntries("기본", "base-portrait", [skin("a"), skin("b", { comingSoon: true })], { owns: owns(["a"]) });
    expect(entries).toHaveLength(3);
    expect(entries[0].skinId).toBeUndefined();
    expect(entries[0].state).toBe("equipped");
    expect(entries[1].state).toBe("owned");
    expect(entries[2].state).toBe("comingSoon");
    // 추가 외형을 입으면 기본 칸은 보유로 내려간다 — 목록에서 사라지지 않는다.
    const worn = appearanceEntries("기본", "base-portrait", [skin("a")], { owns: owns(["a"]), equippedId: "a" as RelicSkinDef["id"] });
    expect(worn[0].state).toBe("owned");
    expect(worn[1].state).toBe("equipped");
  });

  it("값은 살 수 있는 외형만 들고 다닌다", () => {
    const price = { currency: "gems", amount: 300 } as const;
    const entries = appearanceEntries("기본", "base", [skin("a", { price }), skin("b")], { owns: owns([]) });
    expect(entries[1].price).toEqual(price);
    expect(entries[2].price).toBeUndefined();
  });

  it("입을 수 있는 것은 가졌고 아직 입지 않은 것뿐이고, 내 것이 아닌 원화만 눌러 둔다", () => {
    const entries = appearanceEntries("기본", "base", [skin("a"), skin("b", { price: { currency: "gems", amount: 1 } }), skin("c", { comingSoon: true })], { owns: owns(["a"]) });
    expect(entries.map(canEquipAppearance)).toEqual([false, true, false, false]);
    expect(entries.map(isAppearanceDimmed)).toEqual([false, false, true, true]);
  });
});
