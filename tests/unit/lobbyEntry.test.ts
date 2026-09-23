import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOBBY_RETURN, normalizeLobbyEntry } from "../../src/scenes/lobbyEntry";
import { BATTLE_FIELD_BACKGROUND, battleFieldBackground, BACKGROUND, BACKGROUND_ASSETS } from "../../src/ui/backgroundAssets";
import { BANNERS } from "../../src/data/banners";
import { shopStagePresentation } from "../../src/data/shopPresentation";
import { findItem } from "../../src/data/items";
import { WALLET_CAPS } from "../../src/data/economy";
import { currencyGuide } from "../../src/data/currencyGuide";
import { CURRENCY_ICON_BY_WALLET } from "../../src/ui/currencyIcons";
import { TOP_BAR_SLOT_KEYS } from "../../src/ui/topBarSlots";
import { STAMINA_RECHARGE_SOURCES } from "../../src/data/staminaRecharge";

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
    expect(normalizeLobbyEntry({ storefront: "loot" })).toBeUndefined();
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
  const paths = new Map<string, string>(BACKGROUND_ASSETS.map(([key, path]) => [key, path]));

  it("는 배너가 갖고, 적은 키는 적재 표에 있다", () => {
    // 화면이 한 장을 고정으로 깔면 배너를 넘겨도 그림이 그대로라 무엇이 바뀌었는지
    // 그림이 말하지 못한다. 어느 배너가 어느 원화인지는 배너 데이터가 갖는다.
    expect(BANNERS.length).toBeGreaterThan(0);
    for (const banner of BANNERS) {
      if (banner.artKey === undefined) continue;
      expect(paths.get(banner.artKey), banner.id).toBeTruthy();
    }
  });

  it("는 두 배너가 같은 그림을 나눠 쓰지 않는다", () => {
    // 같은 그림을 돌려 쓰면 넘겨도 바뀐 것이 없어 보인다. 전용 원화가 아직 없는 배너는
    // 빌려 오지 말고 **비워 두어** 연구소 설비 원화가 그 자리를 메우게 한다.
    const used = BANNERS.map((banner) => banner.artKey).filter((key): key is string => key !== undefined);
    expect(new Set(used).size, used.join(" · ")).toBe(used.length);
  });

  it("는 전용 원화가 없을 때만 연구소 설비 원화로 메운다", () => {
    // 두 장을 겹쳐 두면 들어가는 순간 설비 원화가 먼저 보이고 그 위로 픽업 원화가 덮여
    // 화면이 한 번 조립되는 과정이 그대로 보인다 — 그래서 배경은 한 장뿐이다.
    const lab = readFileSync("src/scenes/LabScene.ts", "utf8");
    expect(lab).toContain("this.banner.artKey ?? BACKGROUND.lab");
    // 부르지 않는 이유는 주석이 설명하므로, 이름이 아니라 **부르는 자리**가 없어야 한다.
    expect(lab).not.toMatch(/addSceneBackground\(/);
    // 그 한 장이 곧 배경이므로 배경 층에 선다.
    expect(lab).toMatch(/showcase = image;/);
    expect(lab).toMatch(/"__DEFAULT"\)\.setDepth\(-30\)/);
  });

  it("는 이미 올라와 있는 그림도 제대로 물린다", () => {
    // 세우는 쪽은 `__DEFAULT`로 만든 빈 이미지를 넘기므로, 이미 올라와 있다고 `onReady`만
    // 부르면 그 자리는 텍스처 없이 알파만 1이 된다 — 연구소가 그랬다. 처음 들어갈 때는
    // 아직 안 읽혀 비동기 길로 가 그림이 떴고, 배너를 넘겼다 돌아오면 빈 판만 남았다.
    const backgrounds = readFileSync("src/ui/backgrounds.ts", "utf8");
    const resident = backgrounds.slice(backgrounds.indexOf("if (textures.exists(key)) {"));
    expect(resident.slice(0, 160)).toContain("image.setTexture(key)");
  });
});

describe("상점 무대", () => {
  it("은 세 자리가 저마다 다른 점원·배경·대사를 쓴다", () => {
    // 셋이 같은 점원이면 상품표만 바뀐 같은 가게로 읽힌다.
    const stages = ["shop", "archaeology", "loot"] as const;
    const merchants = stages.map((id) => shopStagePresentation(id).merchant.name);
    const backgrounds = stages.map((id) => shopStagePresentation(id).background);
    const lines = stages.map((id) => shopStagePresentation(id).lineKeys[0]);
    expect(new Set(merchants).size).toBe(stages.length);
    expect(new Set(backgrounds).size).toBe(stages.length);
    expect(new Set(lines).size).toBe(stages.length);
  });

  it("은 전리품 상점이 레이드 진입 화면을 무대에 깔지 않는다", () => {
    // 상점과 그 앞 화면이 같은 그림이면 어디로 들어온 것인지 배경이 말하지 못한다.
    expect(shopStagePresentation("loot").background).not.toBe(BACKGROUND.sortieRaid);
  });
});

describe("전리품 증표", () => {
  it("는 지갑 재화이고 상한에 사실상 걸리지 않는다", () => {
    // 재료 칸에 두었던 때는 `maxStack` 9,999가 걸려 몇 주 안 턴 사람의 몫이 조용히
    // 버려졌다 — "가끔 들어가 턴다"가 그 상점의 경험이라 상한이 있으면 안 된다.
    for (const key of ["raidSigil", "salvageRecord"] as const) {
      expect(findItem(key)?.category, key).toBe("currency");
      expect(WALLET_CAPS[key], key).toBeGreaterThanOrEqual(9_999_999);
      expect(CURRENCY_ICON_BY_WALLET[key], key).toBeTruthy();
      expect(currencyGuide(key).sources.length, key).toBeGreaterThan(0);
    }
  });

  it("는 로비에는 서지 않고 전리품 상점에서만 상단 줄에 선다", () => {
    // 지갑이라고 늘 보이는 것이 아니다 — 평소 조작을 바꾸지 않는 수가 두 칸을 먹으면
    // 정작 자주 보는 젬·골드·스테미나가 밀린다.
    const keysOf = (context: keyof typeof TOP_BAR_SLOT_KEYS) => TOP_BAR_SLOT_KEYS[context];
    expect(keysOf("loot")).toEqual(["raidSigil", "salvageRecord"]);
    for (const context of ["default", "recruit", "archaeology"] as const) {
      expect(keysOf(context)).not.toContain("raidSigil");
      expect(keysOf(context)).not.toContain("salvageRecord");
    }
  });

  it("는 자리마다 무대표가 정하고 씬이 storefront로 분기하지 않는다", () => {
    /*
     * 씬에 `storefront === "loot" ? "loot" : "default"`를 적어 두었더니 자리가 하나 늘 때
     * 그 삼항이 또 길어졌고, **고고학 가게는 그 분기에 없어 로비와 같은 조합**(젬·골드·
     * 스테미나)을 그대로 세우고 있었다. 어느 자리가 무엇을 세우는지는 눈으로 확인할 수 없어
     * 이 표가 계약이다.
     */
    expect(shopStagePresentation("shop").currencies).toBe("default");
    expect(shopStagePresentation("loot").currencies).toBe("loot");
    expect(shopStagePresentation("archaeology").currencies).toBe("archaeologyShop");
    // 고고학 가게에서 조작을 정하는 수는 원석 하나뿐이다.
    expect(TOP_BAR_SLOT_KEYS.archaeologyShop).toEqual(["rawStone"]);
    // 지도 화면은 제 조합을 그대로 갖는다 — 같은 콘텐츠라도 거기서 정하는 것이 다르다.
    expect(TOP_BAR_SLOT_KEYS.archaeology.length).toBeGreaterThan(1);
  });
});

describe("스테미나 충전 칸", () => {
  it("은 소비품 한 칸이 여러 드링크를 맡아 칸 수가 늘지 않는다", () => {
    // 셋은 서로 대체재라 균등해야 한다 — 드링크만 둘로 늘리면 줄이 넷이 되고,
    // 어느 하나가 커 보이면 값을 비교하기 전에 크기가 먼저 답을 정한다.
    expect(STAMINA_RECHARGE_SOURCES).toHaveLength(3);
    const tonic = STAMINA_RECHARGE_SOURCES.find((source) => source.kind === "consumable");
    expect(tonic?.itemIds.length).toBeGreaterThan(1);
  });
});

describe("돌아와 다시 여는 판", () => {
  it("은 제 등장 연출 없이 화면 진입과 함께 선다", () => {
    /*
     * 판이 제 연출(옅어졌다 떠오르기)을 따로 돌리면 화면 진입과 판 등장이 두 박자로 갈려,
     * 로비가 먼저 보이고 판이 뒤늦게 열리는 것 — **로비로 튕겼다가 판이 다시 열리는 것**으로
     * 읽혔다. 눈으로만 보이는 일이라 소스의 모양으로 지킨다.
     */
    const lobby = readFileSync("src/scenes/LobbyScene.ts", "utf8");
    expect(lobby).toContain('this.returnMenu === "sortie") this.openSortieMenu(true)');
    expect(lobby).toContain('this.returnMenu === "duel") this.openPvpMenu(true)');
    expect(lobby.match(/hideCloseButton: true, instant,/g)?.length).toBe(2);
    const popup = readFileSync("src/ui/PopupLayer.ts", "utf8");
    expect(popup).toContain("if (options.instant) { layer.setAlpha(1); body.setScale(1); }");
  });
});
