import type Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { DebugCommand } from "../core/debugCommand";
import type { Wallet } from "../core/gacha";
import { PLAYER_LEVEL_CAP } from "../core/playerLevel";
import { BREAKTHROUGH_GRADE_ROMAN, relicLevelCap, BREAKTHROUGH_CAP } from "../core/relicProgression";
import { BOND_LEVEL_CAP } from "../core/bond";
import { CHAPTERS } from "../data/stages";
import { PLAYABLE_RELICS } from "../data/relics";
import { t, type TextKey } from "../i18n";
import { session } from "../state/session";
import type { PopupLayer } from "./PopupLayer";
import { openChoicePicker } from "./SettingsPicker";

/** QA 디버그 창 — 설정에 흩어져 있던 개발용 버튼을 한 곳에 모으고 대상·값을 고르게 한다. */

interface Choice { readonly id: string; readonly label: string }

const PAGE_SIZE = 7;
const PREV = "__prev";
const NEXT = "__next";
const CURRENCY_KEYS: readonly (keyof Wallet)[] = ["fossil", "amber", "gems", "gold", "stamina", "cheesecake", "rawStone", "dnaFragments", "raidSigil", "salvageRecord", "duelEmblem"];
const AMOUNTS = [1, 10, 100, 1_000, 10_000, 100_000] as const;
const FILL = "fill";
const ZERO = "zero";
const ALL_OWNED = "owned";
const ALL_RELICS = "all";

interface Host { scene: Phaser.Scene; popups: PopupLayer }

/** 목록을 일곱 줄씩 끊어 넘겨 보며 하나 고른다 — 고르는 창은 줄 수만큼 길어지므로 화면을 넘지 않게 쪽으로 가른다. */
function pickFrom(host: Host, title: string, items: readonly Choice[], onPick: (id: string) => void, page = 0): void {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = items.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const rows: Choice[] = [...slice];
  if (current > 0) rows.push({ id: PREV, label: t("settings.debug.prevPage") });
  if (current < pages - 1) rows.push({ id: NEXT, label: t("settings.debug.nextPage") });
  const labels = new Map(rows.map((row) => [row.id, row.label]));
  openChoicePicker<string>(host.scene, host.popups, {
    title: pages > 1 ? `${title} ${current + 1}/${pages}` : title,
    value: "",
    choices: rows.map((row) => row.id),
    display: (id) => labels.get(id) ?? id,
    onPick: (id) => {
      if (id === PREV) host.scene.time.delayedCall(0, () => pickFrom(host, title, items, onPick, current - 1));
      else if (id === NEXT) host.scene.time.delayedCall(0, () => pickFrom(host, title, items, onPick, current + 1));
      else onPick(id);
    },
  });
}

async function run(host: Host, command: DebugCommand, doneKey: "count" | "relics" = "count"): Promise<void> {
  let message: string;
  try {
    const { changed } = await gameApi.applyDebugCommand(command);
    message = changed <= 0 ? t("settings.debug.nothing") : doneKey === "relics" ? t("settings.debug.grantedRelics", { count: changed }) : t("settings.debug.done", { count: changed });
  } catch {
    message = t("settings.debug.failed");
  }
  host.popups.confirm({ title: t("settings.debug.title"), message, confirmLabel: t("settings.action.confirm"), cancelLabel: false });
}

const levelChoices = (cap: number): Choice[] => [1, ...Array.from({ length: Math.floor(cap / 5) }, (_, i) => (i + 1) * 5)].map((level) => ({ id: String(level), label: t("settings.debug.level", { level }) }));

/** 대상 렐릭을 고른다. `allLabel`이 있으면 맨 위에 「모두」 줄이 선다. */
function pickRelic(host: Host, scope: "owned" | "new" | "any", allId: string | null, onPick: (id: string) => void): void {
  const pool = PLAYABLE_RELICS.filter((relic) => scope === "any" || (scope === "owned") === session.owned.has(relic.id));
  if (pool.length === 0) { host.popups.confirm({ title: t("settings.debug.title"), message: t(scope === "owned" ? "settings.debug.noOwned" : "settings.debug.noNew"), confirmLabel: t("settings.action.confirm"), cancelLabel: false }); return; }
  const items: Choice[] = pool.map((relic) => ({ id: relic.id, label: relic.name }));
  if (allId) items.unshift({ id: allId, label: t(scope === "new" ? "settings.debug.allRelics" : "settings.debug.allOwned") });
  const title: TextKey = scope === "owned" ? "settings.debug.pick.ownedRelic" : scope === "new" ? "settings.debug.pick.newRelic" : "settings.debug.pick.relic";
  pickFrom(host, t(title), items, onPick);
}

const MENU: readonly { id: string; labelKey: TextKey; open: (host: Host) => void }[] = [
  { id: "currency", labelKey: "settings.debug.menu.currency", open: (host) => pickFrom(host, t("settings.debug.pick.currency"), CURRENCY_KEYS.map((key) => ({ id: key, label: t(`settings.debug.currency.${key}` as TextKey) })), (key) => {
    const amounts: Choice[] = [...AMOUNTS.map((amount) => ({ id: String(amount), label: `+${amount.toLocaleString()}` })), { id: FILL, label: t("settings.debug.fill") }, { id: ZERO, label: t("settings.debug.zero") }];
    pickFrom(host, t("settings.debug.pick.amount"), amounts, (amount) => {
      const command: DebugCommand = amount === ZERO ? { kind: "currency", key: key as keyof Wallet, mode: "set", amount: 0 } : amount === FILL ? { kind: "currency", key: key as keyof Wallet, mode: "set", amount: Number.MAX_SAFE_INTEGER } : { kind: "currency", key: key as keyof Wallet, mode: "add", amount: Number(amount) };
      void run(host, command);
    });
  }) },
  { id: "playerLevel", labelKey: "settings.debug.menu.playerLevel", open: (host) => pickFrom(host, t("settings.debug.pick.level"), [...levelChoices(PLAYER_LEVEL_CAP)], (level) => void run(host, { kind: "playerLevel", level: Number(level) })) },
  { id: "chapters", labelKey: "settings.debug.menu.chapters", open: (host) => pickFrom(host, t("settings.debug.pick.chapter"), CHAPTERS.map((_, index) => ({ id: String(index + 1), label: t("settings.debug.chapter", { chapter: index + 1 }) })), (chapter) => void run(host, { kind: "clearChapters", through: Number(chapter) })) },
  { id: "grantRelic", labelKey: "settings.debug.menu.grantRelic", open: (host) => pickRelic(host, "new", ALL_RELICS, (id) => void run(host, { kind: "grantRelics", relicIds: id === ALL_RELICS ? "all" : [id] }, "relics")) },
  { id: "relicLevel", labelKey: "settings.debug.menu.relicLevel", open: (host) => pickRelic(host, "owned", ALL_OWNED, (id) => pickFrom(host, t("settings.debug.pick.level"), levelChoices(relicLevelCap(BREAKTHROUGH_CAP)), (level) => void run(host, { kind: "relicLevel", relicId: id, level: Number(level) }))) },
  { id: "relicBreakthrough", labelKey: "settings.debug.menu.relicBreakthrough", open: (host) => pickRelic(host, "owned", ALL_OWNED, (id) => pickFrom(host, t("settings.debug.pick.grade"), Array.from({ length: BREAKTHROUGH_CAP + 1 }, (_, grade) => ({ id: String(grade), label: t("settings.debug.grade", { grade: BREAKTHROUGH_GRADE_ROMAN[grade] }) })), (grade) => void run(host, { kind: "relicBreakthrough", relicId: id, breakthrough: Number(grade) }))) },
  { id: "relicBond", labelKey: "settings.debug.menu.relicBond", open: (host) => pickRelic(host, "owned", ALL_OWNED, (id) => pickFrom(host, t("settings.debug.pick.bond"), Array.from({ length: BOND_LEVEL_CAP + 1 }, (_, level) => ({ id: String(level), label: t("settings.debug.bond", { level }) })), (level) => void run(host, { kind: "relicBond", relicId: id, level: Number(level) }))) },
  { id: "relicFragments", labelKey: "settings.debug.menu.relicFragments", open: (host) => pickRelic(host, "owned", null, (id) => pickFrom(host, t("settings.debug.pick.amount"), [1, 5, 10, 50, 100, 500].map((amount) => ({ id: String(amount), label: `+${amount}` })), (amount) => void run(host, { kind: "relicFragments", relicId: id, amount: Number(amount) }))) },
  { id: "breakthroughSet", labelKey: "settings.debug.menu.breakthroughSet", open: (host) => pickRelic(host, "owned", null, (id) => void run(host, { kind: "breakthroughSet", relicId: id })) },
  { id: "unlockStories", labelKey: "settings.debug.menu.unlockStories", open: (host) => void run(host, { kind: "unlockStories" }) },
];

/** 설정의 「디버그 도구」가 여는 최상위 목록. QA 빌드(`QA_TOOLS_ENABLED`)에서만 부른다. */
export function openDebugToolsMenu(scene: Phaser.Scene, popups: PopupLayer): void {
  const host: Host = { scene, popups };
  pickFrom(host, t("settings.debug.title"), MENU.map((entry) => ({ id: entry.id, label: t(entry.labelKey) })), (id) => {
    // 목록 창이 닫히는 연출 뒤에 다음 창을 연다 — 같은 틱에 열면 갈아 끼우기로 읽혀 새 창이 즉시 닫힌다.
    scene.time.delayedCall(0, () => MENU.find((entry) => entry.id === id)?.open(host));
  });
}
