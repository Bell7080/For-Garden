import { expect, test, type Page } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";
import { LOBBY_EVENTS } from "../../src/data/lobbyEvents";
import { GUILD_PAGES } from "../../src/core/guildPages";

/**
 * 모든 화면을 한 번씩 세워 보는 순회 검사.
 *
 * 기능 스펙은 화면마다 정해진 조작을 깊게 보지만, 그 사이에 **아무 스펙도 들어가지 않는 화면**이 생긴다 —
 * 고대 지층·현상수배·대작전·이벤트 다섯·길드 세 판·상점 자리들이 그랬다. 여기서는 조작을 흉내 내지 않고
 * 실제 Phaser 씬을 진입 데이터와 함께 곧바로 세운 뒤, ① 그 화면의 디버그 이름이 서는지, ② 진입 중 잡히지 않은
 * 예외(`pageerror`)가 없는지, ③ 한 장을 캡처로 남긴다. 화면이 들어서다 죽는 회귀를 넓게 잡는 그물이다.
 */
interface Visit { key: string; data?: Record<string, unknown>; debug?: string; label: string }

async function visit(page: Page, target: Visit, errors: string[]): Promise<void> {
  const before = errors.length;
  const from = await page.evaluate(() => window.__PF_DEBUG?.scene ?? "lobby");
  // 지금 선 씬에서 다음 씬을 연다 — Phaser의 scene.start가 지금 씬을 멈추고 새 씬을 세운다.
  await sourceScene(page, `const g=this.game;const from=g.scene.getScene(${JSON.stringify(from)})??g.scene.getScenes(true)[0];from.scene.start(${JSON.stringify(target.key)},${JSON.stringify(target.data ?? {})});`);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 20_000, message: target.label }).toBe(target.debug ?? target.key);
  // 들어오는 연출과 비동기 원화가 자리를 잡을 짧은 틈. 이 사이의 예외도 그 화면의 몫으로 센다.
  await page.waitForTimeout(1_500);
  await captureGame(page, test.info().outputPath(`${target.label}.png`));
  expect(errors.slice(before), `${target.label} 진입 중 예외`).toEqual([]);
}

async function walk(page: Page, visits: readonly Visit[]): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installGameHandleProbe(page);
  await startAfterOpening(page, (session) => {
    session.settings.game.language = "ko";
    // 스테이지 클리어로 열리는 콘텐츠(연구소 1-5 · 고고학 1-10 · 고대 지층 4-10)도 열린 채로 본다.
    for (const stage of ["1-5", "1-10", "4-10"]) session.cleared.add(stage);
  });
  for (const target of visits) await visit(page, target, errors);
}

test.describe("화면 순회", () => {
  test.describe.configure({ timeout: 360_000 });

  test("하단 탭·로비 곁 화면", async ({ page }) => {
    await walk(page, [
      { key: "lobby", label: "lobby" },
      { key: "archaeology", label: "archaeology" },
      { key: "relics", label: "relics" },
      { key: "lab", label: "lab" },
      { key: "premium", label: "premium" },
      { key: "interaction", label: "interaction" },
      { key: "friends", label: "friends" },
      { key: "settings", label: "settings" },
    ]);
  });

  test("출격 콘텐츠 — 스토리·원정·레이드·고대 지층·던전", async ({ page }) => {
    await walk(page, [
      { key: "stageMap", label: "stageMap" },
      { key: "expedition", label: "expedition" },
      { key: "raid", label: "raid" },
      { key: "ancientStrata", label: "ancientStrata" },
      { key: "bounty", label: "bounty" },
      { key: "cakeOperation", label: "cakeOperation" },
      { key: "sortiePreview", data: { mode: "cake" }, label: "sortiePreview-cake" },
      { key: "sortiePreview", data: { mode: "bounty" }, label: "sortiePreview-bounty" },
      { key: "sortiePreview", data: { mode: "raid" }, label: "sortiePreview-raid" },
    ]);
  });

  test("경쟁 — 결투장·아레나·PvP 안내", async ({ page }) => {
    await walk(page, [
      { key: "duel", label: "duel" },
      { key: "duel", data: { openOpponents: true }, label: "duel-opponents" },
      { key: "arena", label: "arena" },
      ...(["arena", "boss-duel", "brawl", "training", "live-arena"] as const).map((mode) => ({ key: "pvpPreview", data: { mode }, label: `pvpPreview-${mode}` })),
    ]);
  });

  test("상점 자리 전부", async ({ page }) => {
    await walk(page, [
      ...(["shop", "archaeology", "loot", "mileage", "duel"] as const).map((storefront) => ({ key: "shop", data: { storefront }, label: `shop-${storefront}` })),
      // 길드에 들지 않은 채 길드 상점에 닿으면 잡히지 않은 거절로 멈추지 않고 길드 화면(가입 목록)으로 간다.
      { key: "shop", data: { storefront: "guild" }, debug: "guild", label: "shop-guild-not-member" },
    ]);
  });

  test("로비 이벤트 전부", async ({ page }) => {
    await walk(page, LOBBY_EVENTS.map((event) => ({ key: "event", data: { eventId: event.id }, label: `event-${event.id}` })));
  });

  test("길드 세 판", async ({ page }) => {
    await walk(page, GUILD_PAGES.map((guildPage) => ({ key: "guild", data: { page: guildPage }, label: `guild-${guildPage}` })));
  });
});
