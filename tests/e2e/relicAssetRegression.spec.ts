import { expect, test, type Page } from "@playwright/test";
import { clearFormationSlot, gridCardPoint, placeInFormationSlot } from "./formationSlotTap";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap as tapGame, tapUntil, waitForDebugState } from "./canvasInput";

/** 타이틀에서 기본 작전의 편성 화면까지 공용 UI만 눌러 이동한다. */
async function openParty(page: Page): Promise<void> {
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  // 출격 선택판은 SD를 읽어 오므로 열릴 때까지 기다린 뒤 누른다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tapGame(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

test("도디·메테의 도감 전신과 루카 포함 편성·전투 SD 에셋을 한 흐름에서 고정한다", async ({ page }, testInfo) => {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 로비도 같은 manager/resolver 결과를 그리므로 도감·편성·전투와 함께 회귀 캡처한다.
  await captureGame(page, `test-results/${testInfo.project.name}-asset-equipped-lobby-fullbody.png`);
  // 로비는 이름이 바뀐 뒤에도 하단 탭의 입력면을 마저 만든다 — 될 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");

  // 카드 자리는 도감이 내놓는 값을 읽는다 — 기본 보유와 격자 칸 수가 바뀔 때마다 고정 좌표가 어긋났다.
  const dodi = await gridCardPoint(page, "relics", "dodo");
  await tapUntil(page, dodi.x, dodi.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  const mette = await gridCardPoint(page, "relics", "mette");
  await tapUntil(page, mette.x, mette.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-mette-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);

  // 로비로 돌아온 뒤 도디·메테·루카를 직접 골라 편성 SD와 같은 조합의 전투 SD를 연속 캡처한다.
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await openParty(page);
  // 준비 화면은 직전 편성을 복원해 세 명이 이미 서 있다 — 먼저 내려야 원하는 셋을 순서대로 세울 수 있다.
  // 칸은 한 번 누르면 고르고 한 번 더 누르면 빠진다. 세울 때는 칸을 고른 뒤 목록 카드를 누른다.
  for (const index of [0, 1, 2]) await clearFormationSlot(page, "party", index);
  for (const [index, relicId] of [[0, "dodo"], [1, "mette"], [2, "luka"]] as const) await placeInFormationSlot(page, index, relicId);
  // 비동기 조립 결과로 PartyScene에 세 SD 컨테이너가 실제 생길 때까지 기다린다.
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.party ?? 0) >= 3, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-party-sd.png`);
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toEqual(["도디", "메테", "루카"]);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-battle-sd.png`);
});

test("토리카 기본 외형에서 스킨을 장착해 도감·로비·편성·전투·재시작까지 같은 한 벌을 유지한다", async ({ page }, testInfo) => {
  // 도감·전시관·로비·편성·전투에 재시작까지 한 편에 담아 여섯 번의 Puppet 조립을 기다린다.
  // SwiftShader로 도는 CI에서는 기본 240초 안에 끝나지 않는다.
  test.setTimeout(420_000);
  // 신규 계정의 정적 기본 해금만으로 외형 선택 흐름이 열려야 한다.
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");

  // 토리카(anky) 카드 자리는 도감이 내놓는 값을 읽는다.
  const torika = await gridCardPoint(page, "relics", "anky");
  await tapUntil(page, torika.x, torika.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  // 외형 칩은 오른쪽 기둥 가운데에 선다(`appearanceButtonX()` = 991, `APPEARANCE_BUTTON.y`).
  // 칩은 정보창이 그 개체를 다 읽은 뒤에야 보이므로 열릴 때까지 눌러 본다.
  await tapUntil(page, 991, 1580, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).includes("외형"));
  // 두 resolver Puppet이 비동기 addAt으로 카드에 조립된 뒤, 각 카드의 선택 배율을 물려받으면서도
  // 카드 중심(x=0)과 공용 바닥선에 나란히 선 완성 상태를 시각 회귀로 남긴다.
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.relics ?? 0) >= 3, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-appearance-default.png`);

  // 띠의 둘째 칸(여름방학 토리카)을 고른 뒤 **판 밑동의** 장착 버튼으로 manager 경계를 호출한다.
  // 창은 화면 한가운데(540, 960)에 서므로 좌표는 `APPEARANCE_PANEL`의 띠·조작 자리 그대로다.
  await tapGame(page, 402, 1374);
  await tapGame(page, 540, 1532);
  await waitForDebugState(page, () => window.__PF_DEBUG?.infoAssetReady, { portrait: true, sd: true }, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-appearance-skin001.png`);

  // **전시관에는 X가 없다** — 나가는 길은 화면 어디서나 같은 자리(우하단)라 판 밖의 공용
  // 뒤로가기가 그 몫을 맡는다. 닫고 나서 같은 스킨 전신을 도감 정보창 자체에서도 캡처한다.
  await tapUntil(page, BASE_WIDTH - 106, BASE_HEIGHT - 120, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length === 0);
  await waitForDebugState(page, () => window.__PF_DEBUG?.infoAssetReady, { portrait: true, sd: true }, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-catalog-fullbody.png`);
  await tapUntil(page, BASE_WIDTH - 106, BASE_HEIGHT - 120, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === false);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.lobby ?? 0) >= 1, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-lobby-fullbody.png`);

  await openParty(page);
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.party ?? 0) >= 3, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-party-sd.png`);
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toContain("토리카");
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-battle-sd.png`);

  // 실제 앱 재시작과 같은 새로고침을 거쳐 저장에서 장착 ID가 복원된 로비 전신을 마지막으로 남긴다.
  await page.reload();
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.lobby ?? 0) >= 1, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-restored-lobby-fullbody.png`);
});

test("스킨 ZIP 하나가 실패해도 타이틀과 기본 토리카 외형으로 계속 진행한다", async ({ page }, testInfo) => {
  // 전신 스킨 하나만 네트워크 실패시켜 단계 실패가 나머지 로딩과 기본 외형까지 막지 않는지 재현한다.
  await page.route("**/puppets/char_001_skin001.zip", (route) => route.abort("failed"));
  await startAfterOpening(page, (session) => {
    delete session.equippedRelicSkinIds.anky;
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("title");
  await captureGame(page, `test-results/${testInfo.project.name}-skin-zip-failure-title-continues.png`);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await waitForDebugState(page, () => (window.__PF_DEBUG?.puppetContainers?.lobby ?? 0) >= 1, true, { timeout: 60_000 });
  await captureGame(page, `test-results/${testInfo.project.name}-skin-zip-failure-default-torika.png`);
});
