import { describe, expect, it } from "vitest";
import { BATTLE_PROFILE_LAYOUT, BATTLE_STATUS_LAYOUT, battleBuffChipBounds, battleProfileBounds, unitStatusChipOffsets } from "../../src/ui/battleStatusLayout";

/** Phaser 없이 1080×1920 전투 HUD의 상태 뱃지 간격 계약을 고정한다. */
describe("머리 위 상태 칩 줄", () => {
  it("은 칩 수와 무관하게 체력 바 왼쪽 끝에서 시작한다", () => {
    const first = unitStatusChipOffsets(1)[0];
    for (const count of [1, 2, 3, 4]) {
      const offsets = unitStatusChipOffsets(count);
      expect(offsets).toHaveLength(count);
      // 첫 칸은 늘 같은 자리다 — 가운데 정렬하면 상태가 하나 붙을 때마다 줄 전체가 밀린다.
      expect(offsets[0]).toBe(first);
    }
    // 줄은 바 왼쪽 끝에서 시작하고 오른쪽으로 붙는다.
    expect(first).toBeCloseTo(-BATTLE_STATUS_LAYOUT.hpBarWidth / 2 + BATTLE_STATUS_LAYOUT.chipSize / 2, 6);
    expect(unitStatusChipOffsets(4).every((x) => x > -BATTLE_STATUS_LAYOUT.hpBarWidth)).toBe(true);
  });

  it("은 칩끼리 겹치지 않게 벌린다", () => {
    const offsets = unitStatusChipOffsets(4);
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index] - offsets[index - 1]).toBe(BATTLE_STATUS_LAYOUT.chipSize + BATTLE_STATUS_LAYOUT.chipGap);
    }
    expect(BATTLE_STATUS_LAYOUT.chipGap).toBeGreaterThan(0);
  });

  it("은 겹 수를 칩 우하단 안쪽에 둔다", () => {
    const count = BATTLE_STATUS_LAYOUT.stackCount;
    // 우하단이다 — 가운데(0,0)에 적으면 표식 그림과 숫자가 겹쳐 둘 다 흐려진다.
    expect(count.offsetX).toBeGreaterThan(0);
    expect(count.offsetY).toBeGreaterThan(0);
    // 판이 칩 밖으로 크게 삐져나오면 옆 칩과 붙어 어느 칩의 수인지 흐려진다.
    expect(count.offsetX + count.plateRadius).toBeLessThanOrEqual(BATTLE_STATUS_LAYOUT.chipSize / 2 + BATTLE_STATUS_LAYOUT.chipGap);
    // 작은 칩이라 수가 칩보다 커지지 않게 둔다.
    expect(count.size).toBeLessThan(BATTLE_STATUS_LAYOUT.chipSize);
  });

  it("은 체력 바와 겹치지 않을 만큼 위로 띄운다", () => {
    expect(BATTLE_STATUS_LAYOUT.chipRowLift).toBeGreaterThanOrEqual(BATTLE_STATUS_LAYOUT.chipSize / 2);
  });
});

describe("공용 전투 프로필 배치", () => {
  /** 카드·게이지는 서로 다른 정보를 담으므로 버프 액자와 픽셀 하나도 포개지 않게 고정한다. */
  it.each([1, BATTLE_PROFILE_LAYOUT.buffRow.maxVisible])("버프 %i개가 안전 영역 안에서 카드·HP·야성 게이지와 겹치지 않는다", (count) => {
    const row = Array.from({ length: count }, (_, slot) => battleBuffChipBounds(slot));
    const cardTop = -BATTLE_PROFILE_LAYOUT.glowSize / 2;
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(cardTop);
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.hpBarY - BATTLE_PROFILE_LAYOUT.hpBarHeight / 2);
    expect(Math.max(...row.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.ferocityBarY - BATTLE_PROFILE_LAYOUT.ferocityBarHeight / 2);
    for (const centerX of BATTLE_PROFILE_LAYOUT.battle.centersX) {
      expect(centerX + Math.min(...row.map(({ left }) => left))).toBeGreaterThanOrEqual(0);
      expect(centerX + Math.max(...row.map(({ right }) => right))).toBeLessThanOrEqual(1080);
      expect(BATTLE_PROFILE_LAYOUT.battle.centerY + Math.min(...row.map(({ top }) => top))).toBeGreaterThanOrEqual(0);
    }
  });

  it("전투와 20층 보스의 세 프로필은 같은 크기와 350 간격을 쓴다", () => {
    const { centersX, centerY, scale } = BATTLE_PROFILE_LAYOUT.battle;
    const bounds = centersX.map((x) => battleProfileBounds(x, centerY, scale));
    expect(centersX[1] - centersX[0]).toBe(350);
    expect(bounds.map(({ right, left }) => right - left)).toEqual([378, 378, 378]);
    expect(BATTLE_PROFILE_LAYOUT.hpTextBaselineY).toBe(180);
  });

  /** 1080×1920 캡처에서 전장 HP, 궁극기 입력, 결과 UI가 서로 침범하지 않는 세로 계약이다. */
  it("버프 행과 프로필 입력은 전장 HP 바 및 결과 UI 안전 영역과 겹치지 않는다", () => {
    const { battle, collisionZones } = BATTLE_PROFILE_LAYOUT;
    const profile = battleProfileBounds(battle.centersX[1], battle.centerY, battle.scale, true);
    expect(collisionZones.battlefieldHpBottom).toBeLessThan(collisionZones.ultimateInputTop);
    expect(profile.top).toBeGreaterThanOrEqual(collisionZones.ultimateInputTop);
    expect(collisionZones.resultUiTop).toBeLessThan(BATTLE_PROFILE_LAYOUT.sortieButton.top);
  });

  it("원정 지도는 전투와 같은 크기·가로 기준선을 쓰고 세로만 출격 줄 위로 올린다", () => {
    const map = BATTLE_PROFILE_LAYOUT.expedition;
    const battle = BATTLE_PROFILE_LAYOUT.battle;
    // 같은 세 칸이 화면마다 다른 크기로 보이지 않도록 배율과 가로 자리를 전투와 공유한다.
    expect(map.scale).toBe(battle.scale);
    expect(map.centersX).toEqual(battle.centersX);
    const bounds = map.centersX.map((x) => battleProfileBounds(x, map.centerY, map.scale));
    expect(bounds.map(({ right, left }) => right - left)).toEqual([378, 378, 378]);
    // 세 번째 프로필까지 화면 폭 안에 있고 하단 출격 버튼과도 겹치지 않는다.
    expect(bounds[0].left).toBeGreaterThanOrEqual(0);
    expect(bounds[2].right).toBeLessThanOrEqual(1080);
    expect(Math.max(...bounds.map(({ bottom }) => bottom))).toBeLessThan(BATTLE_PROFILE_LAYOUT.sortieButton.top);
  });

});

describe("겹 수 배지는 칩 안에 앉는다", () => {
  const { chipSize, chipBevel, stackCount } = BATTLE_STATUS_LAYOUT;
  const half = chipSize / 2;

  it("판이 칩의 네 변을 넘지 않는다", () => {
    // 넘치면 바로 아래 체력 바 위로 흘러내린다 — 칩을 줄이고 이 값을 그대로 둬서 실제로 그랬다.
    expect(stackCount.offsetX + stackCount.plateRadius).toBeLessThanOrEqual(half);
    expect(stackCount.offsetY + stackCount.plateRadius).toBeLessThanOrEqual(half);
  });

  it("깎인 오른쪽 아래 빗변도 넘지 않는다", () => {
    // 빗변은 (half, half-bevel)과 (half-bevel, half)를 잇는다 → x + y = chipSize - bevel.
    const line = chipSize - chipBevel;
    const distance = (line - stackCount.offsetX - stackCount.offsetY) / Math.SQRT2;
    expect(distance).toBeGreaterThanOrEqual(stackCount.plateRadius);
  });

  it("숫자도 칩 아래 변을 넘지 않는다", () => {
    // 글자는 판보다 조금 크게 그려지므로 반높이로 함께 본다.
    expect(stackCount.offsetY + stackCount.size / 2).toBeLessThanOrEqual(half);
  });
});

describe("상태 칩 줄과 체력 바", () => {
  it("은 칩 아래 변이 바의 끝 빗금에 닿지 않게 띄운다", () => {
    // 겹치면 지나간 시간을 덮는 반투명 부채꼴이 바 위에 그대로 얹혀 체력이 가려진다.
    const chipBottom = BATTLE_STATUS_LAYOUT.chipRowLift - BATTLE_STATUS_LAYOUT.chipSize / 2;
    expect(chipBottom).toBeGreaterThan(BATTLE_STATUS_LAYOUT.hpBarCapHalfHeight);
  });
});
