import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap as tapGame, tapUntil } from "./canvasInput";

/** 타이틀에서 기본 작전의 편성 화면까지 공용 UI만 눌러 이동한다. */
async function openParty(page: Page): Promise<void> {
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  // 출격 선택판은 SD를 읽어 오므로 열릴 때까지 기다린 뒤 누른다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  // 그림자 개수가 아니라 스토리와 폰토스의 서로 다른 본체가 비동기 소유권 검사를 통과했는지 본다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.sortieSdBodyAssetUrls?.slice().sort())).toEqual([
    "/puppets/enemySD_001.zip",
    "/puppets/enemySD_Pontos.zip",
  ]);
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

  // 개체번호순 기본 도감에서 도디는 첫 카드, 메테는 기본 보유 구역의 여섯 번째 카드다.
  await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await tapUntil(page, 880, 1094, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-mette-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);

  // 로비로 돌아온 뒤 도디·메테·루카를 직접 골라 편성 SD와 같은 조합의 전투 SD를 연속 캡처한다.
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await openParty(page);
  // 준비 화면은 직전 편성을 복원해 세 명이 이미 서 있다 — 먼저 내려야 원하는 셋을 순서대로 세울 수 있다.
  // 보유 순서는 토리카·렉시아·스피나·루카·도디·메테이고, 그리드는 다섯 칸마다 줄이 바뀐다.
  for (const [x, y] of [[116, 1080], [328, 1080], [540, 1080]] as const) await tapGame(page, x, y);
  for (const [x, y] of [[964, 1080], [116, 1324], [752, 1080]] as const) await tapGame(page, x, y);
  await page.waitForTimeout(1_000); // 비동기 Puppet 조립이 캡처 전에 세 자리를 모두 채우게 한다.
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-party-sd.png`);
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toEqual(["도디", "메테", "루카"]);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-battle-sd.png`);
});

test("토리카 기본 외형에서 스킨을 장착해 도감·로비·편성·전투·재시작까지 같은 한 벌을 유지한다", async ({ page }, testInfo) => {
  // 신규 계정의 정적 기본 해금만으로 외형 선택 흐름이 열려야 한다.
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");

  // 개체번호순 보유 구역의 세 번째 카드가 토리카다. 공용 정보창 우하단 외형 칩으로 진입한다.
  await tapUntil(page, 880, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await tapGame(page, 914, 1580);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("외형");
  // 두 resolver Puppet이 비동기 addAt으로 카드에 조립된 뒤, 각 카드의 선택 배율을 물려받으면서도
  // 카드 중심(x=0)과 공용 바닥선에 나란히 선 완성 상태를 시각 회귀로 남긴다.
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-torika-appearance-default.png`);

  // 오른쪽 추가 외형을 고른 뒤 공용 장착 버튼으로 manager 경계를 호출한다.
  await tapGame(page, 750, 870);
  await tapGame(page, 540, 1460);
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-torika-appearance-skin001.png`);

  // 선택판을 닫아 같은 스킨 전신을 도감 정보창 자체에서도 캡처한다.
  await tapGame(page, 958, 382);
  await page.waitForTimeout(500);
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-torika-skin001-lobby-fullbody.png`);

  await openParty(page);
  await page.waitForTimeout(800);
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
  await page.waitForTimeout(800);
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
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-skin-zip-failure-default-torika.png`);
});
