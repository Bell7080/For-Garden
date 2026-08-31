import Phaser from "phaser";
import type { ActiveCombatBuff } from "../core/skirmish";
import type { RelicDef } from "../core/types";
import { battleBuffTimingLabel } from "../core/battleBuffPresentation";
import type { PopupLayer } from "./PopupLayer";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { skillArtFor, skillArtTint, type SkillArtSlot } from "./skillArt";

export interface BattleBuffPopupController {
  /** 전투는 팝업 뒤에서도 계속되므로 씬의 최신 코어 스냅샷으로 시간과 상태를 갱신한다. */
  update(buff: ActiveCombatBuff): void;
  close(): void;
}

/** 집계 칩이 넘겨주는 최신 버프와 제공자 한 쌍이다. */
export interface BattleBuffListItem { buff: ActiveCombatBuff; provider: RelicDef }

/** 같은 PopupLayer에 전체 활성 목록을 열고, 64px 이상의 각 행에서 상세 쪽지를 이어서 연다. */
export function openBattleBuffListPopup(scene: Phaser.Scene, popups: PopupLayer, items: readonly BattleBuffListItem[], onSelect: (buff: ActiveCombatBuff) => void): void {
  const rowHeight = 82;
  const height = Math.min(760, 170 + items.length * rowHeight);
  popups.open({ width: 760, height, title: `활성 버프  ${items.length}`, tilt: -1.2 }, (content, close) => {
    const top = -height / 2 + 92;
    items.forEach(({ buff, provider }, index) => {
      const y = top + index * rowHeight;
      const tint = skillArtTint(provider.element, provider.role);
      // 행의 왼쪽 마름모와 밝은 이름/시간을 함께 써 색만으로 제공자를 구별하지 않는다.
      const marker = scene.add.graphics().fillStyle(tint, 1).fillPoints([{ x: -320, y }, { x: -308, y: y - 12 }, { x: -296, y }, { x: -308, y: y + 12 }], true);
      const name = scene.add.text(-278, y - 18, buff.name, textStyle({ role: "display", size: 27 })).setOrigin(0, 0);
      const meta = scene.add.text(250, y - 14, battleBuffTimingLabel(buff.timing), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0);
      const hit = scene.add.rectangle(0, y, 660, 68, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => hit.setScale(1.03));
      hit.on("pointerout", () => hit.setScale(1));
      hit.on("pointerup", () => { close(); onSelect(buff); });
      content.add([marker, name, meta, hit]);
      if (index < items.length - 1) content.add(drawHairline(scene, 0, y + 39, 620, { color: COLOR.accent, alpha: 0.2 }));
    });
  });
}

/** SkillPopup과 같은 액자·제목·구분선 위계로 현재 활성 버프의 실제 상태를 보여 준다. */
export function openBattleBuffPopup(scene: Phaser.Scene, popups: PopupLayer, buff: ActiveCombatBuff, provider: RelicDef, onClose?: () => void): BattleBuffPopupController {
  let closePopup = (): void => undefined;
  let timingText!: Phaser.GameObjects.Text;
  const body = popups.open({ width: 760, height: 470, title: "버프 정보", tilt: -1.2, onClose }, (content, close) => {
    closePopup = close;
    const left = -380;
    const top = -235;
    const iconSize = 96;
    const iconX = left + 82;
    const iconY = top + 100;
    const shape = chipPoints(iconSize, iconSize, { bevel: { topLeft: 24, topRight: 0, bottomRight: 24, bottomLeft: 0 } });
    const tint = skillArtTint(provider.element, provider.role);
    content.add(drawLayer(scene, iconX, iconY, shape, { fill: tint, alpha: 0.9 }));
    const slot: SkillArtSlot = buff.skillId === "luka-passive" ? "passive" : "ferocity";
    const dedicated = skillArtFor(provider.id, slot);
    const texture = dedicated && scene.textures.exists(dedicated) ? dedicated : FALLBACK_SKILL_ICON;
    content.add(scene.add.image(iconX, iconY, texture).setDisplaySize(iconSize * 0.72, iconSize * 0.72).setTint(tint));
    content.add(drawInnerVignette(scene, iconX, iconY, shape, { strength: 0.55 }));
    content.add(drawShapeOutline(scene, iconX, iconY, shape, { color: tint, alpha: 0.9, width: 3 }));

    // 헤더에는 이름과 제공자만 두고 구현 상태나 개발 설명은 노출하지 않는다.
    content.add(scene.add.text(left + 154, top + 66, buff.name, textStyle({ role: "display", size: 42 })).setOrigin(0, 0));
    content.add(scene.add.text(left + 154, top + 120, `제공자  ${provider.name}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0));
    content.add(drawHairline(scene, 0, top + 184, 664, { color: COLOR.accent, alpha: 0.35 }));
    content.add(scene.add.text(left + 48, top + 220, "효과", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    content.add(scene.add.text(left + 148, top + 217, buff.description, textStyle({ role: "body", size: 26, wrap: 540 })).setOrigin(0, 0));
    content.add(scene.add.text(left + 48, top + 320, "시간", textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0, 0));
    timingText = scene.add.text(left + 148, top + 317, battleBuffTimingLabel(buff.timing), textStyle({ role: "display", size: 28 })).setOrigin(0, 0);
    content.add(timingText);
  });

  return {
    update(next) { if (body.active && timingText.active) timingText.setText(battleBuffTimingLabel(next.timing)); },
    close() { if (body.active) closePopup(); },
  };
}
