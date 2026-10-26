import Phaser from "phaser";
import { RELICS } from "../data/relics";
import { FaceFrame } from "./FaceFrame";
import { COLOR } from "./theme";
import { t } from "../i18n";
import { settingsManager } from "../managers/SettingsManager";
import { ControlChip } from "./ControlChip";
import { runeHolderBadgeSpot } from "./runeHolderLayout";

/**
 * 카드 한 장에 장착자 얼굴을 깔고 룬 액자를 왼쪽 아래로 줄여 앉힌다.
 *
 * `runeFrame`은 그 카드의 룬 액자다 — 얼굴이 그 아래층에 서고 룬이 줄어 위에 얹힌다.
 */
export function addRuneHolderFace(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  runeFrame: Phaser.GameObjects.Container,
  frameSize: number,
  relicId: string,
): void {
  const def = RELICS.find(({ id }) => id === relicId);
  if (!def) return;
  card.addAt(new FaceFrame(scene, 0, 0, { portraitAssetId: def.portraitAssetId, size: frameSize, color: COLOR.accent }), Math.max(0, card.getIndex(runeFrame)));
  const spot = runeHolderBadgeSpot(frameSize);
  runeFrame.setPosition(spot.x, spot.y).setScale(spot.scale);
}

/** 보기 토글 두 장의 크기. 가방과 장착 가방이 같은 값을 쓴다. */
export const RUNE_BAG_TOGGLE = { width: 150, height: 60, gap: 10 } as const;

/**
 * 룬 가방의 보기 토글 두 장 — 「장착자」(액자가 장착 렐릭 얼굴과 갈마든다) · 「장착 룬」(장착 중인 룬을 목록에 세운다).
 *
 * 가방(`InventoryPopup`)과 정보창의 장착 가방이 **같은 값**(`settings.game.runeBag`)을 읽고 쓴다 — 한쪽에서 켠 것이
 * 다른 쪽에서 꺼져 있으면 같은 목록이 두 모습으로 읽힌다. 값이 바뀌면 부른 쪽이 목록만 다시 그린다.
 * `left`는 첫 칩의 왼쪽 끝이다.
 */
export function addRuneBagToggles(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, y: number, onChange: () => void): void {
  const { width, height, gap } = RUNE_BAG_TOGGLE;
  const specs = [
    { key: "showHolder", icon: "friends", label: t("rune.bag.showHolder") },
    { key: "showEquipped", icon: "check", label: t("rune.bag.showEquipped") },
  ] as const;
  specs.forEach((spec, index) => {
    const chip = new ControlChip(scene, left + width / 2 + index * (width + gap), y, {
      icon: spec.icon, label: spec.label, width, height,
      onClick: () => {
        const current = settingsManager.get().game.runeBag;
        settingsManager.update({ game: { runeBag: { ...current, [spec.key]: !current[spec.key] } } });
        chip.setActive(settingsManager.get().game.runeBag[spec.key]);
        onChange();
      },
    });
    chip.setActive(settingsManager.get().game.runeBag[spec.key]);
    parent.add(chip);
  });
}
