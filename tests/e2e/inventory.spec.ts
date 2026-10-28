import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { INVENTORY_LIST_BOTTOM, inventoryCategoryTabPosition } from "../../src/ui/inventoryTabs";
import { INVENTORY_LAYOUT, inventoryGridPosition } from "../../src/managers/InventoryManager";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { captureGame, tap, tapUntil, waitForDebugState } from "./canvasInput";
// 레일 자리는 화면이 소유한 배치표에서 읽는다 — 좌표를 스펙에 베껴 두면 줄이 옮겨질 때 조용히 빗나간다.
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { CURRENCY_GUIDE_SIZE } from "../../src/ui/currencyGuideLayout";
import { POPUP_CLOSE_LAYOUT } from "../../src/ui/popupGeometry";

const WIDTH = 1080; const HEIGHT = 1920;

/** 재화 안내창의 닫기 X 중심. 창은 화면 한가운데에 선다. */
const guideCloseX = WIDTH / 2 + CURRENCY_GUIDE_SIZE.width / 2 - POPUP_CLOSE_LAYOUT.centerInset;
const guideCloseY = HEIGHT / 2 - CURRENCY_GUIDE_SIZE.height / 2 + POPUP_CLOSE_LAYOUT.centerInset;

test("가방은 로비를 유지하고 카테고리 탭과 많은 항목 스크롤 입력을 받는다", async ({ page }) => {
  // 고해상도 WebGL 캡처가 무GPU CI에서도 완료되도록 이 시각 회귀만 여유 시간을 둔다.
  test.setTimeout(240_000);
  await startAfterOpening(page, (state) => {
    // 저장 검증을 통과하는 실제 두 스택으로 카테고리 전환과 목록 행을 준비한다.
    state.itemInventory = [{ itemId: "stamina-tonic", quantity: 10 }, { itemId: "ancient-core", quantity: 500 }];
    // 서로 다른 등급과 조각 위치를 넣어 가방이 일반 하트 glyph가 아닌 개별 WebP를 고르는지 고정한다.
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 10])) as Record<RuneStatKey, number>;
    state.runeInventory = [
      createRuneInstance({ instanceId: "bag-uncommon-0", baseName: "초록 조각", rarity: "uncommon", part: 0, statValues: values, random: () => 0 }),
      createRuneInstance({ instanceId: "bag-rare-1", baseName: "푸른 조각", rarity: "rare", part: 1, statValues: values, random: () => 0 }),
      createRuneInstance({ instanceId: "bag-legendary-2", baseName: "붉은 조각", rarity: "legendary", part: 2, statValues: values, random: () => 0 }),
    ];
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 레일 버튼은 로비가 원화를 마저 읽은 뒤에 입력면을 갖는다 — 열릴 때까지 다시 누른다.
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)) !== undefined);
  // 팝업이 화면을 바꾸지 않는 것이 발굴·무역과 같은 로비 오버레이 계약이다.
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 팝업 원점에 탭 로컬 중심을 더해 글자가 아닌 네 탭 면의 정중앙을 차례로 누른다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("rune");
  // Phaser Canvas의 DOM에는 이미지 노드가 없으므로 렌더가 기록한 실제 texture key를 검증한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryTextureKeys)).toEqual(["rune-uncommon-0", "rune-rare-1", "rune-legendary-2"]);
  // 스크롤 전 1080×1920 기준 캡처로 좌우 팝업 가장자리와 목록 하단/파일 탭 사이를 함께 보존한다.
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await captureGame(page, `test-results/${test.info().project.name}-inventory-popup-edges-and-tabs.png`);
  for (const index of [1, 2, 3, 0]) {
    const position = inventoryCategoryTabPosition(index);
    await tap(page, WIDTH / 2 + position.x, HEIGHT / 2 + position.y);
    // 면 중앙 입력 뒤 비동기 목록까지 해당 카테고리로 다시 그려졌는지 확인한다.
    const expected = (["rune", "currency", "consumable", "material"] as const)[index];
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe(expected);
  }
  await page.mouse.wheel(0, 1200);
  // 갱신하는 결과 캡처는 기준 게임 해상도와 같은 1080×1920으로 고정한다.
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await waitForDebugState(page, () => window.__PF_DEBUG?.inventoryCategory, "rune");
  await captureGame(page, `test-results/${test.info().project.name}-inventory-popup.png`);

  // 외부 뒤로가기로 닫은 뒤 버튼과 팝업 인스턴스가 함께 정리되어 같은 가방을 다시 열 수 있어야 한다.
  await tap(page, WIDTH - 106, HEIGHT - 120);
  // 레일 자리는 배치표에서 읽는다 — 손으로 적어 둔 1096은 레일이 옮겨진 뒤 한 칸(152px)
  // 어긋나 빈자리를 누르고 있었다.
  await tap(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y);
  await waitForDebugState(page, () => window.__PF_DEBUG?.popupTitles, ["가방"]);
  await captureGame(page, `test-results/${test.info().project.name}-inventory-popup-reopened.png`);
  // 재개방 캡처까지 끝나면 테스트가 만든 팝업은 페이지 종료와 함께 정리된다.
});

test("상단과 가방 재화는 같은 안내를 열고 가방 위 안내만 닫아도 스택을 보존한다", async ({ page }) => {
  // 빈 재화는 목록에서 생략된다. 확인할 화석 카드를 명시적으로 준비한다.
  await startAfterOpening(page, (state) => { state.wallet.fossil = 1; });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 기본 상단의 첫 칩(젬)을 눌러 공용 안내 제목이 스택에 기록되는지 확인한다.
  // 안내를 여는 조작은 다시 누르면 배경을 눌러 닫아 버린다 — 상단 줄이 그려질 틈만 두고 한 번 누른다.
  await waitForDebugState(page, () => window.__PF_DEBUG?.storefrontControls?.lobby !== undefined, true);
  await tap(page, 500, 86);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["젬"]);
  // 안내창은 780×1020 중앙 정렬이라 x 150~930 · y 450~1470을 차지한다. 예전에 적어 둔
  // (880, 556)은 그 **안쪽**이어서 판이 입력을 삼켰고 배경 닫기가 돌지 않았다.
  await tap(page, 60, 300);
  // 스택이 비면 관찰값 자체를 지운다(`setDebugPopupTitles`) — 빈 배열이 아니라 없음이다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();

  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)) !== undefined);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("rune");
  const currencyTab = inventoryCategoryTabPosition(1);
  await tap(page, WIDTH / 2 + currencyTab.x, HEIGHT / 2 + currencyTab.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("currency");
  // 첫 재화 카드(화석)는 가방 레이어 위에 동일 안내를 한 장 더 쌓는다.
  await tap(page, WIDTH / 2 - 312, HEIGHT / 2 - 510);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["가방", "화석"]);
  // 안내 X만 닫으면 아래 가방과 선택된 재화 탭이 그대로 남아야 한다.
  // X 자리는 창 크기와 공용 배치표에서 구한다 — 손으로 적어 둔 (880, 556)은 창이 커진 뒤
  // 66px 어긋나 입력면 밖을 눌렀고, 그래서 안내가 닫히지 않았다.
  await tap(page, guideCloseX, guideCloseY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["가방"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("currency");
  await captureGame(page, `test-results/${test.info().project.name}-currency-guide-stack.png`);
});

test("기한이 있는 병은 가방 칸 왼쪽 위에 붉은 표식(7D · 24H · 60M)이 선다", async ({ page }) => {
  test.setTimeout(240_000);
  const now = Date.now();
  const at = (ms: number): string => new Date(now + ms).toISOString();
  await startAfterOpening(page, (state) => {
    state.itemInventory = [
      { itemId: "stamina-tonic", quantity: 3, lots: [{ quantity: 1, expiresAt: at(7 * 86_400_000) }, { quantity: 2, expiresAt: at(8 * 86_400_000) }] },
      { itemId: "stamina-tonic-large", quantity: 1, lots: [{ quantity: 1, expiresAt: at(50 * 60_000) }] },
    ];
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)) !== undefined);
  const position = inventoryCategoryTabPosition(2);
  await tap(page, WIDTH / 2 + position.x, HEIGHT / 2 + position.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("consumable");
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await captureGame(page, `test-results/${test.info().project.name}-inventory-expiry-tags.png`);
});

test("창 밖으로 잘려 안 보이는 룬 카드는 손을 받지 않는다 — 아래 빈 자리를 눌러도 룬 쪽지가 열리지 않는다", async ({ page }) => {
  test.setTimeout(240_000);
  await startAfterOpening(page, (state) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 10])) as Record<RuneStatKey, number>;
    // 창보다 긴 목록 — 마지막 줄들은 창 아래변 밖에 가려진 채 남는다.
    state.runeInventory = Array.from({ length: 32 }, (_, index) => createRuneInstance({
      instanceId: `bag-clip-${index}`, baseName: "초록 조각", rarity: "uncommon", part: (index % 3) as 0 | 1 | 2, statValues: values, random: () => 0,
    }));
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)) !== undefined);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("rune");
  await waitForDebugState(page, () => window.__PF_DEBUG?.popupTitles, ["가방"]);
  // 첫 열의 중심 x. 창 아래변 바로 밑(탭과의 틈)에는 가려진 카드가 있지만 보이지 않으므로 눌려서는 안 된다.
  const columnX = WIDTH / 2 + inventoryGridPosition(0, INVENTORY_LAYOUT).x;
  // 카드 사이 틈(28px)에 걸려 빗나가지 않도록 틈 안(20px)의 여러 높이를 누른다.
  for (const gap of [2, 7, 12, 17]) {
    await tap(page, columnX, HEIGHT / 2 + INVENTORY_LIST_BOTTOM + gap);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles), `창 아래변 +${gap}px`).toEqual(["가방"]);
  }
  // 같은 열의 창 안쪽(아래변 위 한 뼘)은 그대로 눌려 룬 쪽지가 열린다 — 입력을 통째로 막은 것이 아니다.
  await tap(page, columnX, HEIGHT / 2 + INVENTORY_LIST_BOTTOM - 40);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length ?? 0)).toBeGreaterThan(1);
});
