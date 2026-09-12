import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { setDebugRuneForgeRename, setDebugRuneNoteCraft } from "../debug";
import { canEngraveRune, canEnhanceRune, runePartLabel, runeRarityLabel, runeEnhancementAttempts, runeTotalEnhancementAttempts, type RuneInstance, type RuneStatKey } from "../core/runes";
import { runeEnhancementGoldCost } from "../data/runes";
import { RELICS } from "../data/relics";
import { InventoryManager } from "../managers/InventoryManager";
import { burstOverlayEffect } from "../managers/overlayEffects";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { drawGlyph } from "./glyphs";
import { drawHairline, drawLayer, slantedRect, toPoints } from "./holo";
import { PopupLayer, POPUP_TITLE_SIZE } from "./PopupLayer";
import { RUNE_CRAFT_MARKS, RUNE_CRAFT_PANEL, RUNE_NOTE_PANEL, runeCraftLayout, runeNoteLayout } from "./runeCraftLayout";
import { planRuneCraftTap, RUNE_CRAFT_IMPACT, RUNE_CRAFT_STRIKE, RUNE_MARK, type RuneCraftImpactKind } from "./runeCraftMotion";
import { addEmptyRuneMark, addRuneFrame, addRuneMark, RUNE_ACCENT, RuneChanceLine } from "./runeIcons";
import { addCurrencyChip } from "./CurrencyChip";
import { addMarkChip } from "./MarkChip";
import { formatCurrency } from "../core/formatCurrency";
import { COLOR, textStyle } from "./theme";

/**
 * 룬 옵션 키의 공용 표시명이다.
 *
 * 룬을 보여 주는 화면이 셋(가방·조각 요약·세공)이라 표가 갈라지기 쉽다. 갈라지면 어떤
 * 화면에서는 `ferocityGain` 같은 내부 키가 그대로 새어 나온다 — 그래서 한 표만 둔다.
 */
const RUNE_STAT_KEY: Readonly<Record<RuneStatKey, TextKey>> = {
  hp: "stat.hp", atk: "stat.atk", ap: "stat.ap", def: "stat.def", res: "stat.res", moveSpeed: "stat.moveSpeed",
  attackSpeed: "stat.attackSpeed", lifeSteal: "stat.lifeSteal", critChance: "stat.critChance", critDamage: "stat.critDamage",
  ferocityGain: "stat.ferocityGain.rune", energyGain: "stat.energyGain.rune",
};

/** 상수가 아니라 함수다 — 모듈이 읽히는 순간의 문구로 굳으면 언어를 바꿔도 그 자리만 옛 이름으로 남는다. */
export function runeStatLabel(key: RuneStatKey): string { return t(RUNE_STAT_KEY[key]); }

/** 쪽지의 옵션 줄에 붙는 각인 표식. 이름을 밀어내지 않을 만큼만 작다. */
const NOTE_ENGRAVE_MARK = { outer: 12, gap: 20 } as const;

export interface RunePopupOptions {
  runeInstanceId: string;
  onClose?: () => void;
  /** 테스트와 실제 HTTP 구현 교체를 위해 API 경계를 주입할 수 있다. */
  api?: GameApi;
  onChanged?: (rune: RuneInstance) => void;
}

/** 정보창에서 열었을 때만 주어지는 장착 대상. 없으면 정보 쪽지에 장착 버튼이 서지 않는다. */
export interface RuneEquipTarget {
  relicId: string;
  slotIndex: number;
  /** 장착이 끝난 뒤 목록·조각 표시를 다시 그리도록 알린다. */
  onEquipped?: () => void;
}

export interface RuneInfoPopupOptions extends RunePopupOptions {
  equip?: RuneEquipTarget;
}

/** 저장의 단일 장착표에서 이 룬이 어디에 끼워져 있는지 한 줄로 만든다. */
export function equippedLine(instanceId: string): string {
  const entry = Object.entries(session.relicProgress).find(([, progress]) => progress.heartGemSlots.includes(instanceId));
  if (!entry) return t("rune.notEquipped");
  return t("rune.equippedBy", { name: RELICS.find(({ id }) => id === entry[0])?.name ?? entry[0] });
}

/** 이 룬을 지금 끼고 있는 렐릭 이름. 아무도 끼지 않았으면 undefined다. */
export function equippedRelicName(instanceId: string): string | undefined {
  const slot = equippedRuneSlot(instanceId);
  return slot ? (RELICS.find(({ id }) => id === slot.relicId)?.name ?? slot.relicId) : undefined;
}

/**
 * 이 룬이 끼워져 있는 자리(렐릭과 칸 번호).
 *
 * 해제는 룬 ID가 아니라 **자리**로 보낸다(`unequipRune(relicId, slotIndex)`) — 저장의 장착표가
 * 렐릭별 칸 배열이라, 비울 칸을 지목해야 같은 조각을 두 곳에서 지우는 일이 생기지 않는다.
 */
export function equippedRuneSlot(instanceId: string): { relicId: string; slotIndex: number } | undefined {
  for (const [relicId, progress] of Object.entries(session.relicProgress)) {
    const slotIndex = progress.heartGemSlots.indexOf(instanceId);
    if (slotIndex >= 0) return { relicId, slotIndex };
  }
  return undefined;
}

/** 등급색을 텍스트 스타일이 받는 `#rrggbb` 문자열로 바꾼다. */
function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** 캔버스 위에 잠깐 놓는 이름 입력이다. 완료/취소 때 반드시 제거해 씬에 DOM 잔여물을 남기지 않는다. */
function requestRuneName(scene: Phaser.Scene, current: string, commit: (name: string) => Promise<void>): void {
  const input = document.createElement("input");
  input.value = current;
  input.maxLength = 16;
  input.placeholder = t("rune.namePlaceholder");
  input.setAttribute("aria-label", t("rune.nameTitle"));
  Object.assign(input.style, { position: "fixed", left: "50%", top: "19%", transform: "translateX(-50%)", width: "min(70vw, 520px)", padding: "14px", zIndex: "10000", background: "#0b0f15", color: "#f2f0ec", border: "1px solid #62d9ff", fontSize: "20px" });
  document.body.append(input);
  input.focus(); input.select();
  let done = false;
  const finish = async (save: boolean): Promise<void> => {
    if (done) return;
    done = true;
    input.remove();
    if (save && input.value.trim()) await commit(input.value);
  };
  input.addEventListener("keydown", (event) => { if (event.key === "Enter") void finish(true); if (event.key === "Escape") void finish(false); });
  input.addEventListener("blur", () => void finish(true));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => void finish(false));
}

/**
 * 쪽지 아래 버튼 줄의 자리.
 *
 * 세공(과 장착)이 줄의 주인이고 판매는 작게 오른쪽 끝에 선다. 폭과 x를 한 표에 두는 이유는,
 * 화면에서 눈대중으로 정하면 장착이 붙는 순간 세 판이 서로 겹치기 때문이다.
 */
const RUNE_NOTE_BUTTONS = {
  plain: { width: 300, craftX: -100, equipX: 0, sellX: 200 },
  withEquip: { width: 180, craftX: -180, equipX: 10, sellX: 210 },
  /**
   * 이미 끼워져 있는 룬의 줄. 세공과 해제 둘뿐이라 같은 폭으로 나란히 선다.
   *
   * 판매는 아예 서지 않는다 — 끼고 있는 룬은 서버가 판매를 거부하므로, 눌리지 않는 버튼을
   * 남겨 두면 "왜 안 되는가"를 창이 말하지 않은 채 자리만 차지한다. 그 자리에 지금 할 수
   * 있는 조작(해제)을 세운다.
   */
  equipped: { width: 220, craftX: -120, equipX: 120, sellX: 0 },
  sellWidth: 110,
  sellHeight: 60,
  /** 되돌릴 수 없는 조작 하나뿐인 색. 강조색(금)과 갈라 두어 실수로 눌리지 않게 한다. */
  sellAccent: 0xd9455a,
  sellText: "#ffc3cb",
} as const;

/** 잠금은 서늘한 강철빛, 즐겨찾기는 정보창 별과 같은 노랑이다. */
const MARK_ON = { locked: 0x9fd8ff, bookmarked: 0xf2c744 } as const;

/** 표식 칩 두 장을 다시 칠하는 손잡이. */
interface RuneMarkChips {
  paint(rune: RuneInstance): void;
}

/**
 * 잠금(자물쇠)과 즐겨찾기(별) 칩 두 장.
 *
 * 뒤집는 것은 화면이 아니라 서버다 — 자물쇠는 판매를 실제로 막는 값이라 표시와 거부가 같은
 * 한 곳에서 갈려야 한다. 응답이 온 뒤에만 칩을 다시 칠하므로, 실패한 요청이 켜진 채로
 * 남지 않는다.
 */
function addRuneMarkChips(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  y: number,
  instanceId: string,
  api: GameApi,
  onChanged: (rune: RuneInstance) => void,
): RuneMarkChips {
  const inventory = new InventoryManager(session);
  const chip = RUNE_NOTE_PANEL.chip;
  let current = session.runeInventory.find((rune) => rune.instanceId === instanceId);
  let pending = false;
  const chips: { key: "locked" | "bookmarked"; handle: ReturnType<typeof addMarkChip> }[] = [];
  const paint = (rune: RuneInstance): void => {
    current = rune;
    for (const { key, handle } of chips) handle.paint(rune[key] === true);
  };
  const toggle = (key: "locked" | "bookmarked"): void => {
    if (pending || !current) return;
    pending = true;
    void inventory.markRune(api, instanceId, { [key]: current[key] !== true })
      .then((rune) => { paint(rune); onChanged(rune); })
      .finally(() => { pending = false; });
  };
  chips.push({ key: "locked", handle: addMarkChip(scene, body, chip.x, y, { glyph: "lock", onColor: MARK_ON.locked, size: chip.size, onToggle: () => toggle("locked") }) });
  chips.push({ key: "bookmarked", handle: addMarkChip(scene, body, chip.x + chip.gap, y, { glyph: "bookmark", onColor: MARK_ON.bookmarked, size: chip.size, onToggle: () => toggle("bookmarked") }) });
  return { paint };
}

/**
 * 룬을 누르면 먼저 열리는 쪽지.
 *
 * 세공은 골드를 쓰고 결과가 되돌아오지 않는 조작이라, 룬을 눌렀다고 바로 그 화면을 열지
 * 않는다. 여기서는 무엇을 가진 룬인지만 읽고 — 옵션과 지금 어디에 끼워져 있는지 — 다음
 * 행동(세공·장착)은 손으로 한 번 더 고르게 한다.
 *
 * **누른 자리에 붙이지 않고 화면 가운데에 선다.** 옵션 다섯 줄과 버튼 줄을 담을 만큼 커진
 * 판을 조각 위에 붙이면 화면 가장자리로 밀려 판 밖 우하단 뒤로가기와 겹치고, 어디를 눌렀는지에
 * 따라 같은 창이 매번 다른 자리에서 열린다.
 */
export function openRuneInfoPopup(scene: Phaser.Scene, popups: PopupLayer, options: RuneInfoPopupOptions): void {
  const rune = session.runeInventory.find(({ instanceId }) => instanceId === options.runeInstanceId);
  if (!rune) return;
  const panel = RUNE_NOTE_PANEL;
  const accent = RUNE_ACCENT[rune.rarity];
  const rarity = runeRarityLabel(rune.rarity);
  const stats = [...rune.mainStats, ...rune.subStats];
  // 높이는 손으로 적지 않고 실제로 쌓인 옵션 줄에서 거꾸로 구한다 — 박아 두면 고급 룬은 아래가
  // 통째로 비고 전설 룬은 마지막 줄이 판을 넘는다.
  const layout = runeNoteLayout(stats.length);
  popups.open({ width: panel.width, height: layout.height, title: t("rune.title"), y: panel.centerY, dim: true, backButton: true, onClose: options.onClose }, (body, close) => {
    const top = -layout.height / 2;
    // 판매 버튼은 자물쇠 칩이 다시 칠할 대상이라 먼저 만들고, 자리는 아래 버튼 줄에서 정한다.
    const sell = new Button(scene, 0, 0, {
      width: RUNE_NOTE_BUTTONS.sellWidth, height: RUNE_NOTE_BUTTONS.sellHeight, label: t("rune.sell"), fontSize: 22,
      accentColor: RUNE_NOTE_BUTTONS.sellAccent, accentTextColor: RUNE_NOTE_BUTTONS.sellText,
      onClick: () => { void new InventoryManager(session).sellRunes(options.api ?? gameApi, [rune.instanceId]).then(() => close()); },
    });
    // 잠금과 즐겨찾기는 **머리글 아래 왼쪽 위**에 작은 칩 두 장으로 선다. 무엇을 가진
    // 룬인지 읽기 전에 "골라 둔 것인가"가 먼저 보이는 자리이고, 판매를 막는 자물쇠가
    // 판매 버튼 옆이 아니라 표식 자리에 있어야 실수로 함께 눌리지 않는다.
    const marks = addRuneMarkChips(scene, body, top + panel.chip.y, rune.instanceId, options.api ?? gameApi, (next) => {
      // 자물쇠가 걸린 동안에는 판매 자체를 막는다. 서버도 같은 이유로 거부한다.
      if (!equipped) sell.setEnabled(!next.locked);
      options.onChanged?.(next);
    });
    body.add(addRuneFrame(scene, panel.frame.x, top + panel.frame.y, panel.frame.size, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
    body.add(scene.add.text(panel.textX, top + panel.rarityY, rarity + "  ·  " + runePartLabel(rune.part), textStyle({ role: "emphasis", size: 20, color: hex(accent) })).setOrigin(0, 0));
    body.add(scene.add.text(panel.textX, top + panel.nameY, rune.customName ?? t("rune.named", { rarity }), textStyle({ role: "display", size: 29 })).setOrigin(0, 0).setWordWrapWidth(panel.nameWrap));
    body.add(scene.add.text(panel.textX, top + panel.equippedY, equippedLine(rune.instanceId), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
    body.add(drawHairline(scene, 0, top + panel.hairlineY, panel.hairlineWidth, { color: accent, alpha: 0.45 }));

    const statLeft = -panel.width / 2 + panel.statInset;
    stats.forEach((stat, index) => {
      const y = top + layout.statRows[index];
      const main = index < rune.mainStats.length;
      // 주 옵션은 강조, 보조는 본문이다. 역할은 조건식이 아니라 두 갈래로 명시해서 고른다.
      const nameStyle = main
        ? textStyle({ role: "emphasis", size: 24, color: COLOR.ink })
        : textStyle({ role: "body", size: 22, color: COLOR.inkDim });
      const name = scene.add.text(statLeft, y, runeStatLabel(stat.key), nameStyle).setOrigin(0, 0.5);
      body.add(name);
      // 각인한 옵션은 **이름 옆에서 바로** 읽혀야 한다. 어느 줄이 완성된 줄인지 알려고 세공
      // 화면을 다시 열게 하지 않는다. 표식은 세공 화면과 같은 다이아이고 크기만 작다.
      if (rune.engravings.some(({ statKey }) => statKey === stat.key)) {
        addRuneMark(scene, body, statLeft + name.width + NOTE_ENGRAVE_MARK.gap, y, NOTE_ENGRAVE_MARK.outer, "engrave");
      }
      body.add(scene.add.text(-statLeft, y, `+${stat.value}%`, textStyle({ role: "display", size: 24, color: main ? hex(accent) : COLOR.ink })).setOrigin(1, 0.5));
    });

    // 세공 진행은 숫자 하나로만 알린다. 자세한 결과 표식은 세공 화면이 맡는다.
    const attempts = runeEnhancementAttempts(rune);
    const total = runeTotalEnhancementAttempts(rune.rarity);
    const progress = rune.engravings.length > 0 ? t("rune.engraved") : t("rune.craftProgress", { done: attempts, total });
    body.add(scene.add.text(0, top + layout.progressY, progress, textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0));

    const buttonY = top + layout.buttonY;
    const equip = options.equip;
    const slot = equippedRuneSlot(rune.instanceId);
    const equipped = slot !== undefined;
    // 판매는 **되돌릴 수 없는 다른 성격의 조작**이라 세공·장착과 같은 크기로 나란히 세우지
    // 않는다. 셋을 같은 폭으로 두면 줄이 넘쳐 서로 겹쳤고, 무엇이 이 쪽지의 주 조작인지도
    // 읽히지 않았다. 판매만 작고 붉게 오른쪽 끝으로 물러난다.
    // 이미 끼워져 있는 룬은 그 줄 자체가 다르다 — 판매도 장착도 할 수 없으므로 세공과
    // 해제 둘만 나란히 선다.
    const main = equipped ? RUNE_NOTE_BUTTONS.equipped : equip ? RUNE_NOTE_BUTTONS.withEquip : RUNE_NOTE_BUTTONS.plain;
    const craft = new Button(scene, main.craftX, buttonY, {
      width: main.width, height: panel.buttonHeight, label: t("rune.craft"), fontSize: 26, variant: "primary", accentColor: accent,
      onClick: () => {
        close();
        openRunePopup(scene, popups, options);
      },
    });
    body.add(craft);
    // 줄 구성이 바뀌면 버튼도 함께 옮겨 가므로 자리를 화면이 알린다. 판이 제자리를 잡은 다음
    // 프레임에 재야 쪽지의 이동·기울임이 반영된 실제 좌표가 나온다.
    scene.time.delayedCall(0, () => {
      if (!craft.active) return;
      const bounds = craft.getBounds();
      setDebugRuneNoteCraft({ x: bounds.centerX, y: bounds.centerY });
    });
    craft.once(Phaser.GameObjects.Events.DESTROY, () => setDebugRuneNoteCraft(undefined));
    if (slot) {
      // 해제는 되돌릴 수 있는 조작이라 판매처럼 붉게 물러나지 않고 세공과 나란히 선다.
      body.add(new Button(scene, main.equipX, buttonY, {
        width: main.width, height: panel.buttonHeight, label: t("rune.unequip"), fontSize: 26,
        onClick: () => {
          void relicProgression.unequipRune(slot.relicId, slot.slotIndex).then(() => {
            close();
            // 장착과 같은 신호를 쓴다 — 부른 화면은 "끼웠다"가 아니라 "칸이 바뀌었다"를 듣는다.
            equip?.onEquipped?.();
            options.onChanged?.(rune);
          });
        },
      }));
    } else if (equip) {
      body.add(new Button(scene, main.equipX, buttonY, {
        width: main.width, height: panel.buttonHeight, label: t("rune.equip"), fontSize: 26,
        onClick: () => {
          void relicProgression.equipRune(equip.relicId, equip.slotIndex, rune.instanceId).then(() => {
            close();
            equip.onEquipped?.();
          });
        },
      }));
    }
    // 끼워져 있는 룬에는 판매 자리 자체를 두지 않는다.
    if (equipped) sell.destroy();
    else { body.add(sell.setPosition(main.sellX, buttonY)); sell.setEnabled(!rune.locked); }
    marks.paint(rune);
  });
}

/**
 * 다음으로 세공할 줄.
 *
 * 한 번 고른 줄은 **계속 고른 채로 남는다.** 세공은 한 줄에 세 번씩 반복하는 일이라, 누를
 * 때마다 다시 고르게 하면 같은 줄을 세 번 고르는 손이 그대로 낭비다. 그 줄이 다 차면 다음
 * 줄로 저절로 넘어가고, 다른 줄을 하고 싶으면 그때 눌러서 바꾼다.
 */
function nextCraftTarget(rune: RuneInstance, current?: RuneStatKey): RuneStatKey | undefined {
  const keys = [...rune.mainStats, ...rune.subStats].map(({ key }) => key);
  if (current && canEnhanceRune(rune, current)) return current;
  const start = current ? keys.indexOf(current) + 1 : 0;
  for (let step = 0; step < keys.length; step += 1) {
    const key = keys[(start + step) % keys.length];
    if (canEnhanceRune(rune, key)) return key;
  }
  return undefined;
}

/** 아직 비어 있는 칸 하나. 누른 순간의 예고가 어느 크기로 번질지 함께 들고 있는다. */
interface EmptySlot {
  mark: Phaser.GameObjects.Container;
  outer: number;
}

/**
 * 룬 세공(강화·각인) 화면.
 *
 * 위쪽 한 줄이 지금의 성공·실패 확률이고, 아래 각 옵션 줄에는 세공의 결과가 다이아로 박힌다 —
 * 성공은 푸른빛, 실패는 다크체리, 맨 뒤 빈 자리는 각인의 금빛 몫이다.
 *
 * **결과는 그려지는 것이 아니라 박히는 것이다.** 표식 하나가 크게 나타나 제 크기로 꽂히고
 * 그 자리에서 파편이 터지며, 확률 줄과 두 수치는 새 값으로 스르륵 흘러간다. 그리고 응답을
 * 기다리는 동안 누른 손도 세어 둔다(`planRuneCraftTap`) — 한 줄에 세 번씩 두드리는 일이라
 * 기다리는 동안의 입력을 버리면 연타가 한 번으로 줄어든다.
 */
export function openRunePopup(scene: Phaser.Scene, popups: PopupLayer, options: RunePopupOptions): void {
  const api = options.api ?? gameApi;
  // 룬을 바꾸는 모든 요청은 이 경계를 지나 Session 반영과 목록 갱신 신호를 함께 낸다.
  const inventory = new InventoryManager(session);
  let rune = session.runeInventory.find(({ instanceId }) => instanceId === options.runeInstanceId);
  if (!rune) return;
  const panel = RUNE_CRAFT_PANEL;
  const marks = RUNE_CRAFT_MARKS;
  const layout = runeCraftLayout({ mainCount: rune.mainStats.length, subCount: rune.subStats.length });
  let selected: RuneStatKey | undefined;
  let pending = false;
  /** 응답을 기다리는 동안 눌러 둔 세공 수. 각인은 절대 쌓이지 않는다. */
  let queued = 0;
  /** 확률 줄이 지금 보여 주고 있는 값. 판을 다시 그려도 이 값에서 이어 흘러간다. */
  let chanceShown = rune.currentSuccessChance;
  /** 방금 박힌 결과. 다시 그릴 때 그 표식 하나만 크게 나타났다가 앉는다. */
  let landed: { statKey: RuneStatKey; slot: number; kind: RuneCraftImpactKind } | undefined;
  popups.open({ width: panel.width, height: layout.height, title: t("rune.craftTitle"), y: panel.centerY, titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true, onClose: options.onClose }, (body) => {
    const content = scene.add.container(0, 0);
    body.add(content);
    /** 이번 그림에서 비어 있는 칸들. 누른 순간 그 자리에 예고를 번지게 한다. */
    const empties = new Map<string, EmptySlot>();

    /** 지금 이 순간 세공·각인 요청을 보낼 수 있는지. 대기열의 다음 한 번도 매번 다시 묻는다. */
    const craftable = (): boolean => {
      const current = rune!;
      if (!selected || current.engravings.length > 0) return false;
      if (current.enhancementComplete) return canEngraveRune(current);
      if (!canEnhanceRune(current, selected)) return false;
      return session.wallet.gold >= runeEnhancementGoldCost(current.rarity, runeEnhancementAttempts(current));
    };

    /**
     * 결과 하나를 제자리에 박는다.
     *
     * 파편은 판 **위**에서 터진다(`burstOverlayEffect`) — 판 안에서 터뜨리면 깊이 2000대의
     * 판 층에 묻힌다. 자리는 표식의 실제 월드 좌표라 판을 옮겨도 따라간다.
     */
    const land = (mark: Phaser.GameObjects.Container, kind: RuneCraftImpactKind): void => {
      const spec = RUNE_CRAFT_IMPACT[kind];
      const at = mark.getWorldTransformMatrix();
      burstOverlayEffect(spec.effect, at.tx, at.ty, RUNE_MARK[kind].halo);
      const restY = mark.y;
      mark.setScale(spec.fromScale).setY(restY + spec.fromY);
      scene.tweens.add({ targets: mark, scale: 1, y: restY, duration: spec.settleMs, ease: spec.ease });
      if (spec.kickPx <= 0) return;
      // 각인만 판을 한 번 때린다. 세공까지 흔들면 연타 내내 판이 떨려 마지막 한 번이 묻힌다.
      scene.tweens.add({ targets: content, x: spec.kickPx, duration: 60, yoyo: true, repeat: 1, ease: "Sine.InOut", onComplete: () => content.setX(0) });
    };

    /**
     * 누른 순간 목표 칸에서 한 번 번지는 예고.
     *
     * 서버가 답하기까지 한 박자가 비어, 그동안 아무 일도 없으면 연타가 먹지 않은 것처럼 보인다.
     * 결과 색을 미리 말할 수 없으므로 흰빛으로 "때렸다"까지만 알린다. 이미 날아간 요청과 눌러
     * 둔 수만큼 칸을 건너뛰어, 두 번 누르면 두 칸이 차례로 번진다.
     */
    const strike = (statKey: RuneStatKey, inFlight: number): void => {
      const done = rune!.enhancementHistory[statKey]?.length ?? 0;
      const slot = empties.get(`${statKey}:${done + inFlight}`);
      if (!slot) return;
      const flash = scene.add
        .star(0, 0, 4, slot.outer * 0.34, slot.outer, RUNE_CRAFT_STRIKE.color, RUNE_CRAFT_STRIKE.alpha)
        .setBlendMode(Phaser.BlendModes.ADD);
      slot.mark.add(flash);
      scene.tweens.add({ targets: flash, scale: RUNE_CRAFT_STRIKE.scale, alpha: 0, duration: RUNE_CRAFT_STRIKE.ms, ease: "Quad.Out", onComplete: () => flash.destroy() });
    };

    /** 요청 한 번. 끝나면 눌러 둔 만큼 이어서 보낸다. */
    const craft = async (): Promise<void> => {
      const statKey = selected;
      if (!statKey || !craftable()) { queued = 0; return; }
      const engraving = rune!.enhancementComplete;
      pending = true;
      try {
        // 세공·각인은 반드시 manager를 지난다 — 그래야 가방 목록도 같은 순간에 다시 그려진다.
        const response = engraving
          ? await inventory.engraveRune(api, rune!.instanceId, statKey)
          : await inventory.enhanceRune(api, rune!.instanceId, statKey);
        rune = response.rune;
        options.onChanged?.(rune);
        const succeeded = "succeeded" in response && response.succeeded;
        landed = engraving
          ? { statKey, slot: -1, kind: "engrave" }
          : { statKey, slot: (rune.enhancementHistory[statKey]?.length ?? 1) - 1, kind: succeeded ? "success" : "fail" };
        // 세공은 고른 줄을 그대로 이어 간다. 그 줄이 다 차면 다음 줄로 넘어가고, 모든
        // 세공이 끝나 각인만 남으면 손을 뗀다 — 각인은 되돌릴 수 없는 한 번의 선택이라
        // 무엇에 새길지는 반드시 사람이 다시 고른다.
        selected = rune.enhancementComplete ? undefined : nextCraftTarget(rune, statKey);
        pending = false;
        render(engraving ? t("rune.completed") : succeeded ? t("rune.craftSuccess") : t("rune.craftFail"));
      } catch (error) {
        pending = false;
        queued = 0;
        render(error instanceof Error ? error.message : t("rune.requestFailed"));
        return;
      }
      if (queued <= 0) return;
      queued -= 1;
      if (craftable()) void craft();
      else queued = 0;
    };

    /** 버튼을 누른 한 번. 곧바로 보내거나, 기다리는 중이면 쌓아 둔다. */
    const press = (): void => {
      if (!selected) return;
      const plan = planRuneCraftTap({ pending, queued, repeatable: !rune!.enhancementComplete });
      if (plan === "drop") return;
      const inFlight = (pending ? 1 : 0) + queued;
      if (plan === "queue") { queued += 1; strike(selected, inFlight); return; }
      if (!craftable()) return;
      if (!rune!.enhancementComplete) strike(selected, inFlight);
      void craft();
    };

    const render = (notice = ""): void => {
      content.removeAll(true);
      content.setX(0);
      empties.clear();
      const current = rune!;
      const accent = RUNE_ACCENT[current.rarity];
      const rarity = runeRarityLabel(current.rarity);
      const displayName = current.customName ?? t("rune.named", { rarity });
      const top = -layout.height / 2;
      const half = panel.width / 2;
      content.add(addRuneFrame(scene, panel.frame.x, top + panel.frame.y, panel.frame.size, current.rarity, current.part, { mainStats: current.mainStats, engraved: current.engravings.length > 0 }));
      content.add(scene.add.text(panel.textX, top + panel.rarityY, rarity + "  ·  " + runePartLabel(current.part), textStyle({ role: "emphasis", size: 21, color: hex(accent) })).setOrigin(0, 0));
      const nameText = scene.add.text(panel.textX, top + panel.nameY, displayName, textStyle({ role: "display", size: 32 })).setOrigin(0, 0).setWordWrapWidth(panel.nameWrap);
      content.add(nameText);
      content.add(scene.add.text(panel.textX, top + panel.equippedY, equippedLine(current.instanceId), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
      // 보유 골드는 로비 상단과 같은 칸으로 세운다. 세공은 골드를 쓰는 화면이라 지갑이 늘
      // 보여야 하고, 같은 값이 화면마다 다른 모양으로 보이지 않게 한다.
      addCurrencyChip(scene, panel.wallet.x, top + panel.wallet.y, "currency-gold", {
        width: panel.wallet.width,
        height: panel.wallet.height,
        color: "#ffdf9a",
        parent: content,
      }).setText(formatCurrency(session.wallet.gold));
      // 연필은 씬에서 직접 작도하지 않고 glyph 공용 시스템의 edit 표식을 쓴다. 이름 바로
      // 옆에 서야 무엇을 고치는 단추인지 읽힌다 — 오른쪽 끝에 두면 그 아래 확률 글자와 겹친다.
      const pencilX = Math.min(panel.textX + nameText.width + 32, half - 264);
      const pencilY = top + panel.nameY + 16;
      content.add(drawGlyph(scene, "edit", pencilX, pencilY, 34, accent));
      const renameHit = scene.add.rectangle(pencilX, pencilY, 78, 78, 0xffffff, 0).setInteractive({ useHandCursor: true });
      // 연필은 이름 글자 폭만큼 밀려 서므로 자리를 화면이 알린다 — 스펙이 좌표를 적어 두면
      // 이름이 바뀌는 순간 조용히 빗나간다(보상 팝업의 확인 버튼과 같은 방식이다). 판이 제자리를
      // 잡은 다음 프레임에 재야 컨테이너 이동·기울임이 모두 반영된 실제 화면 좌표가 나온다.
      scene.time.delayedCall(0, () => {
        if (!renameHit.active) return;
        const bounds = renameHit.getBounds();
        setDebugRuneForgeRename({ x: bounds.centerX, y: bounds.centerY });
      });
      renameHit.once(Phaser.GameObjects.Events.DESTROY, () => setDebugRuneForgeRename(undefined));
      renameHit.on("pointerup", () => requestRuneName(scene, rune!.customName ?? "", async (value) => {
        if (pending) return; pending = true;
        try {
          const response = await inventory.renameRune(api, rune!.instanceId, value);
          rune = response.rune; options.onChanged?.(rune);
          pending = false;
          render(t("rune.nameSaved"));
        } catch (error) { pending = false; throw error; }
      }));
      content.add(renameHit);

      // 확률 줄 — 한 줄을 성공과 실패가 나눠 가지고, 그 위의 두 수치가 같은 값을 함께 읽는다.
      // 결과가 막 박힌 그림에서만 흘러간다. 줄을 고르느라 다시 그릴 때도 흘리면 아무 일도
      // 없었는데 게이지가 움직인다.
      const completed = current.enhancementComplete;
      if (!completed) {
        const line = new RuneChanceLine(scene, content, 0, top + panel.chanceBarY, layout.rowWidth, {
          labelSize: panel.chanceLabelSize,
          labelBaselineY: panel.chanceBarY - panel.chanceLabelY,
          labelInset: panel.chanceLabelInset,
          from: chanceShown,
          onRoll: (shown) => { chanceShown = shown; },
        });
        line.rollTo(current.currentSuccessChance, landed !== undefined);
      } else {
        const done = current.engravings.length > 0 ? t("rune.allCrafted") : t("rune.engraveNext");
        content.add(scene.add.text(0, top + panel.chanceBarY - 12, done, textStyle({ role: "emphasis", size: 25, color: hex(accent) })).setOrigin(0.5, 0.5));
      }

      /**
       * 옵션 한 줄.
       *
       * 주 옵션과 보조 옵션은 판을 나눠 얹는다. 한 판에 다섯 줄을 같은 크기로 늘어놓으면
       * 무엇이 이 룬의 중심인지 읽히지 않는다 — 주 옵션은 크고 두껍게, 보조는 지금 크기로 둔다.
       */
      const drawRow = (stat: { key: RuneStatKey; value: number }, y: number, height: number, main: boolean): void => {
        const usable = completed ? canEngraveRune(current) : canEnhanceRune(current, stat.key);
        const chosen = selected === stat.key;
        const width = layout.rowWidth;
        content.add(drawLayer(scene, 0, y, slantedRect(width, height, 12), {
          fill: chosen ? 0x223243 : main ? 0x121a23 : 0x0e141b,
          alpha: 0.98,
          edge: accent,
          edgeAlpha: chosen ? 1 : main ? 0.4 : 0.16,
          edgeWidth: chosen ? 4 : undefined,
          glow: chosen ? { color: accent, strength: 0.55, height: 0.8 } : undefined,
        }));
        // 고른 줄은 왼쪽에 빗금 하나를 더 세운다. 색만 밝히면 판이 여럿일 때 어느 줄이
        // 골라진 것인지 한눈에 잡히지 않는다.
        if (chosen) {
          const bar = scene.add.graphics();
          bar.fillStyle(accent, 1);
          bar.fillPoints(toPoints(slantedRect(10, height - 18, 6)).map((point) => new Phaser.Geom.Point(point.x - width / 2 + 14, point.y + y)), true);
          content.add(bar);
        }
        const labelStyle = main
          ? textStyle({ role: "display", size: 29, color: chosen ? COLOR.accentText : COLOR.ink })
          : textStyle({ role: "emphasis", size: 23, color: chosen ? COLOR.accentText : COLOR.inkDim });
        content.add(scene.add.text(-width / 2 + (chosen ? 36 : 24), y, `${runeStatLabel(stat.key)}  +${stat.value}%`, labelStyle).setOrigin(0, 0.5).setWordWrapWidth(marks.labelWrap));
        const history = current.enhancementHistory[stat.key] ?? [];
        const outer = main ? marks.mainOuter : marks.subOuter;
        for (let slot = 0; slot < 3; slot += 1) {
          const result = history[slot];
          const x = marks.firstX + slot * marks.step;
          if (!result) {
            empties.set(`${stat.key}:${slot}`, { mark: addEmptyRuneMark(scene, content, x, y, outer), outer });
            continue;
          }
          const kind: RuneCraftImpactKind = result.succeeded ? "success" : "fail";
          const mark = addRuneMark(scene, content, x, y, outer, kind);
          if (landed && landed.statKey === stat.key && landed.slot === slot) land(mark, kind);
        }
        // 각인 자리는 세 칸 뒤의 빈 공간이다. 각인된 옵션에만 금빛 다이아가 박힌다.
        const engraving = current.engravings.find(({ statKey }) => statKey === stat.key);
        if (engraving) {
          const mark = addRuneMark(scene, content, marks.engraveX, y, marks.engraveOuter, "engrave");
          if (landed && landed.statKey === stat.key && landed.slot === -1) land(mark, "engrave");
        }
        const hit = scene.add.rectangle(0, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: usable });
        hit.on("pointerup", () => { if (!pending && usable) { selected = stat.key; render(); } });
        content.add(hit);
      };

      content.add(scene.add.text(-half + 44, top + panel.mainLabelY, t("rune.mainOption"), textStyle({ role: "emphasis", size: 21, color: hex(accent) })).setOrigin(0, 0.5));
      current.mainStats.forEach((stat, index) => drawRow(stat, top + layout.mainRows[index], panel.mainRow.height, true));
      content.add(scene.add.text(-half + 44, top + layout.subLabelY, t("rune.subOption"), textStyle({ role: "emphasis", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));
      if (current.subStats.length === 0) {
        content.add(scene.add.text(0, top + layout.emptySubY, t("rune.noSubOption"), textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0.5, 0.5));
      }
      current.subStats.forEach((stat, index) => drawRow(stat, top + layout.subRows[index], panel.subRow.height, false));

      content.add(drawHairline(scene, 0, top + layout.hairlineY, layout.rowWidth, { color: accent, alpha: 0.4 }));
      const engraved = current.engravings.length > 0;
      const cost = completed ? 0 : runeEnhancementGoldCost(current.rarity, runeEnhancementAttempts(current));
      const affordable = completed || session.wallet.gold >= cost;
      const reason = engraved
        ? t("rune.allCrafted")
        : completed
          ? (selected ? t("rune.engraveReady") : t("rune.engravePick"))
          : selected ? t("rune.chanceNote") : t("rune.craftPick");
      // 방금 무슨 일이 있었는지는 버튼 바로 위에 크게 박는다. 손이 머무는 자리에서 결과가
      // 나오지 않으면 확률만 바뀐 채 무엇이 성공이었는지 되짚어야 한다.
      const resultStyle = notice.includes(t("rune.success"))
        ? textStyle({ role: "display", size: 32, color: hex(RUNE_MARK.success.halo) })
        : notice.includes(t("rune.fail"))
          ? textStyle({ role: "display", size: 32, color: hex(RUNE_MARK.fail.glow) })
          : notice
            ? textStyle({ role: "display", size: 32, color: hex(accent) })
            : textStyle({ role: "body", size: 21, color: COLOR.inkDim });
      content.add(scene.add.text(0, top + layout.noticeY, notice || reason, resultStyle).setOrigin(0.5, 0));
      // 비용은 안내문이 아니라 **누르는 것 위**에 박는다. 재화 이름은 글자 대신 아이콘이다.
      // **기다리는 동안에도 꺼지지 않는다** — 눌린 버튼이 흐려지면 연타가 막히고, 실제로
      // 보낼 수 있는지는 `craftable()`이 요청 직전에 다시 묻는다.
      const action = new Button(scene, 0, top + layout.buttonY, {
        width: panel.button.width, height: panel.button.height,
        label: completed ? t("rune.engraveConfirm") : t("rune.craft"), variant: "primary", accentColor: accent,
        cost: completed ? undefined : { icon: "currency-gold", amount: cost, affordable },
        onClick: press,
      }).setEnabled(!!selected && !engraved && affordable);
      content.add(action);
      // 박힘은 이 그림에서만 한 번 일어난다. 지우지 않으면 줄을 고를 때마다 같은 표식이 다시 꽂힌다.
      landed = undefined;
    };
    render();
  });
}
