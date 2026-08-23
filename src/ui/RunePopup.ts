import Phaser from "phaser";
import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { canEngraveRune, canEnhanceRune, RUNE_RARITY_LABELS, runeEnhancementAttempts, type RuneInstance, type RuneStatKey } from "../core/runes";
import { runeEnhancementGoldCost } from "../data/runes";
import { RELICS } from "../data/relics";
import { session } from "../state/session";
import { Button } from "./Button";
import { drawGlyph } from "./glyphs";
import { drawHairline, drawLayer, HoloBar, slantedRect } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { addRuneIcon, RUNE_ACCENT } from "./runeIcons";
import { COLOR, textStyle } from "./theme";

/** 룬 도메인 키의 공용 표시명이다. 긴 한국어 옵션도 한 줄의 고정 폭 안에서 줄어든다. */
const STAT_LABEL: Readonly<Record<RuneStatKey, string>> = {
  hp: "체력", atk: "공격력", ap: "주문력", def: "방어력", res: "저항력", moveSpeed: "이동 속도",
  attackSpeed: "공격 속도", lifeSteal: "피해 흡혈", critChance: "치명타 확률", critDamage: "치명타 피해",
  ferocityGain: "야성 획득 증가", energyGain: "궁극기 충전량 증가",
};

export interface RunePopupOptions {
  runeInstanceId: string;
  /** 누른 조각/목록 칸의 화면 좌표다. PopupLayer가 화면 안으로 밀어 넣는다. */
  anchor?: { x: number; y: number };
  onClose?: () => void;
  /** 테스트와 실제 HTTP 구현 교체를 위해 API 경계를 주입할 수 있다. */
  api?: GameApi;
  onChanged?: (rune: RuneInstance) => void;
}

/** 저장의 단일 장착표에서 이 룬을 사용하는 렐릭 이름을 찾는다. */
function equippedRelicName(instanceId: string): string {
  const entry = Object.entries(session.relicProgress).find(([, progress]) => progress.heartGemSlots.includes(instanceId));
  return entry ? (RELICS.find(({ id }) => id === entry[0])?.name ?? entry[0]) : "장착 안 함";
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

/** 인벤토리와 정보창 조각이 함께 여는 유일한 룬 성장 팝업이다. */
export function openRunePopup(scene: Phaser.Scene, popups: PopupLayer, options: RunePopupOptions): void {
  const api = options.api ?? gameApi;
  let rune = session.runeInventory.find(({ instanceId }) => instanceId === options.runeInstanceId);
  if (!rune) return;
  let selected: RuneStatKey | undefined;
  let pending = false;
  popups.open({ width: 900, height: 1320, title: "룬 강화", x: 540, y: 960, anchor: options.anchor, dim: true, onClose: options.onClose }, (body) => {
    const content = scene.add.container(0, 0);
    body.add(content);

    const render = (notice = ""): void => {
      content.removeAll(true);
      const accent = RUNE_ACCENT[rune!.rarity];
      const rarity = RUNE_RARITY_LABELS[rune!.rarity];
      const displayName = rune!.customName ?? `${rarity} 룬`;
      content.add(addRuneIcon(scene, -350, -512, 112, rune!.rarity).setPosition(-350, -512));
      content.add(scene.add.text(-270, -564, rarity, textStyle({ role: "emphasis", size: 24, color: `#${accent.toString(16).padStart(6, "0")}` })).setOrigin(0, 0));
      const name = scene.add.text(-270, -526, displayName, textStyle({ role: "display", size: 36 })).setOrigin(0, 0).setWordWrapWidth(480);
      content.add(name);
      // 연필은 씬에서 직접 작도하지 않고 glyph 공용 시스템의 edit 표식을 쓴다.
      const pencil = drawGlyph(scene, "edit", 310, -504, 34, accent);
      const renameHit = scene.add.rectangle(310, -504, 74, 74, 0xffffff, 0).setInteractive({ useHandCursor: true });
      renameHit.on("pointerup", () => requestRuneName(scene, rune!.customName ?? "", async (value) => {
        if (pending) return; pending = true;
        try { const response = await api.renameRune({ runeInstanceId: rune!.instanceId, name: value }); rune = response.rune; options.onChanged?.(rune); render("이름을 저장했습니다."); }
        finally { pending = false; }
      }));
      content.add([pencil, renameHit]);
      content.add(scene.add.text(-270, -474, `장착 렐릭  ${equippedRelicName(rune!.instanceId)}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0));
      content.add(drawHairline(scene, 0, -422, 760, { color: accent, alpha: 0.45 }));

      const stats = [...rune!.mainStats, ...rune!.subStats];
      const rowGap = Math.min(132, 590 / stats.length);
      stats.forEach((stat, index) => {
        const y = -350 + index * rowGap;
        const usable = rune!.enhancementComplete ? canEngraveRune(rune!) : canEnhanceRune(rune!, stat.key);
        const chosen = selected === stat.key;
        content.add(drawLayer(scene, 0, y, slantedRect(760, Math.min(92, rowGap - 10), 12), { fill: chosen ? 0x17212a : 0x10161d, alpha: 0.9, edge: accent, edgeAlpha: chosen ? 0.95 : 0.18, glow: chosen ? { color: accent, strength: 0.25 } : undefined }));
        const label = scene.add.text(-342, y - 14, `${STAT_LABEL[stat.key]}  +${stat.value}%`, textStyle({ role: "emphasis", size: stats.length === 5 ? 24 : 21 })).setOrigin(0, 0.5).setWordWrapWidth(430);
        content.add(label);
        const history = rune!.enhancementHistory[stat.key] ?? [];
        for (let slot = 0; slot < 3; slot += 1) {
          const result = history[slot];
          const x = 210 + slot * 62;
          const mark = scene.add.graphics({ x, y });
          if (result?.succeeded) { mark.fillStyle(accent, 0.28); mark.fillRect(-21, -21, 42, 42); mark.lineStyle(4, accent, 1); mark.lineBetween(-13, 0, -2, 12); mark.lineBetween(-2, 12, 15, -12); }
          else if (result) { mark.fillStyle(0x25272b, 0.9); mark.fillRect(-21, -21, 42, 42); mark.lineStyle(3, 0x777b82, 0.65); mark.lineBetween(-14, -14, 14, 14); mark.lineBetween(10, 8, 3, 18); }
          else { mark.lineStyle(2, 0x8a929c, 0.34); mark.lineBetween(-18, -16, 18, -16); mark.lineBetween(-18, -16, -22, 15); mark.lineBetween(-22, 15, 14, 15); }
          content.add(mark);
        }
        const hit = scene.add.rectangle(0, y, 760, Math.min(92, rowGap - 10), 0xffffff, 0).setInteractive({ useHandCursor: usable });
        hit.on("pointerup", () => { if (!pending && usable) { selected = stat.key; render(); } });
        content.add(hit);
      });

      const footerY = 360;
      content.add(drawHairline(scene, 0, footerY - 62, 760, { color: accent, alpha: 0.4 }));
      const completed = rune!.enhancementComplete;
      const engraved = rune!.engravings.length > 0;
      const cost = completed ? 0 : runeEnhancementGoldCost(rune!.rarity, runeEnhancementAttempts(rune!));
      // 확률도 다른 게이지와 같은 얇은 홈/채움 체계를 사용한다.
      if (!completed) new HoloBar(scene, 0, footerY - 48, 720, 10, { color: accent }).addTo(content).setValue(rune!.currentSuccessChance);
      content.add(scene.add.text(-360, footerY - 34, completed ? "각인 · 선택 능력치 확정 강화" : `성공 확률  ${Math.round(rune!.currentSuccessChance * 100)}%   ·   이번 비용  ${cost.toLocaleString()} 골드`, textStyle({ role: "emphasis", size: 23, color: `#${accent.toString(16).padStart(6, "0")}` })).setOrigin(0, 0));
      content.add(scene.add.text(-360, footerY + 4, `보유 골드  ${session.wallet.gold.toLocaleString()}`, textStyle({ role: "body", size: 22, color: session.wallet.gold < cost ? "#ef7474" : COLOR.ink })).setOrigin(0, 0));
      const reason = engraved ? "각인 완료" : completed ? (selected ? "선택한 능력치를 확정 강화합니다." : "각인할 능력치를 선택하세요.") : selected ? "성공하면 다음 확률 ↓ · 실패하면 ↑" : "먼저 강화할 능력치 행을 선택하세요.";
      content.add(scene.add.text(-360, footerY + 44, notice || reason, textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(0, 0));
      const allowed = !pending && !!selected && !engraved && (completed || session.wallet.gold >= cost);
      const action = new Button(scene, 0, footerY + 132, { width: 620, height: 92, label: completed ? "각인 확정" : "강화", variant: "primary", accentColor: accent, onClick: async () => {
        if (!allowed || !selected || pending) return;
        pending = true; action.setEnabled(false);
        try {
          const response = completed ? await api.engraveRune({ runeInstanceId: rune!.instanceId, statId: selected }) : await api.enhanceRune({ runeInstanceId: rune!.instanceId, statId: selected });
          rune = response.rune; options.onChanged?.(rune); selected = undefined; render(completed ? "각인이 완료되었습니다." : ("succeeded" in response && response.succeeded ? "강화 성공" : "강화 실패"));
        } catch (error) { render(error instanceof Error ? error.message : "요청을 완료하지 못했습니다."); }
        finally { pending = false; }
      }}).setEnabled(allowed);
      content.add(action);
    };
    render();
  });
}
