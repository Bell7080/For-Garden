/**
 * 홈페이지 이벤트 피드 — 로비 이벤트 정의(`src/data/lobbyEvents.ts`)와 정기 이벤트 교대
 * (`src/core/regularEventRotation.ts`)를 공개 JSON 한 장으로 굽는다.
 *
 * 홈페이지(For-Garden-Web `/api/events`)가 배포된 게임 주소의 `/site/events.json`을 읽으므로,
 * 게임을 배포하기만 하면 홈페이지 이벤트란이 그 내용으로 바뀐다 — 손으로 스냅샷을 옮기던 때는
 * 몇 버전씩 뒤처졌다. 공개해도 되는 것(이름·부제·기간·원화·SD 경로)만 싣는다.
 *
 * 사용: node scripts/build-site-events.mjs [--out 파일] [--root 게임 저장소]
 *   기본 출력은 `dist/site/events.json`(vite build 뒤에 부른다).
 */
import { build } from "esbuild";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const root = resolve(option("--root") ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const out = resolve(option("--out") ?? resolve(root, "dist/site/events.json"));
/** 홈페이지가 보여 주는 언어. 게임에 그 키가 없으면 한국어로 채운다. */
const LOCALES = ["ko", "en", "ja"];

const temp = await mkdtemp(resolve(tmpdir(), "fg-site-events-"));
try {
  const at = (p) => JSON.stringify(resolve(root, p));
  const entry = `import {LOBBY_EVENTS} from ${at("src/data/lobbyEvents.ts")};
import {REGULAR_EVENT_CYCLE, ROTATION_ANCHOR, WEEK_MS} from ${at("src/core/regularEventRotation.ts")};
import {BACKGROUND_ASSETS} from ${at("src/ui/backgroundAssets.ts")};
import {LOBBY_KO} from ${at("src/i18n/ko/lobby.ts")};
import {LOBBY_EN} from ${at("src/i18n/en/lobby.ts")};
import {LOBBY_JA} from ${at("src/i18n/ja/lobby.ts")};
import * as METADATA from ${at("src/puppets/assetMetadata.ts")};
export default {events: LOBBY_EVENTS, cycle: REGULAR_EVENT_CYCLE, anchor: ROTATION_ANCHOR, weekMs: WEEK_MS, assets: BACKGROUND_ASSETS, metadata: METADATA, text: {ko: LOBBY_KO, en: LOBBY_EN, ja: LOBBY_JA}};`;
  await build({
    stdin: { contents: entry, resolveDir: root, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: resolve(temp, "feed.mjs"),
    logLevel: "error",
  });
  const data = (await import(pathToFileURL(resolve(temp, "feed.mjs")).href)).default;
  const files = new Map(data.assets);
  // SD는 assets.ts의 아군 SD 표(relicId → X_SD_ASSET)와 그 ZIP·실측 경계를 따라간다. 그 파일은 Phaser 타입을
  // 끌어오므로 번들하지 않고 표만 읽는다.
  const source = await readFile(resolve(root, "src/puppets/assets.ts"), "utf8");
  const table = source.match(/const ALLY_SD_ASSETS[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  function sdOf(relicId) {
    const name = table.match(new RegExp(`^\\s*${relicId}:\\s*(\\w+),`, "m"))?.[1];
    const decl = name && source.match(new RegExp(`const ${name}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\};`));
    const zip = decl?.[1].match(/puppets\/([\w.-]+\.zip)/)?.[1];
    const meta = data.metadata[decl?.[1].match(/\.\.\.(\w+)/)?.[1]];
    if (!zip || !meta) throw new Error(`${relicId}: SD 에셋을 찾지 못했습니다.`);
    return {
      zip: `/puppets/${zip}`,
      width: meta.imageWidth,
      height: meta.imageHeight,
      bounds: [meta.content.left, meta.content.top, meta.content.right, meta.content.bottom],
    };
  }
  const events = data.events.map((e) => {
    const file = files.get(e.backdropKey);
    if (!file) throw new Error(`${e.id}: 배경 ${e.backdropKey} 파일을 찾지 못했습니다.`);
    const text = (key) => Object.fromEntries(LOCALES.map((l) => [l, data.text[l][key] ?? data.text.ko[key]]));
    return {
      id: e.id,
      title: text(e.titleKey),
      subtitle: text(e.subtitleKey),
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      weekly: Boolean(e.weekly),
      backdrop: `/${file}`,
      frame: e.backdropFrame ?? null,
      sd: e.sd ? { relicId: e.sd.relicId, side: e.sd.side, ...sdOf(e.sd.relicId) } : null,
      showcase: e.showcase ?? null,
      destination: e.destination?.kind ?? null,
    };
  });
  const version = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")).version;
  const feed = {
    schema: 1,
    version,
    // 주마다 한 이벤트만 서는 정기 이벤트 교대 — 홈페이지가 주 경계(UTC 월요일 00:00)를 직접 계산한다.
    rotation: { cycle: [...data.cycle], anchor: new Date(data.anchor).toISOString(), weekMs: data.weekMs },
    events,
  };
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(feed, null, 2) + "\n");
  console.log(`[site-events] 이벤트 ${events.length}개 → ${out}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
