import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { RELICS } from "../data/relics";
import { session } from "../state/session";
import { FaceFrame } from "./FaceFrame";
import { COLOR } from "./theme";
import { t } from "../i18n";
import { settingsManager } from "../managers/SettingsManager";
import { ControlChip } from "./ControlChip";

/**
 * 장착 렐릭 표시가 켜진 가방에서 룬 액자의 뒷배경이 그 룬을 낀 렐릭의 얼굴로 바뀌었다 돌아오는 박자.
 *
 * 얼굴은 룬 **뒤**에 깔리고 가운데 룬은 반투명(`runeGhostAlpha`)으로 남는다 — 룬을 지우고 얼굴로 갈아
 * 끼우면 「누가 끼고 있나」가 읽히는 동안 룬이 사라진다. 바뀔 때는 서서히 녹지 않고 짧게 넘어가며
 * (`fadeMs`), 얼굴이 서 있는 시간이 룬만 서 있는 시간보다 길다.
 * 카드마다 시작을 조금씩 밀어(`stagger`) 한 화면의 얼굴이 한꺼번에 깜빡이지 않게 하되, 상한을 두어
 * 뒤쪽 카드가 한참 동안 움직이지 않는 일도 없게 한다. 얼굴 액자는 룬 액자와 같은 깎임을 쓴다
 * (`ITEM_FRAME`) — 두 그림이 같은 실루엣 안에서 갈마든다.
 */
export const RUNE_HOLDER_CYCLE = {
  runeHoldMs: 1800,
  fadeMs: 140,
  faceHoldMs: 3600,
  /** 얼굴이 뒷배경으로 서 있는 동안 가운데 룬의 투명도. */
  runeGhostAlpha: 0.4,
  staggerMs: 260,
  staggerSteps: 8,
  /** 움직임 줄이기에서는 돌지 않고 액자 오른쪽 아래에 작은 얼굴만 고정으로 선다. */
  badgeRatio: 0.4,
} as const;

/**
 * 카드 한 장에 장착자 얼굴을 얹는다.
 *
 * `runeFrame`은 그 카드의 룬 액자다 — 얼굴이 떠오르는 만큼 룬이 잦아들어 두 그림이 겹쳐 탁해지지
 * 않는다. 박자는 카드가 사는 동안만 돈다(트윈은 카드와 함께 죽는다).
 */
export function addRuneHolderFace(
  scene: Phaser.Scene,
  card: Phaser.GameObjects.Container,
  runeFrame: Phaser.GameObjects.Container,
  frameSize: number,
  relicId: string,
  order: number,
): void {
  const def = RELICS.find(({ id }) => id === relicId);
  if (!def) return;
  if (motionPolicy(session.settings).nonEssentialRepeatFactor === 0) {
    const size = frameSize * RUNE_HOLDER_CYCLE.badgeRatio;
    card.add(new FaceFrame(scene, frameSize / 2 - size / 2, frameSize / 2 - size / 2, { portraitAssetId: def.portraitAssetId, size, color: COLOR.accent }));
    return;
  }
  const face = new FaceFrame(scene, 0, 0, { portraitAssetId: def.portraitAssetId, size: frameSize, color: COLOR.accent }).setAlpha(0);
  // 얼굴은 룬 액자 바로 아래(카드 판 위)에 깔려 룬 너머로 비친다.
  card.addAt(face, Math.max(0, card.getIndex(runeFrame)));
  const { runeHoldMs, fadeMs, faceHoldMs, staggerMs, staggerSteps, runeGhostAlpha } = RUNE_HOLDER_CYCLE;
  const tween = scene.tweens.add({
    targets: face,
    alpha: 1,
    duration: fadeMs,
    ease: "Quad.easeOut",
    hold: faceHoldMs,
    yoyo: true,
    repeat: -1,
    repeatDelay: runeHoldMs,
    delay: runeHoldMs + (order % staggerSteps) * staggerMs,
    onUpdate: () => { runeFrame.setAlpha(1 - face.alpha * (1 - runeGhostAlpha)); },
  });
  card.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
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
