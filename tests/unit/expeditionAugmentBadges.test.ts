import { describe, expect, it } from "vitest";
import { battleBuffStackSpot, expeditionAugmentChipOffsets, BATTLE_PROFILE_LAYOUT } from "../../src/ui/battleStatusLayout";
import { expeditionAugmentBadges, expeditionAugmentRows } from "../../src/ui/expeditionAugmentBadges";

const ORDER = ["anky", "rex", "spino"];
const SELECTIONS = [
  { augmentId: "predator-instinct", targetRelicId: "rex" },
  { augmentId: "reinforced-core" },
  { augmentId: "blood-edge", targetRelicId: "anky" },
  { augmentId: "apex-signal" },
  { augmentId: "relentless-hunt", targetRelicId: "rex" },
];

describe("원정 증강 표식", () => {
  it("은 전체와 개인을 갈라 담는다", () => {
    const groups = expeditionAugmentBadges(SELECTIONS);
    expect(groups.global.map(({ augmentId }) => augmentId)).toEqual(["reinforced-core", "apex-signal"]);
    expect(groups.byRelic.rex.map(({ augmentId }) => augmentId)).toEqual(["predator-instinct", "relentless-hunt"]);
    expect(groups.byRelic.anky).toHaveLength(1);
    expect(groups.byRelic.spino).toBeUndefined();
  });

  it("은 정의가 사라진 ID를 화면에 세우지 않는다", () => {
    expect(expeditionAugmentBadges([{ augmentId: "지워진-증강" }]).global).toEqual([]);
  });

  it("의 팝업 차례는 전체가 먼저이고 그다음이 편성 순서다", () => {
    // 고른 순서로 늘어놓으면 같은 캐릭터의 증강이 목록 여기저기에 흩어진다.
    const rows = expeditionAugmentRows(SELECTIONS, ORDER);
    expect(rows.map(({ relicId }) => relicId)).toEqual([undefined, "anky", "rex"]);
    expect(rows[0].badges).toHaveLength(2);
    expect(rows[2].badges).toHaveLength(2);
  });

  it("의 효과 종류가 곧 문양이다", () => {
    const groups = expeditionAugmentBadges(SELECTIONS);
    expect(groups.byRelic.anky[0].glyph).toBe("bleed");
    expect(groups.global[0].glyph).toBe("attack");
  });
});

describe("증강 표식 줄", () => {
  it("은 버프 액자와 같은 왼쪽 끝에서 시작한다", () => {
    // 두 줄이 다른 자리에 서면 같은 프로필 위에서 서로 다른 체계의 표식으로 읽힌다.
    const buffs = BATTLE_PROFILE_LAYOUT.buffRow;
    const left = -(buffs.maxVisible * buffs.chipSize + (buffs.maxVisible - 1) * buffs.gap) / 2;
    const first = expeditionAugmentChipOffsets(3)[0];
    expect(first.x - BATTLE_PROFILE_LAYOUT.augmentRow.chipSize / 2).toBeCloseTo(left, 5);
    expect(first.y).toBe(BATTLE_PROFILE_LAYOUT.buffRow.y);
  });

  it("은 개수가 늘어도 이미 선 표식이 움직이지 않는다", () => {
    // 가운데 정렬하면 하나 붙을 때마다 줄 전체가 밀려 읽고 있던 표식까지 움직인다.
    expect(expeditionAugmentChipOffsets(1)[0].x).toBe(expeditionAugmentChipOffsets(4)[0].x);
  });
});

describe("버프 액자의 겹 수", () => {
  it("는 액자 크기에 비례해 커지고 액자 안에 머문다", () => {
    const size = BATTLE_PROFILE_LAYOUT.buffRow.chipSize;
    const spot = battleBuffStackSpot(size);
    // 파치의 4타처럼 지금 몇 대째인지는 액자 그림보다 먼저 읽혀야 한다.
    expect(spot.fontSize).toBeGreaterThan(12);
    expect(spot.strokeWidth).toBeGreaterThan(0);
    expect(spot.x + spot.plateRadius).toBeLessThanOrEqual(size / 2);
    expect(spot.y + spot.plateRadius).toBeLessThanOrEqual(size / 2);
  });

  it("는 머리 위 작은 칩에서도 판이 칩 밖으로 넘치지 않는다", () => {
    const spot = battleBuffStackSpot(22);
    expect(spot.x + spot.plateRadius).toBeLessThanOrEqual(11);
  });
});
