import Phaser from "phaser";
import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { setDebugRuneForgeRename, setDebugRuneNoteCraft } from "../debug";
import { canEngraveRune, canEnhanceRune, RUNE_PART_LABELS, RUNE_RARITY_LABELS, runeEnhancementAttempts, runeTotalEnhancementAttempts, type RuneInstance, type RuneStatKey } from "../core/runes";
import { runeEnhancementGoldCost } from "../data/runes";
import { RELICS } from "../data/relics";
import { InventoryManager } from "../managers/InventoryManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { drawGlyph } from "./glyphs";
import { drawHairline, drawLayer, slantedRect, toPoints } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { addChanceLine, addEmptyRuneMark, addRuneFrame, addRuneMark, RUNE_ACCENT, RUNE_MARK } from "./runeIcons";
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
export const RUNE_STAT_LABEL: Readonly<Record<RuneStatKey, string>> = {
  hp: "체력", atk: "공격력", ap: "주문력", def: "방어력", res: "저항력", moveSpeed: "이동 속도",
  attackSpeed: "공격 속도", lifeSteal: "피해 흡혈", critChance: "치명타 확률", critDamage: "치명타 피해",
  ferocityGain: "야성 획득 증가", energyGain: "궁극기 충전량 증가",
};

/** 쪽지의 옵션 줄에 붙는 각인 표식. 이름을 밀어내지 않을 만큼만 작다. */
const NOTE_ENGRAVE_MARK = { outer: 10, gap: 16 } as const;

/** 세공 표식의 크기. 각인도 같은 다이아라 크기를 거의 맞추고 색으로만 갈린다. */
const MARK = { outer: 17, engrave: 18, step: 52, firstX: 110, engraveX: 286 } as const;

/**
 * 세공 화면의 크기와 자리.
 *
 * 화면 한가운데에 뜬다. 조각을 누른 자리에 붙이면 팝업이 화면 아래쪽으로 쏠려 위쪽 절반이
 * 통째로 빈다 — 세공은 쪽지가 아니라 한동안 머무는 작업 화면이다.
 */
const CRAFT = { width: 740, height: 980, x: 540, y: 940 } as const;

export interface RunePopupOptions {
  runeInstanceId: string;
  /** 누른 조각/목록 칸의 화면 좌표다. PopupLayer가 화면 안으로 밀어 넣는다. */
  anchor?: { x: number; y: number };
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
  if (!entry) return "장착 안 함";
  return `장착 중 · ${RELICS.find(({ id }) => id === entry[0])?.name ?? entry[0]}`;
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
  input.placeholder = "룬 이름 (1~16자)";
  input.setAttribute("aria-label", "룬 이름");
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
  plain: { width: 236, craftX: -70, equipX: 0, sellX: 140 },
  withEquip: { width: 140, craftX: -122, equipX: 28, sellX: 152 },
  /**
   * 이미 끼워져 있는 룬의 줄. 세공과 해제 둘뿐이라 같은 폭으로 나란히 선다.
   *
   * 판매는 아예 서지 않는다 — 끼고 있는 룬은 서버가 판매를 거부하므로, 눌리지 않는 버튼을
   * 남겨 두면 "왜 안 되는가"를 창이 말하지 않은 채 자리만 차지한다. 그 자리에 지금 할 수
   * 있는 조작(해제)을 세운다.
   */
  equipped: { width: 176, craftX: -94, equipX: 94, sellX: 0 },
  sellWidth: 84,
  sellHeight: 54,
  /** 되돌릴 수 없는 조작 하나뿐인 색. 강조색(금)과 갈라 두어 실수로 눌리지 않게 한다. */
  sellAccent: 0xd9455a,
  sellText: "#ffc3cb",
} as const;

/**
 * 쪽지 왼쪽 위의 표식 칩 한 줄.
 *
 * `MARK_ROW`는 그 줄이 차지하는 높이라, 칩이 생기면서 아래 내용이 함께 내려간다 —
 * 판만 키우고 자리를 그대로 두면 칩이 액자 위에 겹친다.
 */
const MARK_CHIP = { size: 46, row: 56, x: -180, gap: 56 } as const;
const MARK_ROW = MARK_CHIP.row;
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
  top: number,
  instanceId: string,
  api: GameApi,
  onChanged: (rune: RuneInstance) => void,
): RuneMarkChips {
  const inventory = new InventoryManager(session);
  const y = top + MARK_CHIP.row / 2 + 22;
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
  chips.push({ key: "locked", handle: addMarkChip(scene, body, MARK_CHIP.x, y, { glyph: "lock", onColor: MARK_ON.locked, size: MARK_CHIP.size, onToggle: () => toggle("locked") }) });
  chips.push({ key: "bookmarked", handle: addMarkChip(scene, body, MARK_CHIP.x + MARK_CHIP.gap, y, { glyph: "bookmark", onColor: MARK_ON.bookmarked, size: MARK_CHIP.size, onToggle: () => toggle("bookmarked") }) });
  return { paint };
}

/**
 * 룬을 누르면 먼저 열리는 간소한 쪽지.
 *
 * 세공은 골드를 쓰고 결과가 되돌아오지 않는 조작이라, 룬을 눌렀다고 바로 그 화면을 열지
 * 않는다. 여기서는 무엇을 가진 룬인지만 읽고 — 옵션과 지금 어디에 끼워져 있는지 — 다음
 * 행동(세공·장착)은 손으로 한 번 더 고르게 한다.
 */
export function openRuneInfoPopup(scene: Phaser.Scene, popups: PopupLayer, options: RuneInfoPopupOptions): void {
  const rune = session.runeInventory.find(({ instanceId }) => instanceId === options.runeInstanceId);
  if (!rune) return;
  const accent = RUNE_ACCENT[rune.rarity];
  const rarity = RUNE_RARITY_LABELS[rune.rarity];
  const stats = [...rune.mainStats, ...rune.subStats];
  // 쪽지는 작다. 무엇을 가진 룬인지만 읽는 창이라 옵션 줄도 바짝 붙여, 이름과 수치가 한
  // 덩어리로 눈에 들어오게 한다. 크게 벌려 두면 몇 줄 안 되는 내용이 넓은 판에 흩어진다.
  // 표식 칩 한 줄이 머리글 아래에 서므로 그만큼 아래 내용이 내려간다.
  const height = 336 + MARK_ROW + stats.length * 40;
  popups.open({ width: 448, height, title: "룬", anchor: options.anchor, dim: true, onClose: options.onClose }, (body, close) => {
    const top = -height / 2;
    // 판매 버튼은 자물쇠 칩이 다시 칠할 대상이라 먼저 만들고, 자리는 아래 버튼 줄에서 정한다.
    const sell = new Button(scene, 0, 0, {
      width: RUNE_NOTE_BUTTONS.sellWidth, height: RUNE_NOTE_BUTTONS.sellHeight, label: "판매", fontSize: 20,
      accentColor: RUNE_NOTE_BUTTONS.sellAccent, accentTextColor: RUNE_NOTE_BUTTONS.sellText,
      onClick: () => { void new InventoryManager(session).sellRunes(options.api ?? gameApi, [rune.instanceId]).then(() => close()); },
    });
    // 잠금과 즐겨찾기는 **머리글 아래 왼쪽 위**에 작은 칩 두 장으로 선다. 무엇을 가진
    // 룬인지 읽기 전에 "골라 둔 것인가"가 먼저 보이는 자리이고, 판매를 막는 자물쇠가
    // 판매 버튼 옆이 아니라 표식 자리에 있어야 실수로 함께 눌리지 않는다.
    const marks = addRuneMarkChips(scene, body, top, rune.instanceId, options.api ?? gameApi, (next) => {
      // 자물쇠가 걸린 동안에는 판매 자체를 막는다. 서버도 같은 이유로 거부한다.
      if (!equipped) sell.setEnabled(!next.locked);
      options.onChanged?.(next);
    });
    // 머리글("룬")이 창 맨 위에 서므로 그 아래로 한 줄 비우고 시작한다. 액자를 위로 붙이면
    // 조각이 머리글에 잘려 무엇인지 알아볼 수 없다.
    body.add(addRuneFrame(scene, -140, top + MARK_ROW + 122, 108, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
    body.add(scene.add.text(-76, top + MARK_ROW + 78, rarity + "  ·  " + RUNE_PART_LABELS[rune.part], textStyle({ role: "emphasis", size: 18, color: hex(accent) })).setOrigin(0, 0));
    body.add(scene.add.text(-76, top + MARK_ROW + 102, rune.customName ?? `${rarity} 룬`, textStyle({ role: "display", size: 25 })).setOrigin(0, 0).setWordWrapWidth(204));
    body.add(scene.add.text(-76, top + MARK_ROW + 140, equippedLine(rune.instanceId), textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0, 0));
    body.add(drawHairline(scene, 0, top + MARK_ROW + 180, 356, { color: accent, alpha: 0.45 }));

    stats.forEach((stat, index) => {
      const y = top + MARK_ROW + 212 + index * 40;
      const main = index < rune.mainStats.length;
      // 주 옵션은 강조, 보조는 본문이다. 역할은 조건식이 아니라 두 갈래로 명시해서 고른다.
      const nameStyle = main
        ? textStyle({ role: "emphasis", size: 22, color: COLOR.ink })
        : textStyle({ role: "body", size: 21, color: COLOR.inkDim });
      const name = scene.add.text(-168, y, RUNE_STAT_LABEL[stat.key], nameStyle).setOrigin(0, 0.5);
      body.add(name);
      // 각인한 옵션은 **이름 옆에서 바로** 읽혀야 한다. 어느 줄이 완성된 줄인지 알려고 세공
      // 화면을 다시 열게 하지 않는다. 표식은 세공 화면과 같은 다이아이고 크기만 작다.
      if (rune.engravings.some(({ statKey }) => statKey === stat.key)) {
        addRuneMark(scene, body, -168 + name.width + NOTE_ENGRAVE_MARK.gap, y, NOTE_ENGRAVE_MARK.outer, "engrave");
      }
      body.add(scene.add.text(168, y, `+${stat.value}%`, textStyle({ role: "display", size: 22, color: main ? hex(accent) : COLOR.ink })).setOrigin(1, 0.5));
    });

    // 세공 진행은 숫자 하나로만 알린다. 자세한 결과 표식은 세공 화면이 맡는다.
    const attempts = runeEnhancementAttempts(rune);
    const total = runeTotalEnhancementAttempts(rune.rarity);
    const progress = rune.engravings.length > 0 ? "각인 완료" : `세공 ${attempts} / ${total}`;
    body.add(scene.add.text(0, top + MARK_ROW + 212 + stats.length * 40 + 2, progress, textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0.5, 0));

    const buttonY = height / 2 - 56;
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
      width: main.width, height: 68, label: "세공", fontSize: 24, variant: "primary", accentColor: accent,
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
        width: main.width, height: 68, label: "해제", fontSize: 24,
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
        width: main.width, height: 68, label: "장착", fontSize: 24,
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
 * 룬 세공(강화·각인) 화면.
 *
 * 위쪽 한 줄이 지금의 성공·실패 확률이고, 아래 각 옵션 줄에는 세공의 결과가 별로 박힌다 —
 * 성공은 푸른 별, 실패는 다크체리, 맨 뒤 빈 자리는 각인의 노란 별 몫이다. 시도할 때마다 다시
 * 그리므로 확률 선이 곧바로 좌우로 밀린다.
 */
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

export function openRunePopup(scene: Phaser.Scene, popups: PopupLayer, options: RunePopupOptions): void {
  const api = options.api ?? gameApi;
  // 룬을 바꾸는 모든 요청은 이 경계를 지나 Session 반영과 목록 갱신 신호를 함께 낸다.
  const inventory = new InventoryManager(session);
  let rune = session.runeInventory.find(({ instanceId }) => instanceId === options.runeInstanceId);
  if (!rune) return;
  let selected: RuneStatKey | undefined;
  let pending = false;
  popups.open({ width: CRAFT.width, height: CRAFT.height, title: "룬 세공", x: CRAFT.x, y: CRAFT.y, dim: true, onClose: options.onClose }, (body) => {
    const content = scene.add.container(0, 0);
    body.add(content);

    const render = (notice = ""): void => {
      content.removeAll(true);
      const accent = RUNE_ACCENT[rune!.rarity];
      const rarity = RUNE_RARITY_LABELS[rune!.rarity];
      const displayName = rune!.customName ?? `${rarity} 룬`;
      const top = -CRAFT.height / 2;
      const half = CRAFT.width / 2;
      content.add(addRuneFrame(scene, -half + 82, top + 118, 112, rune!.rarity, rune!.part, { mainStats: rune!.mainStats, engraved: rune!.engravings.length > 0 }));
      content.add(scene.add.text(-half + 146, top + 78, rarity + "  ·  " + RUNE_PART_LABELS[rune!.part], textStyle({ role: "emphasis", size: 20, color: hex(accent) })).setOrigin(0, 0));
      const nameText = scene.add.text(-half + 146, top + 104, displayName, textStyle({ role: "display", size: 28 })).setOrigin(0, 0).setWordWrapWidth(260);
      content.add(nameText);
      content.add(scene.add.text(-half + 146, top + 146, equippedLine(rune!.instanceId), textStyle({ role: "body", size: 19, color: COLOR.inkDim })).setOrigin(0, 0));
      // 보유 골드는 로비 상단과 같은 칸으로 세운다. 세공은 골드를 쓰는 화면이라 지갑이 늘
      // 보여야 하고, 같은 값이 화면마다 다른 모양으로 보이지 않게 한다.
      addCurrencyChip(scene, half - 122, top + 92, "currency-gold", {
        width: 156,
        height: 56,
        color: "#ffdf9a",
        parent: content,
      }).setText(formatCurrency(session.wallet.gold));
      // 연필은 씬에서 직접 작도하지 않고 glyph 공용 시스템의 edit 표식을 쓴다. 이름 바로
      // 옆에 서야 무엇을 고치는 단추인지 읽힌다 — 오른쪽 끝에 두면 그 아래 확률 글자와 겹친다.
      const pencilX = Math.min(-half + 146 + nameText.width + 30, half - 244);
      const pencilY = top + 122;
      content.add(drawGlyph(scene, "edit", pencilX, pencilY, 32, accent));
      const renameHit = scene.add.rectangle(pencilX, pencilY, 74, 74, 0xffffff, 0).setInteractive({ useHandCursor: true });
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
          // render()가 세공 버튼을 새로 만들므로, 그 버튼의 allowed 계산이 이 요청을 아직
          // 진행 중인 것으로 보지 않도록 다시 그리기 전에 먼저 풀어 둔다.
          pending = false;
          render("이름을 저장했습니다.");
        } catch (error) { pending = false; throw error; }
      }));
      content.add(renameHit);

      // 확률 줄 — 한 줄을 성공과 실패가 나눠 가진다. 시도할 때마다 가르는 지점이 움직인다.
      const completed = rune!.enhancementComplete;
      const chance = rune!.currentSuccessChance;
      const chanceY = top + 230;
      if (!completed) {
        content.add(scene.add.text(-half + 36, chanceY - 24, `성공 ${Math.round(chance * 100)}%`, textStyle({ role: "emphasis", size: 21, color: hex(RUNE_MARK.success.body) })).setOrigin(0, 1));
        content.add(scene.add.text(half - 36, chanceY - 24, `실패 ${Math.round((1 - chance) * 100)}%`, textStyle({ role: "emphasis", size: 21, color: hex(RUNE_MARK.fail.halo) })).setOrigin(1, 1));
        addChanceLine(scene, content, 0, chanceY, CRAFT.width - 88, chance);
      } else {
        const done = rune!.engravings.length > 0 ? "모든 세공이 끝났습니다." : "각인을 진행해 룬을 완성해 주세요.";
        content.add(scene.add.text(0, chanceY - 12, done, textStyle({ role: "emphasis", size: 23, color: hex(accent) })).setOrigin(0.5, 0.5));
      }

      /**
       * 옵션 한 줄.
       *
       * 주 옵션과 보조 옵션은 판을 나눠 얹는다. 한 판에 다섯 줄을 같은 크기로 늘어놓으면
       * 무엇이 이 룬의 중심인지 읽히지 않는다 — 주 옵션은 크고 두껍게, 보조는 지금 크기로 둔다.
       */
      const drawRow = (stat: { key: RuneStatKey; value: number }, y: number, height: number, main: boolean): void => {
        const usable = completed ? canEngraveRune(rune!) : canEnhanceRune(rune!, stat.key);
        const chosen = selected === stat.key;
        const width = CRAFT.width - 88;
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
          ? textStyle({ role: "display", size: 27, color: chosen ? COLOR.accentText : COLOR.ink })
          : textStyle({ role: "emphasis", size: 21, color: chosen ? COLOR.accentText : COLOR.inkDim });
        content.add(scene.add.text(-width / 2 + (chosen ? 36 : 22), y, `${RUNE_STAT_LABEL[stat.key]}  +${stat.value}%`, labelStyle).setOrigin(0, 0.5).setWordWrapWidth(290));
        const history = rune!.enhancementHistory[stat.key] ?? [];
        const outer = main ? MARK.outer : MARK.outer - 3;
        for (let slot = 0; slot < 3; slot += 1) {
          const result = history[slot];
          const x = MARK.firstX + slot * MARK.step;
          if (!result) addEmptyRuneMark(scene, content, x, y, outer);
          else addRuneMark(scene, content, x, y, outer, result.succeeded ? "success" : "fail");
        }
        // 각인 자리는 세 칸 뒤의 빈 공간이다. 각인된 옵션에만 노란 별이 크게 박힌다.
        const engraving = rune!.engravings.find(({ statKey }) => statKey === stat.key);
        if (engraving) addRuneMark(scene, content, MARK.engraveX, y, MARK.engrave, "engrave");
        const hit = scene.add.rectangle(0, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: usable });
        hit.on("pointerup", () => { if (!pending && usable) { selected = stat.key; render(); } });
        content.add(hit);
      };

      let y = top + 282;
      content.add(scene.add.text(-CRAFT.width / 2 + 44, y, "주 옵션", textStyle({ role: "emphasis", size: 20, color: hex(accent) })).setOrigin(0, 0.5));
      y += 58;
      rune!.mainStats.forEach((stat) => { drawRow(stat, y, 76, true); y += 86; });
      y += 8;
      content.add(scene.add.text(-CRAFT.width / 2 + 44, y, "보조 옵션", textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
      y += 48;
      if (rune!.subStats.length === 0) {
        content.add(scene.add.text(0, y + 10, "이 등급에는 보조 옵션이 없다", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0.5));
      }
      rune!.subStats.forEach((stat) => { drawRow(stat, y, 56, false); y += 64; });

      const footerY = CRAFT.height / 2 - 160;
      content.add(drawHairline(scene, 0, footerY - 38, CRAFT.width - 88, { color: accent, alpha: 0.4 }));
      const engraved = rune!.engravings.length > 0;
      const cost = completed ? 0 : runeEnhancementGoldCost(rune!.rarity, runeEnhancementAttempts(rune!));
      const affordable = completed || session.wallet.gold >= cost;
      const reason = engraved
        ? "모든 세공이 끝났습니다."
        : completed
          ? (selected ? "고른 능력치에 각인해 룬을 완성합니다." : "각인할 능력치를 골라 주세요.")
          : selected ? "성공하면 다음 확률 ↓ · 실패하면 ↑" : "먼저 세공할 능력치 줄을 골라 주세요.";
      // 방금 무슨 일이 있었는지는 버튼 바로 위에 크게 박는다. 손이 머무는 자리에서 결과가
      // 나오지 않으면 확률만 바뀐 채 무엇이 성공이었는지 되짚어야 한다.
      const resultStyle = notice.includes("성공")
        ? textStyle({ role: "display", size: 30, color: hex(RUNE_MARK.success.body) })
        : notice.includes("실패")
          ? textStyle({ role: "display", size: 30, color: hex(RUNE_MARK.fail.halo) })
          : notice
            ? textStyle({ role: "display", size: 30, color: hex(accent) })
            : textStyle({ role: "body", size: 20, color: COLOR.inkDim });
      content.add(scene.add.text(0, notice ? footerY - 18 : footerY - 6, notice || reason, resultStyle).setOrigin(0.5, 0));
      const allowed = !pending && !!selected && !engraved && affordable;
      // 비용은 안내문이 아니라 **누르는 것 위**에 박는다. 재화 이름은 글자 대신 아이콘이다.
      const action = new Button(scene, 0, footerY + 82, { width: 500, height: 78, label: completed ? "각인 확정" : "세공", variant: "primary", accentColor: accent, cost: completed ? undefined : { icon: "currency-gold", amount: cost, affordable }, onClick: async () => {
        if (!allowed || !selected || pending) return;
        pending = true; action.setEnabled(false);
        try {
          // 세공·각인은 반드시 manager를 지난다 — 그래야 가방 목록도 같은 순간에 다시 그려진다.
          const response = completed ? await inventory.engraveRune(api, rune!.instanceId, selected) : await inventory.enhanceRune(api, rune!.instanceId, selected);
          rune = response.rune; options.onChanged?.(rune);
          // 세공은 고른 줄을 그대로 이어 간다. 그 줄이 다 차면 다음 줄로 넘어가고, 모든
          // 세공이 끝나 각인만 남으면 손을 뗀다 — 각인은 되돌릴 수 없는 한 번의 선택이라
          // 무엇에 새길지는 반드시 사람이 다시 고른다.
          selected = rune.enhancementComplete ? undefined : nextCraftTarget(rune, selected);
          // render()가 새 버튼을 즉시 만들므로, 그 버튼의 allowed 계산이 아직 진행 중인 요청을
          // 보지 않도록 다시 그리기 전에 먼저 풀어 둔다 — 그러지 않으면 이어지는 세공마다
          // 방금 만든 버튼이 꺼진 채로 나와 곧바로 다시 누를 수 없었다.
          pending = false;
          render(completed ? "룬을 완성했습니다." : ("succeeded" in response && response.succeeded ? "세공 성공" : "세공 실패"));
        } catch (error) { pending = false; render(error instanceof Error ? error.message : "요청을 완료하지 못했습니다."); }
      }}).setEnabled(allowed);
      content.add(action);
    };
    render();
  });
}
