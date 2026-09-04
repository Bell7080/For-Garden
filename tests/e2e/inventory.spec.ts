import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { inventoryCategoryTabPosition } from "../../src/ui/inventoryTabs";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { captureGame, tap, tapUntil } from "./canvasInput";
// 레일 자리는 화면이 소유한 배치표에서 읽는다 — 좌표를 스펙에 베껴 두면 줄이 옮겨질 때 조용히 빗나간다.
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";

const WIDTH = 1080; const HEIGHT = 1920;

test("가방은 로비를 유지하고 카테고리 탭과 많은 항목 스크롤 입력을 받는다", async ({ page }) => {
  // 고해상도 WebGL 캡처가 무GPU CI에서도 완료되도록 이 시각 회귀만 여유 시간을 둔다.
  test.setTimeout(240_000);
  await startAfterOpening(page, (state) => {
    // 저장 검증을 통과하는 실제 두 스택으로 카테고리 전환과 목록 행을 준비한다.
    state.itemInventory = [{ itemId: "stamina-tonic", quantity: 10 }, { itemId: "rune-dust", quantity: 500 }];
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
  await page.waitForTimeout(100);
  await captureGame(page, `test-results/${test.info().project.name}-inventory-popup.png`);

  // 외부 뒤로가기로 닫은 뒤 버튼과 팝업 인스턴스가 함께 정리되어 같은 가방을 다시 열 수 있어야 한다.
  await tap(page, WIDTH - 106, HEIGHT - 120);
  await tap(page, WIDTH - 106, 1096);
  await page.waitForTimeout(150);
  await captureGame(page, `test-results/${test.info().project.name}-inventory-popup-reopened.png`);
  // 재개방 캡처까지 끝나면 테스트가 만든 팝업은 페이지 종료와 함께 정리된다.
});

test("상단과 가방 재화는 같은 안내를 열고 가방 위 안내만 닫아도 스택을 보존한다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 기본 상단의 첫 칩(젬)을 눌러 공용 안내 제목이 스택에 기록되는지 확인한다.
  await tapUntil(page, 500, 86, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).includes("젬"));
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["젬"]);
  await tap(page, 880, 556);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual([]);

  await tap(page, WIDTH - 106, 1096);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("rune");
  const currencyTab = inventoryCategoryTabPosition(1);
  await tap(page, WIDTH / 2 + currencyTab.x, HEIGHT / 2 + currencyTab.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("currency");
  // 첫 재화 카드(화석)는 가방 레이어 위에 동일 안내를 한 장 더 쌓는다.
  await tap(page, WIDTH / 2 - 312, HEIGHT / 2 - 510);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["가방", "화석"]);
  // 안내 X만 닫으면 아래 가방과 선택된 재화 탭이 그대로 남아야 한다.
  await tap(page, 880, 556);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["가방"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)).toBe("currency");
  await captureGame(page, `test-results/${test.info().project.name}-currency-guide-stack.png`);
});
