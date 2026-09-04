import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
const save = readFileSync("/tmp/claude-0/-home-user-For-Garden/1f8b4d5b-fb69-5727-beeb-73950b288ecb/scratchpad/save.json", "utf8");
await p.addInitScript((v) => window.localStorage.setItem("eternal-city.local-save", v), save);
await p.goto("http://localhost:4173/");
await p.waitForFunction(() => window.__PF_DEBUG?.ready === true, null, { timeout: 90000 });
const box = async () => p.evaluate(() => { const c = document.querySelector("canvas"); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const tap = async (gx, gy) => { const r = await box(); await p.mouse.click(r.x + (gx / 1080) * r.w, r.y + (gy / 1920) * r.h); await p.waitForTimeout(150); };
await tap(540, 960);
await p.waitForFunction(() => window.__PF_DEBUG?.scene === "lobby", null, { timeout: 60000 });
await tap(1080 - 290, 1920 - 180 - 245);
await p.waitForFunction(() => (window.__PF_DEBUG?.popupTitles ?? []).includes("출격"), null, { timeout: 60000 });
await tap(540, 550);
await p.waitForFunction(() => window.__PF_DEBUG?.scene === "stageMap", null, { timeout: 60000 });
await tap(540, 1920 - 180);
await p.waitForFunction(() => window.__PF_DEBUG?.scene === "party", null, { timeout: 60000 });
const R = { startX: 116, startY: 1080, stepX: 212, stepY: 244, cols: 5 };
const card = (i) => [R.startX + (i % R.cols) * R.stepX, R.startY + Math.floor(i / R.cols) * R.stepY];
const t0 = Date.now();
await tap(540, 1700);
await p.waitForFunction(() => window.__PF_DEBUG?.scene === "battle", null, { timeout: 60000 });
console.log("enterBattle done at", Date.now() - t0, "ms into battle step");
const panel = () => p.evaluate(() => window.__PF_DEBUG?.battle?.contributionPanel);
await tap(68, 960);
for (let i = 0; i < 10; i++) { const v = await panel(); if (v?.expanded) break; await p.waitForTimeout(300); }
console.log("expanded", JSON.stringify(await panel()));
for (const [x, want] of [[234, "defense"], [318, "healing"], [150, "attack"]]) {
  await tap(x, 620);
  for (let i = 0; i < 12; i++) { const v = await panel(); if (v?.category === want) break; await p.waitForTimeout(250); }
  console.log(want, JSON.stringify(await panel()));
}
const shotStart = Date.now();
await p.screenshot({ path: "/tmp/claude-0/-home-user-For-Garden/1f8b4d5b-fb69-5727-beeb-73950b288ecb/scratchpad/contrib.png", scale: "css" });
console.log("screenshot ms", Date.now() - shotStart);
await tap(800, 400);
for (let i = 0; i < 12; i++) { const v = await panel(); if (v && !v.expanded) break; await p.waitForTimeout(250); }
console.log("collapsed", JSON.stringify(await panel()));
await b.close();
