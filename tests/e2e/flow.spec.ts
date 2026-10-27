import { E2E_SAVE_STORAGE_KEY } from "./openingSave";
import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { clearFormationSlot, gridCardPoint, placeInFormationSlot } from "./formationSlotTap";
// 캔버스 입력은 한 곳이 소유한다 — 스펙마다 두면 느린 구현이 그대로 살아남는다.
import { captureGame, drag, longPress, tap, tapUntil } from "./canvasInput";
// 조작 칩 좌표는 화면이 소유한 배치표에서 읽는다 — 스펙이 숫자를 다시 적으면 칩이 움직일
// 때마다 여기만 옛 자리를 두드린다.
import { BATTLE_CONTROLS } from "../../src/ui/battleStatusLayout";
import { BATTLE_CONTRIBUTION_LAYOUT, CONTRIBUTION_TOGGLE } from "../../src/ui/battleContributionLayout";
import { LAB_CHROME, LAB_TITLE } from "../../src/ui/labLayout";
import { gachaRatesTierScreenY } from "../../src/ui/gachaRatesLayout";
import { BACK_SLOT, POPUP_CLOSE_LAYOUT } from "../../src/ui/popupGeometry";
import { DIALOGUE_PANEL_TOP } from "../../src/ui/dialogueStageLayout";
import { PLAYER_LEVEL_UP_REWARD, playerExpToNext } from "../../src/core/playerLevel";
import { PARTY_PREVIEW, PARTY_PREVIEW_COLUMNS } from "../../src/ui/partyPreviewLayout";
import { BATTLE_SPEEDS } from "../../src/core/battleControls";
import { staminaPopupLayout, STAMINA_CELL } from "../../src/ui/staminaPopupLayout";
import { currencyGuide } from "../../src/data/currencyGuide";
import { CONTENT_STAMINA_COSTS } from "../../src/data/contentCosts";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

test("충전 직후 결과판의 같은 다음 단계 버튼으로 입장한다", async ({ page }) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await page.addInitScript(() => { window.__PF_BATTLE_TEST__ = { seed: 0x5eed, preset: "result" }; });
  await enterBattle(page, (state) => {
    state.wallet.stamina = CONTENT_STAMINA_COSTS.normalStage;
    state.staminaUpdatedAt = new Date().toISOString();
    state.itemInventory = [{ itemId: "stamina-tonic", quantity: 2 }];
    state.completedStoryIds.add("stage-1-2-post");
    state.completedStoryIds.add("stage-1-3-pre");
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup), { timeout: 20_000 }).toBe(true);
  await tap(page, 268, 1490);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("스테미나");
  await page.waitForTimeout(500);
  await captureGame(page, "docs/qa/energy-achievements-2026-10-27/energy-before.png");
  const guide = currencyGuide("stamina");
  const layout = staminaPopupLayout(Math.max(guide.uses.length, guide.sources.length));
  // 우상단에는 닫기 입력도 남기지 않는다. 돌아가기는 판 밖 우하단 공용 뒤로가기 한 곳이 맡는다.
  await tap(page, BASE_WIDTH / 2 + layout.width / 2 - POPUP_CLOSE_LAYOUT.centerInset, BASE_HEIGHT / 2 - layout.height / 2 + POPUP_CLOSE_LAYOUT.centerInset);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("스테미나");
  await tap(page, BASE_WIDTH / 2 + layout.cell.centers[0], BASE_HEIGHT / 2 + layout.cell.y + STAMINA_CELL.buttonY);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).wallet.stamina, E2E_SAVE_STORAGE_KEY)).toBe(60);
  await page.waitForTimeout(500);
  await captureGame(page, "docs/qa/energy-achievements-2026-10-27/energy-recharged.png");
  await tap(page, BACK_SLOT.x, BACK_SLOT.y);
  await expect.poll(() => page.evaluate(() => Boolean(window.__PF_DEBUG?.popupTitles?.includes("스테미나")))).toBe(false);
  await tap(page, 268, 1490);
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("party");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedCount)).toBe(3);
  await captureGame(page, "docs/qa/energy-achievements-2026-10-27/entered-after-recharge.png");
});

/**
 * 편성 화면 그리드에서 렐릭 카드의 기준 좌표.
 * 그리드에는 **보유한** 렐릭만 순서대로 놓인다 — 시작 보유는 전용 아트가 완성된 세 명이다.
 */
/**
 * 로비 출격 버튼의 한가운데.
 *
 * 유리판이 기울어 있어 모서리를 누르면 빗나간다. 씬이 두는 좌표(NAV_TOP - 245)와 같은 값을
 * 여기에도 적어 둔다.
 */
const SORTIE: [number, number] = [BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245];

function scene(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}
function battle(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.battle);
}
function infoOpen(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.infoOpen);
}

/** 타이틀에서 편성 화면까지 들어간다. */
async function enterParty(page: Page, prepare?: Parameters<typeof startAfterOpening>[1]): Promise<void> {
  await startAfterOpening(page, prepare);

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); // 타이틀 → 로비
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, ...SORTIE); // 출격 버튼
  // 선택판은 SD를 읽어 오므로 열릴 때까지 기다린 뒤 누른다 — 열리기 전에 누르면 허공을 친다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  // 출격 선택판에서 스토리를 골라 기존 메인 작전 지도로 이어 간다.
  await tap(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도는 열려 있는 가장 뒤쪽 스테이지를 이미 골라 둔다. 출전만 누르면 편성으로 넘어간다.
  // 지도가 그려지는 중에는 첫 누름이 허공을 칠 수 있어 편성이 열릴 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH / 2, BASE_HEIGHT - 180, async () => (await scene(page)) === "party"); // 출전
  await expect.poll(() => scene(page)).toBe("party");
}

/**
 * 파티를 토리카 · 도디 · 파루아 순으로 고른다.
 *
 * **준비 화면은 빈 상태로 열리지 않는다** — 직전 스토리 편성을 복원하고, 그것이 온전하지 않으면
 * 자동 편성으로 세 명을 채운다. 그래서 고르기 전에 먼저 세 명을 해제해야 한다. 해제 없이 세 번만
 * 누르면 이미 선 세 명을 도로 내리는 셈이라 0/3이 되고, 출전 버튼은 아무 일도 하지 않는다.
 */
async function pickParty(page: Page): Promise<void> {
  /*
   * **씬 이름이 바뀐 순간과 입력면이 생기는 순간은 다르다.**
   *
   * 준비 화면은 카드·SD를 읽어 온 뒤에야 누를 수 있는데, `scene`이 `party`로 바뀌는 것은 그보다
   * 먼저다. 카드가 서기 전에 누르면 허공을 치고, 해제와 선택 중 하나만 빗나가도
   * 3/3이 아닌 채로 끝난다 — 그러면 출전 버튼은 조용히 아무 일도 하지 않고, 실패는
   * "전투로 안 넘어간다"로만 보여 원인이 편성에 있다는 것이 드러나지 않는다.
   *
   * 화면은 직전 편성(없으면 자동 편성)으로 **세 자리를 채운 채** 열리므로, 그 셋이 실제로 선
   * 것을 준비 신호로 삼는다.
   */
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedCount)).toBe(3);
  for (const index of [0, 1, 2]) await clearFormationSlot(page, "party", index);
  for (const [index, relicId] of [[0, "torika"], [1, "dodo"], [2, "parua"]] as const) {
    await placeInFormationSlot(page, index, relicId);
  }
  // 고른 결과가 정말 세 자리인지 여기서 못 박는다 — 빗나간 탭을 다음 단계로 넘기지 않는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedCount)).toBe(3);
}

async function enterBattle(page: Page, prepare?: Parameters<typeof startAfterOpening>[1]): Promise<void> {
  await enterParty(page, prepare);
  await pickParty(page);
  // startAfterOpening의 탐색 뒤에 지정해야 새 문서에서도 seed가 남는다.
  // 결과판 검사가 addInitScript로 지정한 preset은 유지한다.
  await page.evaluate(() => { window.__PF_BATTLE_TEST__ ??= { seed: 0x5eed }; });
  await tap(page, BASE_WIDTH / 2, BACK_SLOT.y); // 전투 시작
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("battle");
}

test("스토리 전투 확정 편성은 다음 스테이지 준비 저장에 유지된다", async ({ page }) => {
  await enterBattle(page);
  const savedParty = await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "null")?.party, E2E_SAVE_STORAGE_KEY);
  // 다음 스테이지 PartyScene도 이 저장 순서를 최초 카드·SD·3/3 상태에 그대로 사용한다.
  //
  // `enterBattle`이 고르는 순서는 토리카 → 도디 → 파루아이고, 편성은 **고른 순서**로 선다.
  // 그리드 순서(도디 → 토리카 → 파루아)와 일부러 어긋나게 골라야 "저장이 그리드를 다시 읽지
  // 않고 고른 순서를 그대로 들고 있다"가 증명된다 — 그리드 순서를 기대값으로 적으면 정렬이
  // 무너져도 테스트가 통과한다.
  expect(savedParty).toEqual(["torika", "dodo", "parua"]);
});

test("원정 종료 뒤에도 다음 원정 전용 편성 저장은 스토리·발굴과 독립적으로 유지된다", async ({ page }) => {
  await startAfterOpening(page);
  const snapshot = await page.evaluate((saveKey) => {
    const value = JSON.parse(localStorage.getItem(saveKey) ?? "null");
    // 실제 종료 저장과 같은 모양으로 run만 닫혀도 마지막 확정 편성이 남는 회귀 계약을 확인한다.
    value.expedition.lastParty = ["parua", "dodo", "torika"];
    value.expedition.run = null;
    localStorage.setItem(saveKey, JSON.stringify(value));
    return { lastParty: value.expedition.lastParty, party: value.party, excavation: value.idleExcavation.assignedRelicIds };
  }, E2E_SAVE_STORAGE_KEY);
  expect(snapshot.lastParty).toEqual(["parua", "dodo", "torika"]);
  expect(snapshot.lastParty).not.toEqual(snapshot.party);
  expect(snapshot.lastParty).not.toEqual(snapshot.excavation);
});

test("출격 → 스테이지 지도 → 파티 편성 → 전투까지 이어진다", async ({ page }) => {
  await enterBattle(page);

  const state = await battle(page);
  expect(state?.phase).toBe("fight");
  // 편성한 셋이 그대로 전장에 선다.
  expect(state?.playerOrder).toEqual(["토리카", "도디", "파루아"]);
});

/** 기준 해상도 한 장에 전장 HP 바와 하단 궁극기 프로필의 실제 간격을 시각 회귀 자료로 남긴다. */
test("1080×1920 전장 HUD와 궁극기 입력이 겹치지 않는다", async ({ page }, testInfo) => {
  // 캔버스 자체가 1080×1920 기준 좌표계이므로 기기 프로젝트의 터치 뷰포트는 유지한다.
  await enterBattle(page);
  await expect.poll(async () => (await battle(page))?.phase).toBe("fight");
  await captureGame(page, `test-results/${testInfo.project.name}-battle-hp-buffs-ultimate-safe-area-1080x1920.png`);
});

test("전투 기여도 판을 열고 세 분류를 바꾼 뒤 접어 1080×1920 테마를 보존한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterBattle(page);
  // 판을 여는 칩은 전투 조작 줄(배속 칩 바로 위)에 선다 — 자리는 순수 배치표가 갖는다.
  await tap(page, CONTRIBUTION_TOGGLE.x, CONTRIBUTION_TOGGLE.y);
  await expect.poll(async () => (await battle(page))?.contributionPanel?.expanded).toBe(true);
  // 84×72 직접 선택 영역의 중앙을 차례로 눌러 모바일에서 분류 순환을 검증한다.
  const tabs = BATTLE_CONTRIBUTION_LAYOUT.categories;
  for (const [index, category] of [[1, "defense"], [2, "healing"], [0, "attack"]] as const) {
    // expanded는 슬라이드 시작 시 바뀐다. 저프레임 환경에서 이동 중인 옆 탭을 누른 경우,
    // 판이 제자리에 선 뒤 같은 분류를 다시 선택한다(분류 선택은 멱등 동작).
    await tapUntil(page, tabs.left + tabs.itemWidth * (index + 0.5), tabs.top + tabs.height / 2,
      async () => (await battle(page))?.contributionPanel?.category === category);
    await expect.poll(async () => (await battle(page))?.contributionPanel?.category).toBe(category);
  }
  await captureGame(page, `test-results/${testInfo.project.name}-battle-contribution-expanded-1080x1920.png`);
  // 같은 칩을 다시 눌러 접는다. 판 밖 아무 곳이나 눌러도 접히지만, 그 칩은 판 밖이라
  // 그 한 번이 접기와 펴기로 갈리지 않아야 한다.
  await tap(page, CONTRIBUTION_TOGGLE.x, CONTRIBUTION_TOGGLE.y);
  await expect.poll(async () => (await battle(page))?.contributionPanel?.expanded).toBe(false);
});

test("일반 전투 결과의 기여도 세 분류를 확인하고 닫은 뒤 기존 저장 조작으로 복귀한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  // test mode에서만 열리는 preset은 적 HP만 1로 시작시켜 결과 팝업 연결을 실제 시간 대기와 분리한다.
  await page.addInitScript(() => { window.__PF_BATTLE_TEST__ = { seed: 0x5eed, preset: "result" }; });
  await enterBattle(page);
  await expect.poll(async () => (await battle(page))?.phase !== "fight", { timeout: 10_000 }).toBe(true);
  // 승리 결과는 StageCompletePopup(보상 팝업의 연장선)이다 — 화면 중심에 뜨는 "공격 · 방어 ·
  // 회복" 버튼(로컬 (0,90))을 눌러 같은 popups 위에 기여도 그래프를 한 겹 더 연다. SD가
  // 다 뜨기 전에 누르지 않도록 팝업이 실제로 열렸다는 디버그 플래그부터 기다린다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup)).toBe(true);
  await tap(page, BASE_WIDTH / 2, 1050);
  // 팝업 중앙 기준 세 탭의 넓은 입력면을 눌러 공격 → 방어 → 회복 전환을 시각 자료로 남긴다.
  for (const [name, x] of [["attack", 290], ["defense", 540], ["healing", 790]] as const) {
    await tap(page, x, 425); await page.waitForTimeout(100);
    await captureGame(page, `test-results/${testInfo.project.name}-battle-result-contribution-${name}-1080x1920.png`);
  }
  // 닫기는 화면 우하단의 **공용 뒤로가기**(BACK_SLOT)다 — 판 안의 라벨 버튼이 아니라 다른
  // 화면과 같은 자리·같은 아이콘이다. 닫으면 뒤에 있던 StageCompletePopup으로 돌아가고
  // 숨겨졌던 "공격 · 방어 · 회복" 버튼이 다시 보인다. 그 팝업은 화면 아무 곳(SD 자리 근처)을
  // 눌러도 이 관문의 초회 후 대사를 거쳐 지도로 넘어간다.
  await tap(page, BASE_WIDTH - 106, BASE_HEIGHT - 120); await tap(page, BASE_WIDTH / 2, 790);
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("stageStory");
  // 1-2 후 대사는 선택지가 없는 여덟 마디다. 타이핑 완성과 다음 마디를 공용 패널 탭으로 진행한다.
  await tapUntil(page, BASE_WIDTH / 2, DIALOGUE_PANEL_TOP + 290,
    async () => (await scene(page)) === "stageMap", { attempts: 40, gapMs: 1_000 });
  await expect.poll(() => scene(page)).toBe("stageMap");
  const saved = await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "null"), E2E_SAVE_STORAGE_KEY);
  expect(saved.clearedStageIds).toContain("1-2");
  expect(saved.completedStoryIds).toContain("stage-1-2-post");
});

test("전투 결과판에 연구원 경험치가 차오르고 레벨업 보상이 선다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await page.addInitScript(() => { window.__PF_BATTLE_TEST__ = { seed: 0x5eed, preset: "result" }; });
  // 한 판(스테미나 6)이면 레벨이 오르도록 요구치 바로 아래에서 시작한다.
  await enterBattle(page, (session) => {
    const experienceToNext = playerExpToNext(4);
    session.playerResearch = { level: 4, experience: experienceToNext - 1, experienceToNext };
    session.itemInventory = session.itemInventory.filter(({ itemId }) => itemId !== PLAYER_LEVEL_UP_REWARD.itemId);
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup), { timeout: 15_000 }).toBe(true);
  // 줄이 끝까지 찼다가 다시 차오르는 연출이 끝난 뒤에 찍는다.
  await page.waitForTimeout(2500);
  await captureGame(page, `test-results/${testInfo.project.name}-battle-result-player-exp-1080x1920.png`);
  const bottles = await page.evaluate(([saveKey, rewardId]) => JSON.parse(localStorage.getItem(saveKey) ?? "null")?.itemInventory?.find((entry: { itemId: string }) => entry.itemId === rewardId)?.quantity ?? 0,
    [E2E_SAVE_STORAGE_KEY, PLAYER_LEVEL_UP_REWARD.itemId] as const);
  expect(bottles).toBe(PLAYER_LEVEL_UP_REWARD.quantity);
  expect(await page.evaluate((saveKey) => JSON.parse(localStorage.getItem(saveKey) ?? "null")?.playerResearch?.level,
    E2E_SAVE_STORAGE_KEY)).toBe(5);
});

test("전투 시작의 빠른 연속 탭은 한 번만 진입하고 유효 편성을 보존한다", async ({ page }) => {
  await enterParty(page);
  await pickParty(page);

  // 첫 탭이 즉시 잠금을 걸므로 겹쳐 도착한 다음 입력이 저장/전환을 중복 실행하지 않는다.
  await Promise.all([tap(page, BASE_WIDTH / 2, BACK_SLOT.y), tap(page, BASE_WIDTH / 2, BACK_SLOT.y)]);
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("battle");
  expect((await battle(page))?.playerOrder).toEqual(["토리카", "도디", "파루아"]);
});

test("버튼 경계를 향한 작은 이동은 탭이고 큰 드래그는 취소된다", async ({ page }) => {
  await enterParty(page);
  await pickParty(page);

  // 80px 이동은 스크롤/드래그 의도로 보아 전투 진입을 취소한다.
  await drag(page, [BASE_WIDTH / 2, BACK_SLOT.y], [BASE_WIDTH / 2 + 80, BACK_SLOT.y]);
  await page.waitForTimeout(100);
  expect(await scene(page)).toBe("party");

  // 18px 이동은 손떨림으로 인정되어 정상 진입한다.
  await drag(page, [BASE_WIDTH / 2, BACK_SLOT.y], [BASE_WIDTH / 2 + 18, BACK_SLOT.y]);
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("battle");
});

test("편성 화면에서 렐릭을 꾹 누르면 정보창이 열린다", async ({ page }) => {
  await enterParty(page);
  expect(await infoOpen(page)).toBeFalsy();

  const portrait = await gridCardPoint(page, "party", "parua");
  await longPress(page, portrait.x, portrait.y);
  await expect.poll(() => infoOpen(page)).toBe(true);

  // 짧게 누르는 편성 토글과 섞이지 않아야 한다.
  await tap(page, BASE_WIDTH / 2, BACK_SLOT.y); // 정보창이 떠 있으면 전투 시작으로 넘어가지 않는다
  expect(await scene(page)).toBe("party");
});

test("편성 화면은 자동 배치한 세 명으로 바로 출전할 수 있다", async ({ page }) => {
  await enterParty(page);
  const auto = (await page.evaluate(() => window.__PF_DEBUG?.party?.autoButton))!;
  await tap(page, auto.x, auto.y); // 실제 자동 배치 버튼을 누른다.
  await tap(page, BASE_WIDTH / 2, BACK_SLOT.y);
  await expect.poll(() => scene(page), { timeout: 30_000 }).toBe("battle");
  expect((await battle(page))?.playerOrder).toHaveLength(3);
});

test("1080×1920 캐릭터 상세과 스킬 카드가 안전 영역 안에 표시된다", async ({ page }) => {
  // 기준 해상도를 직접 사용해 전신과 최대 폭 정보 레이어의 회귀를 스크린샷으로 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  const portrait = await gridCardPoint(page, "party", "parua");
  await longPress(page, portrait.x, portrait.y);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await captureGame(page, `test-results/${test.info().project.name}-character-info-1080x1920.png`);

  // 오른쪽 첫 스킬 버튼을 눌러 긴 한국어 설명 카드와 내부 뒤로가기 상태도 기록한다.
  await tap(page, 704, 1052);
  await captureGame(page, `test-results/${test.info().project.name}-skill-info-1080x1920.png`);
  // 스킬 상세의 뒤로가기(아이콘 버튼)로 캐릭터 상세로 되돌아온다.
  await tap(page, 694, 1450);
  await expect.poll(() => infoOpen(page)).toBe(true);
});

test("토리카 폭주 설명은 성장 능력치로 환산된 수치를 표시한다", async ({ page }) => {
  // 토리카 상세의 패시브 위 폭주 뱃지를 누르고, 긴 동적 설명이 1080×1920 쪽지 안에 들어오는지 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  const portrait = await gridCardPoint(page, "party", "torika");
  await longPress(page, portrait.x, portrait.y);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await tap(page, 124, 1585);
  await captureGame(page, `test-results/${test.info().project.name}-torika-ferocity-info-1080x1920.png`);
});

test("관찰 일지는 발굴 기록을 접어 두고 질문을 옆쪽으로 넘겨 연다", async ({ page }) => {
  // 이야기 묶음이 있는 개체의 일지: 본문 쪽(발굴 기록은 접힘) → 오른쪽 화살표로 관찰 질문 쪽.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  const portrait = await gridCardPoint(page, "party", "torika");
  await longPress(page, portrait.x, portrait.y);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await tap(page, 268, 300);
  await captureGame(page, `test-results/${test.info().project.name}-observation-journal.png`);
  await tap(page, BASE_WIDTH / 2 + 440, 945);
  await page.waitForTimeout(1200);
  await captureGame(page, `test-results/${test.info().project.name}-observation-question-page.png`);
});

test("출전 전 지도와 편성에서도 같은 적 분석창이 열린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, ...SORTIE);
  // 출격 선택판은 스토리와 원정을 분리하므로 지도 검증은 스토리를 명시해 들어간다.
  await tap(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도의 적 편성 팝업에서 첫 칸을 누른다. 성장 입력이 없는 적 전용 창이 떠야 한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview?.enemyTargets.length ?? 0),
    { timeout: 60_000 }).toBeGreaterThan(0);
  const enemy = (await page.evaluate(() => window.__PF_DEBUG!.enemyPreview!.enemyTargets[0]))!;
  await tap(page, enemy.x, enemy.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).toContain("정보창");
  await captureGame(page, `test-results/${test.info().project.name}-map-enemy-info.png`);

  await tap(page, BACK_SLOT.x, BACK_SLOT.y); // 뒤로가기 — 분석창만 닫힌다
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("정보창");
  expect(await scene(page)).toBe("stageMap");

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT - 180); // 출전 → 편성
  await expect.poll(() => scene(page)).toBe("party");
  await tap(page, PARTY_PREVIEW_COLUMNS[0], PARTY_PREVIEW.enemyRow - PARTY_PREVIEW.height / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).toContain("정보창");
});

test("전투 중 움직이는 적을 누르면 적 전용 정보창과 일러스트가 열린다", async ({ page }) => {
  await enterBattle(page);
  await expect.poll(async () => (await battle(page))?.enemyTargets?.length).toBe(3);

  // 전투원은 계속 움직이므로 디버그 계약이 공개한 현재 클릭 영역 중심을 읽은 직후 누른다.
  const target = (await battle(page))!.enemyTargets![0];
  await tap(page, target.x, target.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).toContain("정보창");
  await captureGame(page, `test-results/${test.info().project.name}-battle-enemy-info.png`);
});

test("전투 조작 칩으로 모든 배속과 자동 궁극기를 전환한다", async ({ page }) => {
  await enterBattle(page);
  expect(await battle(page)).toMatchObject({ speed: 1, autoUltimate: false });

  // 현재 배속 표(1→1.5→2→3)를 한 바퀴 순환하고 초기 값으로 돌아온다.
  for (const speed of [...BATTLE_SPEEDS.slice(1), BATTLE_SPEEDS[0]]) {
    await tap(page, BATTLE_CONTROLS.speedX, BATTLE_CONTROLS.rowY);
    await expect.poll(async () => (await battle(page))?.speed).toBe(speed);
  }

  // 자동 궁극기는 배속과 독립적으로 켜고 끌 수 있다.
  await tap(page, BATTLE_CONTROLS.rightX, BATTLE_CONTROLS.rowY);
  await expect.poll(async () => (await battle(page))?.autoUltimate).toBe(true);
  // 세 번째 칩도 같은 줄에 있으며 누르는 즉시 저장된 스킵 상태가 디버그 관찰값에 반영된다.
  await tap(page, BATTLE_CONTROLS.rightX, BATTLE_CONTROLS.rowY - BATTLE_CONTROLS.stackGap);
  await expect.poll(async () => (await battle(page))?.skipUltimatePresentation).toBe(true);
  await expect.poll(async () => (await battle(page))?.autoUltimate).toBe(true);
  await captureGame(page, `test-results/${test.info().project.name}-battle-controls.png`);
});

test("@slow 실제 시간 전투는 한쪽이 전멸하면 끝난다", async ({ page }) => {
  // GPU 없는 실행기에서는 코어 17초의 판도 프레임 대기로 훨씬 오래 걸린다.
  test.setTimeout(420_000);
  await enterBattle(page);

  await expect
    .poll(async () => (await battle(page))?.phase, { timeout: 180_000 })
    .toMatch(/victory|defeat/);
});


test("하단 탭으로 고고학 · 렐릭 · 로비 · 연구소 · 프리미엄을 오간다", async ({ page }) => {
  await startAfterOpening(page, (session) => { session.cleared.add("1-5"); session.cleared.add("1-10"); });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  const navY = BASE_HEIGHT - 180 + 90;
  // 다섯 슬롯의 중심 좌표를 차례로 눌러 화면 순서와 연결을 함께 고정한다. 화면은 이름이 바뀐
  // 뒤에도 하단 탭의 입력면을 마저 만들므로, 옮겨질 때까지 다시 누른다.
  const goTab = async (x: number, target: string): Promise<void> => {
    await tapUntil(page, x, navY, async () => (await scene(page)) === target);
  };
  await goTab((BASE_WIDTH * 3) / 10, "relics");
  await goTab(BASE_WIDTH / 10, "archaeology");
  await goTab(BASE_WIDTH / 2, "lobby");
  await goTab((BASE_WIDTH * 7) / 10, "lab");
  await goTab((BASE_WIDTH * 9) / 10, "premium");
  // 프리미엄 화면에서 기간·즉시 수령·UTC 일일 제한을 구매 전에 읽을 수 있는 회귀 자료를 남긴다.
  await tap(page, 900, 225);
  // Phaser 캔버스 텍스트는 DOM 조회가 불가능하므로 재시작 렌더 한 프레임을 기다린다.
  await page.waitForTimeout(300);
  await captureGame(page, `test-results/${test.info().project.name}-premium-patron-pass.png`);
});

test("연구소에서 화석을 사용하면 렐릭 연구 결과가 뜬다", async ({ page }) => {
  test.setTimeout(300_000);
  await startAfterOpening(page, (session) => { session.cleared.add("1-5"); session.wallet.fossil = 3; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tapUntil(page, (BASE_WIDTH * 7) / 10, BASE_HEIGHT - 180 + 90, async () => (await scene(page)) === "lab");
  await expect.poll(() => scene(page)).toBe("lab");

  const before = await page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil);
  expect(before).toBe(3);

  // 첫 복원 연구는 10연 전용이므로 일반 화석 연구로 이동해 한 번을 요청한다.
  await tap(page, BASE_WIDTH - LAB_TITLE.arrow.x, LAB_TITLE.arrow.y);
  await tap(page, 300, LAB_CHROME.pull.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.researchBoard?.slots), { timeout: 120_000 }).toBe(1);
  // 슬롯별 신규/DNA 배지가 모바일 안전 영역에 표시되는 모습을 회귀 자료로 남긴다.
  await captureGame(page, `test-results/${test.info().project.name}-lab-pull-result.png`);
});

test("연구 재화가 모자라면 버튼 옆에 젬으로 채우는 값이 서고, 누르면 확인 창이 먼저 묻는다", async ({ page }) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await startAfterOpening(page, (session) => { session.cleared.add("1-5"); session.wallet.fossil = 1; session.wallet.gems = 5_000; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tapUntil(page, (BASE_WIDTH * 7) / 10, BASE_HEIGHT - 180 + 90, async () => (await scene(page)) === "lab");
  await expect.poll(() => scene(page)).toBe("lab");
  // 첫 복원 연구(10연 전용)를 넘겨 화석 연구로 간다 — 1회는 화석 1, 10회는 화석 1 + 젬 2,700이다.
  await tap(page, BASE_WIDTH - LAB_TITLE.arrow.x, LAB_TITLE.arrow.y);
  await captureGame(page, `test-results/${test.info().project.name}-lab-pull-gem-cost.png`);
  await tap(page, 780, LAB_CHROME.pull.y);
  await expect.poll(async () => (await page.evaluate(() => window.__PF_DEBUG?.popupTitles))?.length ?? 0).toBe(1);
  await captureGame(page, `test-results/${test.info().project.name}-lab-pull-gem-confirm.png`);
  // 확인 전에는 아무것도 빠지지 않았다.
  expect(await page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(1);
});

test("연구소 확률표는 등급 줄을 눌러 세부 확률을 펼치고, 세 배너 모두 같은 표를 쓴다", async ({ page }) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await startAfterOpening(page, (session) => { session.cleared.add("1-5"); });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tapUntil(page, (BASE_WIDTH * 7) / 10, BASE_HEIGHT - 180 + 90, async () => (await scene(page)) === "lab");
  await expect.poll(() => scene(page)).toBe("lab");

  const titles = (): Promise<string[] | undefined> => page.evaluate(() => window.__PF_DEBUG?.popupTitles);
  for (let banner = 0; banner < 3; banner += 1) {
    await tap(page, LAB_CHROME.rates.x + 60, LAB_CHROME.rates.y);
    await expect.poll(async () => (await titles())?.length ?? 0).toBe(1);
    // 처음에는 SSR이 펼쳐져 있다. 세 배너의 표가 모두 잘리지 않는지 회귀 이미지로 남긴다.
    await captureGame(page, `test-results/${test.info().project.name}-lab-rates-${banner}-ssr.png`);
    // SSR을 접고 잡화를 펼친다 — 윗변이 고정이라 등급 줄의 자리는 배치표가 그대로 말한다.
    await tap(page, BASE_WIDTH / 2, gachaRatesTierScreenY(0, null, 0));
    await tap(page, BASE_WIDTH / 2, gachaRatesTierScreenY(3, null, 0));
    await captureGame(page, `test-results/${test.info().project.name}-lab-rates-${banner}-gray.png`);
    await tap(page, BACK_SLOT.x, BACK_SLOT.y);
    await expect.poll(async () => (await titles())?.length ?? 0).toBe(0);
    await tap(page, BASE_WIDTH - LAB_TITLE.arrow.x, LAB_TITLE.arrow.y);
  }
});
