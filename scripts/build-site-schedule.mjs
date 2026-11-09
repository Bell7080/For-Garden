/**
 * 운영 일정 목록 — 어드민 「운영 일정」 화면이 고를 수 있는 배너·상품·이벤트 ID와 정의에 적힌 기본 기간을 공개 JSON 한 장으로 굽는다.
 *
 * 일정 표(`live_schedule`)는 기간만 덮고 무엇을 파는지는 게임 정의가 갖는다. 어드민이 ID를 손으로 적으면 오타 하나가 아무것도
 * 덮지 못한 채 조용히 남으므로, 배포된 게임 주소의 `/site/schedule.json`을 읽어 고르게 한다. 공개해도 되는 것(ID·한국어 이름·
 * 정의 기간)만 싣는다 — 이 기간은 이미 게임 화면에 서는 값이다.
 *
 * 사용: node scripts/build-site-schedule.mjs [--out 파일] [--root 게임 저장소]
 *   기본 출력은 `dist/site/schedule.json`(vite build 뒤에 부른다).
 */
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const root = resolve(option("--root") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const out = resolve(option("--out") ?? resolve(root, "dist/site/schedule.json"));

const temp = await mkdtemp(resolve(tmpdir(), "fg-site-schedule-"));
try {
  const at = (p) => JSON.stringify(resolve(root, p));
  const entry = `import {BANNERS} from ${at("src/data/banners.ts")};
import {PRODUCTS} from ${at("src/data/shopCatalog.ts")};
import {EVENTS} from ${at("src/data/events/index.ts")};
import {LOBBY_EVENTS} from ${at("src/data/lobbyEvents.ts")};
import {LOBBY_KO} from ${at("src/i18n/ko/lobby.ts")};
export default {banners: BANNERS, products: PRODUCTS, events: EVENTS, lobby: LOBBY_EVENTS, lobbyText: LOBBY_KO};`;
  await build({
    stdin: { contents: entry, resolveDir: root, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: resolve(temp, "schedule.mjs"),
    logLevel: "error",
    // 데이터 정의만 읽는다 — 화면 모듈이 끼어들면 Phaser를 찾다가 멈춘다.
    external: ["phaser"],
  });
  const data = (await import(pathToFileURL(resolve(temp, "schedule.mjs")).href)).default;
  const row = (kind, id, name, startsAt, endsAt, extra = {}) => ({ kind, id, name, startsAt: startsAt ?? null, endsAt: endsAt ?? null, ...extra });
  const items = [
    ...data.banners.map((b) => row("banner", b.id, b.name, b.startsAt, b.endsAt)),
    ...data.products.map((p) => row("product", p.id, p.name, p.visibleFrom, p.visibleUntil, { storefront: p.storefront, ...(p.bannerId ? { bannerId: p.bannerId } : {}) })),
    ...data.events.map((e) => row("event", e.id, e.name ?? e.id, e.startsAt, e.endsAt)),
    ...data.lobby.map((e) => row("lobby", e.id, data.lobbyText[e.titleKey] ?? e.id, e.startsAt, e.endsAt, e.destination?.kind === "lab" ? { bannerId: e.destination.bannerId } : {})),
  ];
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), items }, null, 1) + "\n");
  console.log(`운영 일정 목록: ${items.length}개 → ${out}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
