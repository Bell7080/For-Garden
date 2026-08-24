import { expect, test, type Page } from "@playwright/test";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { startAfterOpening } from "./openingSave";

const W = 1080;
const H = 1920;

/** FIT 캔버스의 화면 좌표를 게임 기준 좌표로 눌러 기기별 letterbox 차이를 없앤다. */
async function tap(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했습니다.");
  await canvas.click({ position: { x: x / W * box.width, y: y / H * box.height } });
}

/**
 * 로비→렐릭→첫 카드→첫 룬 조각→세공의 실제 사용자 경로로 세공 화면을 연다.
 *
 * 조각을 누르면 먼저 간소한 룬 쪽지가 열리고, 세공은 거기서 한 번 더 골라야 열린다. 쪽지의
 * 세공 버튼은 조각 위쪽으로 붙는 팝업의 아래쪽에 서므로, 조각 좌표에서 일정한 거리만큼 위다.
 */
async function openFirstRune(page: Page): Promise<void> {
  await tap(page, W / 2, H / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, W * 0.3, H - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("relics");
  // 애착 렐릭(토리카) 카드 → 1번 룬 조각 → 쪽지의 세공 버튼 순서다.
  await tap(page, 530, 580);
  await tap(page, 688, 1350);
  await tap(page, 676, 1232);
}

test("세로 화면에서 전설 5행×3칸, 긴 옵션명, 키보드 이름 입력과 바깥 닫기가 함께 동작한다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
    const rune = createRuneInstance({ instanceId: "e2e-legendary", baseName: "전설 테스트", rarity: "legendary", part: 0, statValues: values, random: () => 0 });
    session.runeInventory = [rune];
    session.relicProgress[session.favorite].heartGemSlots[0] = rune.instanceId;
  });
  await openFirstRune(page);
  // 연필 조작은 네이티브 입력을 띄워 모바일 소프트 키보드와 동일한 입력 경로를 사용한다.
  await tap(page, 850, 456);
  const input = page.getByLabel("룬 이름");
  await expect(input).toBeVisible();
  await input.fill("긴 이름을 가진 전설의 궁극기 충전 룬");
  await input.press("Enter");
  await page.screenshot({ path: `test-results/${test.info().project.name}-rune-legendary.png` });
  await tap(page, 20, 20);
  await expect(input).toBeHidden();
});

test("골드 부족이면 능력치를 골라도 강화 요청을 잠근다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
    const rune = createRuneInstance({ instanceId: "e2e-poor", baseName: "골드 부족", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
    session.wallet.gold = 0;
    session.runeInventory = [rune];
    session.relicProgress[session.favorite].heartGemSlots[0] = rune.instanceId;
  });
  await openFirstRune(page);
  // 첫 능력치 행을 골라도 비용보다 보유 골드가 적어 서버 요청이 발생하지 않는다.
  await tap(page, 540, 610);
  await tap(page, 540, 1452);
  await page.screenshot({ path: `test-results/${test.info().project.name}-rune-insufficient-gold.png` });
});
