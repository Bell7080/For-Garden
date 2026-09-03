// @ts-nocheck
import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
// 캔버스 입력은 한 곳이 소유한다 — 스펙마다 두면 느린 구현이 그대로 살아남는다.
import { captureGame, drag, longPress, tap } from "./canvasInput";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

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

/** 지도의 적 편성 팝업 첫 칸(왼쪽 적)의 한가운데. 팝업은 고른 노드 아래에 붙어 내려온다. */
const MAP_ENEMY_SLOT: [number, number] = [278, 1238];
/** 편성 미리보기에서 첫 적 옆에 붙는 `?` 뱃지. SD 자체는 입력을 받지 않는다. */
const PARTY_ENEMY_HELP: [number, number] = [366, 230];

const ROSTER = { startX: 116, startY: 1080, stepX: 212, stepY: 244, cols: 5 };
function card(index: number): [number, number] {
  return [
    ROSTER.startX + (index % ROSTER.cols) * ROSTER.stepX,
    ROSTER.startY + Math.floor(index / ROSTER.cols) * ROSTER.stepY,
  ];
}
const LEXIA = card(0);
const TORIKA = card(1);
const SEIRA = card(2);

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
async function enterParty(page: Page): Promise<void> {
  await startAfterOpening(page);

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); // 타이틀 → 로비
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, ...SORTIE); // 출격 버튼
  // 선택판은 SD를 읽어 오므로 열릴 때까지 기다린 뒤 누른다 — 열리기 전에 누르면 허공을 친다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  // 출격 선택판에서 스토리를 골라 기존 메인 작전 지도로 이어 간다.
  await tap(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도는 열려 있는 가장 뒤쪽 스테이지를 이미 골라 둔다. 출전만 누르면 편성으로 넘어간다.
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT - 180); // 출전
  await expect.poll(() => scene(page)).toBe("party");
}

/** 파티는 토리카 · 렉시아 · 스피나 순으로 고른다. */
async function enterBattle(page: Page): Promise<void> {
  await enterParty(page);
  // 준비 화면은 이제 직전 스토리 편성을 복원하므로 기본 세 명을 먼저 해제한 뒤 원하는 순서를 고른다.
  await tap(page, ...LEXIA);
  await tap(page, ...TORIKA);
  await tap(page, ...SEIRA);
  await tap(page, ...TORIKA);
  await tap(page, ...LEXIA);
  await tap(page, ...SEIRA);
  await tap(page, BASE_WIDTH / 2, 1700); // 전투 시작
  await expect.poll(() => scene(page)).toBe("battle");
}


test("dbg 겹 뱃지", async ({ page }) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterBattle(page);
  const SHOT = "/tmp/claude-0/-home-user-For-Garden/1f8b4d5b-fb69-5727-beeb-73950b288ecb/scratchpad";
  for (let i = 0; i < 6; i += 1) {
    await captureGame(page, `${SHOT}/stack_${i}.png`);
    if ((await scene(page)) !== "battle") break;
  }
});
