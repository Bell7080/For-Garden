import Phaser from "phaser";
import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { canEngraveRune, canEnhanceRune, RUNE_RARITY_LABELS, runeEnhancementAttempts, runeTotalEnhancementAttempts, type RuneInstance, type RuneStatKey } from "../core/runes";
import { runeEnhancementGoldCost } from "../data/runes";
import { RELICS } from "../data/relics";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { drawGlyph } from "./glyphs";
import { drawHairline, drawLayer, slantedRect } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { addChanceLine, addEmptyRuneMark, addRuneIcon, addRuneMark, RUNE_ACCENT, RUNE_MARK } from "./runeIcons";
import { addCurrencyChip } from "./CurrencyChip";
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

/** 세공 표식의 크기. 각인 별만 눈에 띄게 크다 — 한 룬에 한 번뿐인 결과이기 때문이다. */
const MARK = { outer: 17, engrave: 25, step: 52, firstX: 110, engraveX: 286 } as const;

/**
 * 세공 화면의 크기와 자리.
 *
 * 화면 한가운데에 뜬다. 조각을 누른 자리에 붙이면 팝업이 화면 아래쪽으로 쏠려 위쪽 절반이
 * 통째로 빈다 — 세공은 쪽지가 아니라 한동안 머무는 작업 화면이다.
 */
const CRAFT = { width: 820, height: 1100, x: 540, y: 940 } as const;

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
function equippedLine(instanceId: string): string {
  const entry = Object.entries(session.relicProgress).find(([, progress]) => progress.heartGemSlots.includes(instanceId));
  if (!entry) return "장착 안 함";
  return `장착 · ${RELICS.find(({ id }) => id === entry[0])?.name ?? entry[0]}`;
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
  const height = 470 + stats.length * 54;
  popups.open({ width: 760, height, title: "룬", anchor: options.anchor, dim: true, onClose: options.onClose }, (body, close) => {
    const top = -height / 2;
    body.add(addRuneIcon(scene, -250, top + 128, 118, rune.rarity));
    body.add(scene.add.text(-172, top + 78, rarity, textStyle({ role: "emphasis", size: 24, color: hex(accent) })).setOrigin(0, 0));
    body.add(scene.add.text(-172, top + 114, rune.customName ?? `${rarity} 룬`, textStyle({ role: "display", size: 36 })).setOrigin(0, 0).setWordWrapWidth(420));
    body.add(scene.add.text(-172, top + 166, equippedLine(rune.instanceId), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0));
    body.add(drawHairline(scene, 0, top + 214, 640, { color: accent, alpha: 0.45 }));

    stats.forEach((stat, index) => {
      const y = top + 254 + index * 54;
      const main = index < rune.mainStats.length;
      // 주 옵션은 강조, 보조는 본문이다. 역할은 조건식이 아니라 두 갈래로 명시해서 고른다.
      const nameStyle = main
        ? textStyle({ role: "emphasis", size: 24, color: COLOR.ink })
        : textStyle({ role: "body", size: 24, color: COLOR.inkDim });
      body.add(scene.add.text(-320, y, RUNE_STAT_LABEL[stat.key], nameStyle).setOrigin(0, 0.5));
      body.add(scene.add.text(320, y, `+${stat.value}%`, textStyle({ role: "display", size: 26, color: main ? hex(accent) : COLOR.ink })).setOrigin(1, 0.5));
    });

    // 세공 진행은 숫자 하나로만 알린다. 자세한 결과 표식은 세공 화면이 맡는다.
    const attempts = runeEnhancementAttempts(rune);
    const total = runeTotalEnhancementAttempts(rune.rarity);
    const progress = rune.engravings.length > 0 ? "각인 완료" : `세공 ${attempts} / ${total}`;
    body.add(scene.add.text(0, top + 254 + stats.length * 54 + 8, progress, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0.5, 0));

    const buttonY = height / 2 - 84;
    const equip = options.equip;
    // 장착은 정보창에서 연 룬에만 있다. 가방을 어디서 열었는지에 따라 할 수 있는 일이 다르다.
    const craftX = equip ? -168 : 0;
    body.add(new Button(scene, craftX, buttonY, {
      width: 300, height: 88, label: "세공", variant: "primary", accentColor: accent,
      onClick: () => {
        close();
        openRunePopup(scene, popups, options);
      },
    }));
    if (equip) {
      body.add(new Button(scene, 168, buttonY, {
        width: 300, height: 88, label: "장착", fontSize: 30,
        onClick: () => {
          void relicProgression.equipRune(equip.relicId, equip.slotIndex, rune.instanceId).then(() => {
            close();
            equip.onEquipped?.();
          });
        },
      }));
    }
  });
}

/**
 * 룬 세공(강화·각인) 화면.
 *
 * 위쪽 한 줄이 지금의 성공·실패 확률이고, 아래 각 옵션 줄에는 세공의 결과가 별로 박힌다 —
 * 성공은 푸른 별, 실패는 다크체리, 맨 뒤 빈 자리는 각인의 노란 별 몫이다. 시도할 때마다 다시
 * 그리므로 확률 선이 곧바로 좌우로 밀린다.
 */
export function openRunePopup(scene: Phaser.Scene, popups: PopupLayer, options: RunePopupOptions): void {
  const api = options.api ?? gameApi;
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
      content.add(addRuneIcon(scene, -half + 86, top + 122, 92, rune!.rarity));
      content.add(scene.add.text(-half + 148, top + 78, rarity, textStyle({ role: "emphasis", size: 22, color: hex(accent) })).setOrigin(0, 0));
      content.add(scene.add.text(-half + 148, top + 108, displayName, textStyle({ role: "display", size: 32 })).setOrigin(0, 0).setWordWrapWidth(420));
      content.add(scene.add.text(-half + 148, top + 154, equippedLine(rune!.instanceId), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
      // 보유 골드는 로비 상단과 같은 칸으로 세운다. 세공은 골드를 쓰는 화면이라 지갑이 늘
      // 보여야 하고, 같은 값이 화면마다 다른 모양으로 보이지 않게 한다.
      addCurrencyChip(scene, half - 148, top + 96, "currency-gold", {
        width: 196,
        height: 62,
        color: "#ffdf9a",
        parent: content,
      }).setText(formatCurrency(session.wallet.gold));
      // 연필은 씬에서 직접 작도하지 않고 glyph 공용 시스템의 edit 표식을 쓴다.
      const pencilX = half - 62;
      const pencilY = top + 170;
      content.add(drawGlyph(scene, "edit", pencilX, pencilY, 32, accent));
      const renameHit = scene.add.rectangle(pencilX, pencilY, 74, 74, 0xffffff, 0).setInteractive({ useHandCursor: true });
      renameHit.on("pointerup", () => requestRuneName(scene, rune!.customName ?? "", async (value) => {
        if (pending) return; pending = true;
        try { const response = await api.renameRune({ runeInstanceId: rune!.instanceId, name: value }); rune = response.rune; options.onChanged?.(rune); render("이름을 저장했습니다."); }
        finally { pending = false; }
      }));
      content.add(renameHit);

      // 확률 줄 — 한 줄을 성공과 실패가 나눠 가진다. 시도할 때마다 가르는 지점이 움직인다.
      const completed = rune!.enhancementComplete;
      const chance = rune!.currentSuccessChance;
      const chanceY = top + 226;
      if (!completed) {
        content.add(scene.add.text(-half + 40, chanceY - 30, `성공 ${Math.round(chance * 100)}%`, textStyle({ role: "emphasis", size: 22, color: hex(RUNE_MARK.success.body) })).setOrigin(0, 1));
        content.add(scene.add.text(half - 40, chanceY - 30, `실패 ${Math.round((1 - chance) * 100)}%`, textStyle({ role: "emphasis", size: 22, color: hex(RUNE_MARK.fail.halo) })).setOrigin(1, 1));
        addChanceLine(scene, content, 0, chanceY, CRAFT.width - 96, chance);
      } else {
        const done = rune!.engravings.length > 0 ? "세공과 각인을 모두 마쳤다" : "모든 세공을 마쳤다 · 각인만 남았다";
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
        const width = CRAFT.width - 96;
        content.add(drawLayer(scene, 0, y, slantedRect(width, height, 12), {
          fill: chosen ? 0x17212a : main ? 0x121a23 : 0x0e141b,
          alpha: 0.95,
          edge: accent,
          edgeAlpha: chosen ? 0.95 : main ? 0.4 : 0.16,
          glow: chosen ? { color: accent, strength: 0.25 } : undefined,
        }));
        const labelStyle = main
          ? textStyle({ role: "display", size: 27 })
          : textStyle({ role: "emphasis", size: 21, color: COLOR.inkDim });
        content.add(scene.add.text(-width / 2 + 26, y, `${RUNE_STAT_LABEL[stat.key]}  +${stat.value}%`, labelStyle).setOrigin(0, 0.5).setWordWrapWidth(330));
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

      let y = top + 288;
      content.add(scene.add.text(-CRAFT.width / 2 + 48, y, "주 옵션", textStyle({ role: "emphasis", size: 21, color: hex(accent) })).setOrigin(0, 0.5));
      y += 64;
      rune!.mainStats.forEach((stat) => { drawRow(stat, y, 84, true); y += 96; });
      y += 12;
      content.add(scene.add.text(-CRAFT.width / 2 + 48, y, "보조 옵션", textStyle({ role: "emphasis", size: 21, color: COLOR.inkDim })).setOrigin(0, 0.5));
      y += 52;
      if (rune!.subStats.length === 0) {
        content.add(scene.add.text(0, y + 10, "이 등급에는 보조 옵션이 없다", textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0.5, 0.5));
      }
      rune!.subStats.forEach((stat) => { drawRow(stat, y, 62, false); y += 72; });

      const footerY = CRAFT.height / 2 - 168;
      content.add(drawHairline(scene, 0, footerY - 40, CRAFT.width - 96, { color: accent, alpha: 0.4 }));
      const engraved = rune!.engravings.length > 0;
      const cost = completed ? 0 : runeEnhancementGoldCost(rune!.rarity, runeEnhancementAttempts(rune!));
      const affordable = completed || session.wallet.gold >= cost;
      const reason = engraved ? "각인 완료" : completed ? (selected ? "선택한 능력치를 확정 강화합니다." : "각인할 능력치를 선택하세요.") : selected ? "성공하면 다음 확률 ↓ · 실패하면 ↑" : "먼저 세공할 능력치 줄을 선택하세요.";
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
      const action = new Button(scene, 0, footerY + 96, { width: 560, height: 84, label: completed ? "각인 확정" : "세공", variant: "primary", accentColor: accent, cost: completed ? undefined : { icon: "currency-gold", amount: cost, affordable }, onClick: async () => {
        if (!allowed || !selected || pending) return;
        pending = true; action.setEnabled(false);
        try {
          const response = completed ? await api.engraveRune({ runeInstanceId: rune!.instanceId, statId: selected }) : await api.enhanceRune({ runeInstanceId: rune!.instanceId, statId: selected });
          rune = response.rune; options.onChanged?.(rune); selected = undefined; render(completed ? "각인이 완료되었습니다." : ("succeeded" in response && response.succeeded ? "세공 성공" : "세공 실패"));
        } catch (error) { render(error instanceof Error ? error.message : "요청을 완료하지 못했습니다."); }
        finally { pending = false; }
      }}).setEnabled(allowed);
      content.add(action);
    };
    render();
  });
}
