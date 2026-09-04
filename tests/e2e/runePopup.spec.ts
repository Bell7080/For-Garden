import { expect, test, type Page } from "@playwright/test";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { startAfterOpening } from "./openingSave";
import { RELICS, sortRelicsBySpecimenNumber } from "../../src/data/relics";
import { compareBookmarkedOwnedRelics } from "../../src/core/relicCatalog";
import type { Session } from "../../src/state/session";
import { captureGame, tap, tapUntil } from "./canvasInput";

const W = 1080;
const H = 1920;

/**
 * 도감이 먼저 세우는 카드의 렐릭.
 *
 * 보유한 것이 위에 모이고, 그 안에서는 **즐겨찾기가 먼저** 온 뒤 기본 정렬(개체번호순)을
 * 따른다. 화면과 같은 순수 규칙(`compareBookmarkedOwnedRelics`)을 그대로 통과시켜 스펙이
 * 정렬을 다시 짜지 않게 한다 — 다시 짜면 화면이 바뀔 때 여기만 옛 순서를 믿는다.
 */
function firstCatalogRelicId(session: Session): string {
  const byNumber = sortRelicsBySpecimenNumber(RELICS.filter((relic) => session.owned.has(relic.id)));
  const order = new Map(byNumber.map((relic, index) => [relic.id, index]));
  return [...byNumber].sort((a, b) => compareBookmarkedOwnedRelics(a, b, {
    bookmarked: session.bookmarked,
    bondOf: (relic) => session.relicProgress[relic.id],
    fallback: (left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
  }))[0].id;
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
  // 로비는 이름이 바뀐 뒤에도 하단 탭의 입력면을 마저 만든다 — 될 때까지 다시 누른다.
  await tapUntil(page, W * 0.3, H - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");
  // 애착 렐릭(토리카) 카드 → 1번 룬 조각 → 쪽지의 세공 버튼 순서다. 각 판은 원화·조각을
  // 비동기로 읽으므로, 다음을 누르기 전에 실제로 열렸는지 확인한다 — 열리기 전에 누르면 허공을 친다.
  await tapUntil(page, 530, 580, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await tapUntil(page, 688, 1350, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).some((title) => title.includes("룬")));
  // 쪽지의 세공 버튼은 줄 구성(세공·해제 / 세공·장착·판매)에 따라 자리가 달라진다 — 화면이
  // 알려 주는 좌표를 쓴다. 좌표를 적어 두면 쪽지 바깥을 눌러 그냥 닫아 버린다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.runeNoteCraft)).not.toBeUndefined();
  const craft = (await page.evaluate(() => window.__PF_DEBUG!.runeNoteCraft!))!;
  await tap(page, craft.x, craft.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("룬 세공");
}

test("세로 화면에서 전설 5행×3칸, 긴 옵션명, 키보드 이름 입력과 바깥 닫기가 함께 동작한다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
    const rune = createRuneInstance({ instanceId: "e2e-legendary", baseName: "전설 테스트", rarity: "legendary", part: 0, statValues: values, random: () => 0 });
    session.runeInventory = [rune];
    // **도감 첫 카드에 서는 렐릭**에 끼운다. 애착 렐릭이 아니다 — 목록은 보유한 것을 개체번호
    // 순으로 세우므로 첫 카드는 번호가 가장 앞선 렐릭이고, 애착과 다를 수 있다. 그걸 맞추지
    // 않으면 첫 조각이 빈 자리라 쪽지 대신 장착용 가방이 열리고, 실패는 "세공 화면이 안 열린다"로만 보인다.
    session.relicProgress[firstCatalogRelicId(session)].heartGemSlots[0] = rune.instanceId;
  });
  await openFirstRune(page);
  // 연필 조작은 네이티브 입력을 띄워 모바일 소프트 키보드와 동일한 입력 경로를 사용한다.
  // 연필 자리는 이름 글자 폭에 따라 달라지므로 화면이 알려 주는 좌표를 쓴다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.runeForgeRename)).not.toBeUndefined();
  const pencil = (await page.evaluate(() => window.__PF_DEBUG!.runeForgeRename!))!;
  // 네이티브 입력을 띄우는 조작이라 되풀이해 누르지 않는다.
  await tap(page, pencil.x, pencil.y);
  const input = page.getByLabel("룬 이름");
  await expect(input).toBeVisible();
  await input.fill("긴 이름을 가진 전설의 궁극기 충전 룬");
  await input.press("Enter");
  await captureGame(page, `test-results/${test.info().project.name}-rune-legendary.png`);
  await tap(page, 20, 20);
  await expect(input).toBeHidden();
});

test("골드 부족이면 능력치를 골라도 강화 요청을 잠근다", async ({ page }) => {
  await startAfterOpening(page, (session) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
    const rune = createRuneInstance({ instanceId: "e2e-poor", baseName: "골드 부족", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
    session.wallet.gold = 0;
    session.runeInventory = [rune];
    // **도감 첫 카드에 서는 렐릭**에 끼운다. 애착 렐릭이 아니다 — 목록은 보유한 것을 개체번호
    // 순으로 세우므로 첫 카드는 번호가 가장 앞선 렐릭이고, 애착과 다를 수 있다. 그걸 맞추지
    // 않으면 첫 조각이 빈 자리라 쪽지 대신 장착용 가방이 열리고, 실패는 "세공 화면이 안 열린다"로만 보인다.
    session.relicProgress[firstCatalogRelicId(session)].heartGemSlots[0] = rune.instanceId;
  });
  await openFirstRune(page);
  // 첫 능력치 행을 골라도 비용보다 보유 골드가 적어 서버 요청이 발생하지 않는다.
  await tap(page, 540, 610);
  await tap(page, 540, 1452);
  await captureGame(page, `test-results/${test.info().project.name}-rune-insufficient-gold.png`);
});
