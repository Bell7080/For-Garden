import { describe, expect, it } from "vitest";
import { LOBBY_RETURN, normalizeLobbyEntry } from "../../src/scenes/lobbyEntry";
import { BACK_BUTTON_SIZE, BACK_SLOT, POPUP_SIDE_SLOT, popupSideSlotGap } from "../../src/ui/popupGeometry";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { BATTLE_FIELD_BACKGROUND, battleFieldBackground, BACKGROUND, BACKGROUND_ASSETS } from "../../src/ui/backgroundAssets";
import { BANNERS } from "../../src/data/banners";
import { shopStagePresentation } from "../../src/data/shopPresentation";

describe("로비로 돌아갈 자리", () => {
  it("는 보낸 판을 그대로 되돌려 준다", () => {
    expect(normalizeLobbyEntry(LOBBY_RETURN.sortie)).toBe("sortie");
    expect(normalizeLobbyEntry(LOBBY_RETURN.duel)).toBe("duel");
  });

  it("는 모르는 값과 빈손을 판 없음으로 수렴시킨다", () => {
    // Phaser가 남긴 지난 진입의 값으로 판이 저절로 뜨면 안 된다.
    expect(normalizeLobbyEntry(undefined)).toBeUndefined();
    expect(normalizeLobbyEntry({})).toBeUndefined();
    expect(normalizeLobbyEntry({ menu: "shop" })).toBeUndefined();
    expect(normalizeLobbyEntry({ storefront: "raid" })).toBeUndefined();
  });
});

describe("판 밖 곁들임 조작 자리", () => {
  it("는 뒤로가기와 같은 줄에 서되 겹치지 않는다", () => {
    expect(POPUP_SIDE_SLOT.y).toBe(BACK_SLOT.y);
    expect(popupSideSlotGap()).toBeGreaterThan(0);
  });

  it("는 화면 안에 들고, 판 옆 50px 띠보다 넓다", () => {
    // 판 옆이 아니라 판 밑동 아래인 이유가 이 폭이다 — 980폭 판은 좌우로 50px만 남긴다.
    expect(POPUP_SIDE_SLOT.x - POPUP_SIDE_SLOT.width / 2).toBeGreaterThan(0);
    expect(POPUP_SIDE_SLOT.width).toBeGreaterThan((BASE_WIDTH - 980) / 2);
    expect(POPUP_SIDE_SLOT.y + POPUP_SIDE_SLOT.height / 2).toBeLessThan(BASE_HEIGHT);
    expect(BACK_BUTTON_SIZE).toBeGreaterThan(0);
  });
});

describe("전투 모드별 전장", () => {
  it("는 콘텐츠마다 다른 장소에 선다", () => {
    // 같은 원화를 나눠 쓰는 것은 한 장소에서 이어지는 원정 둘뿐이다.
    expect(BATTLE_FIELD_BACKGROUND.cake).toBe(BACKGROUND.cakeField);
    expect(BATTLE_FIELD_BACKGROUND.bounty).toBe(BACKGROUND.bountyField);
    expect(BATTLE_FIELD_BACKGROUND.raid).toBe(BACKGROUND.raidField);
    expect(BATTLE_FIELD_BACKGROUND.expeditionBoss).toBe(BATTLE_FIELD_BACKGROUND.expedition);
    const fields = Object.values(BATTLE_FIELD_BACKGROUND);
    expect(new Set(fields).size).toBe(fields.length - 1);
  });

  it("는 전장에 진입 화면 배경을 깔지 않는다", () => {
    // 현상수배가 `sortieBounty`(진입 화면)를 전장에 깔고 있었다. 필드 원화는 따로 있다.
    const entries = [BACKGROUND.sortieCake, BACKGROUND.sortieBounty, BACKGROUND.sortieRaid];
    for (const key of Object.values(BATTLE_FIELD_BACKGROUND)) expect(entries).not.toContain(key);
  });

  it("는 모든 전장 원화가 적재 표에 있다", () => {
    const paths = new Map(BACKGROUND_ASSETS.map(([key, path]) => [key, path] as const));
    for (const key of Object.values(BATTLE_FIELD_BACKGROUND)) expect(paths.get(key)).toBeTruthy();
  });

  it("는 모르는 모드를 기본 전장으로 수렴시킨다", () => {
    expect(battleFieldBackground("stage")).toBe(BACKGROUND.combat);
    expect(battleFieldBackground("무엇")).toBe(BACKGROUND.combat);
  });
});

describe("모집판 배너 원화", () => {
  it("는 배너마다 제 원화를 갖고 그 키가 적재 표에 있다", () => {
    // 화면이 한 장을 고정으로 깔면 배너를 넘겨도 그림이 그대로라 무엇이 바뀌었는지
    // 그림이 말하지 못한다. 어느 배너가 어느 원화인지는 배너 데이터가 갖는다.
    const paths = new Map<string, string>(BACKGROUND_ASSETS.map(([key, path]) => [key, path]));
    expect(BANNERS.length).toBeGreaterThan(0);
    for (const banner of BANNERS) {
      expect(banner.artKey, banner.id).toBeTruthy();
      expect(paths.get(banner.artKey), banner.id).toBeTruthy();
    }
  });
});

describe("상점 무대", () => {
  it("은 세 자리가 저마다 다른 점원·배경·대사를 쓴다", () => {
    // 셋이 같은 점원이면 상품표만 바뀐 같은 가게로 읽힌다.
    const stages = ["shop", "archaeology", "raid"] as const;
    const merchants = stages.map((id) => shopStagePresentation(id).merchant.name);
    const backgrounds = stages.map((id) => shopStagePresentation(id).background);
    const lines = stages.map((id) => shopStagePresentation(id).lineKeys[0]);
    expect(new Set(merchants).size).toBe(stages.length);
    expect(new Set(backgrounds).size).toBe(stages.length);
    expect(new Set(lines).size).toBe(stages.length);
  });

  it("은 전리품 상점이 레이드 진입 화면을 무대에 깔지 않는다", () => {
    // 상점과 그 앞 화면이 같은 그림이면 어디로 들어온 것인지 배경이 말하지 못한다.
    expect(shopStagePresentation("raid").background).not.toBe(BACKGROUND.sortieRaid);
  });
});
