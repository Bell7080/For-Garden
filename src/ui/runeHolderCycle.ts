import Phaser from "phaser";
import { RELICS } from "../data/relics";
import { FaceFrame } from "./FaceFrame";
import { COLOR } from "./theme";
import { t } from "../i18n";
import { settingsManager } from "../managers/SettingsManager";
import { ControlChip } from "./ControlChip";
import { runeHolderBadgeSpot } from "./runeHolderLayout";
import { nextRuneTraitView, type RuneTraitView } from "../core/runeListFilter";

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

/** 보기 토글 한 장의 크기. 가방과 룬 고르기 판들이 같은 값을 쓴다. */
export const RUNE_BAG_TOGGLE = { width: 150, height: 60, gap: 10 } as const;

/** 토글 줄 전체 폭 — 오른쪽에 남는 자리에 개수가 선다. */
export const RUNE_BAG_TOGGLE_ROW_WIDTH = RUNE_BAG_TOGGLE.width * 4 + RUNE_BAG_TOGGLE.gap * 3;

/**
 * 룬 목록의 토글 줄 — 「장착자」(액자가 장착 렐릭 얼굴과 갈마든다) · 「장착 중」(장착 중인 룬을 목록에 세운다) ·
 * 「특성」(전체 → 특성 있음 → 특성 없음) · 「즐겨찾기」(즐겨찾기한 룬만).
 *
 * 필터 줄 **아래에 따로 선 한 줄**이다 — 필터·검색·정렬과 한 줄에 끼우면 토글이 늘 때마다 검색 칸이 줄었다.
 * 가방(`InventoryPopup`)과 룬 고르기 판들이 **같은 값**(`settings.game.runeBag`)을 읽고 쓴다 — 한쪽에서 켠 것이
 * 다른 쪽에서 꺼져 있으면 같은 목록이 두 모습으로 읽힌다. 값이 바뀌면 부른 쪽이 목록만 다시 그린다.
 * `left`는 첫 칩의 왼쪽 끝이다.
 */
export function addRuneBagToggles(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, left: number, y: number, onChange: () => void): void {
  const { width, height, gap } = RUNE_BAG_TOGGLE;
  const x = (index: number): number => left + width / 2 + index * (width + gap);
  const binary = [
    { key: "showHolder", icon: "friends", label: t("rune.bag.showHolder"), at: 0 },
    { key: "showEquipped", icon: "check", label: t("rune.bag.showEquipped"), at: 1 },
    { key: "bookmarkedOnly", icon: "bookmark", label: t("rune.bag.bookmarked"), at: 3 },
  ] as const;
  for (const spec of binary) {
    const chip = new ControlChip(scene, x(spec.at), y, {
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
  }
  // 특성은 켜고 끄는 두 자리가 아니라 셋이다 — 특성을 줄 룬(없음)과 다듬을 룬(있음)을 둘 다 찾는다.
  const traitLabel = (view: RuneTraitView): string => t(`rune.bag.trait.${view}`);
  const trait = new ControlChip(scene, x(2), y, {
    icon: "scroll", label: traitLabel(settingsManager.get().game.runeBag.trait), width, height,
    onClick: () => {
      const current = settingsManager.get().game.runeBag;
      settingsManager.update({ game: { runeBag: { ...current, trait: nextRuneTraitView(current.trait) } } });
      const next = settingsManager.get().game.runeBag.trait;
      trait.setLabel(traitLabel(next)).setActive(next !== "all");
      onChange();
    },
  });
  trait.setActive(settingsManager.get().game.runeBag.trait !== "all");
  parent.add(trait);
}
