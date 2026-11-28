import Phaser from "phaser";
import { t } from "../i18n";
import { COLOR, textStyle } from "./theme";
import { drawGlyph } from "./glyphs";
import { drawLayer, slantedRect } from "./holo";
import { bindPress } from "./pressFeedback";
import { squeezeTextToWidth } from "./textFit";

/**
 * 결투 방어덱의 숨김 칸 — 한 벌의 생김새(응태 2026-11-28).
 *
 * 예전에는 칸마다 「가림 1 · 공개」 글자 버튼이 같은 유리판으로 서서, 지금 어느 칸이 가려지는지 글자를 읽어야 알았다.
 * 이제 숨긴 칸은 **보랏빛으로 물든 칩 + 지워진 눈**이고 그 칸의 SD는 같은 빛의 실루엣으로 가라앉으며 가운데에
 * 큰 `?`가 선다 — 상대 창에서 그 칸이 보일 모습 그대로다. 드러난 칸은 어두운 유리 위의 흐린 눈 하나로 물러난다.
 */
export const DUEL_BLIND_STYLE = {
  chip: { width: 196, height: 62 },
  /** 숨긴 칩의 판·윗변·빛. */
  hidden: { fill: 0x4b2a78, edge: 0xc9a6ff, glow: 0xb48cff, text: "#ffffff", glyph: 0xffffff },
  /** 드러난 칩 — 어두운 유리 위의 흐린 눈. */
  shown: { fill: 0x15171b, alpha: 0.82, edge: 0x5a5f69, text: COLOR.inkDim, glyph: COLOR.inkDimHex },
  /** 숨긴 칸 SD에 덮는 빛 — 실루엣처럼 가라앉되 윤곽은 남는다. */
  veil: { color: 0x1c0f30, amount: 0.8 },
  /** SD 가운데의 물음표. */
  mark: { size: 112, color: "#d9c2ff", stroke: "#12081f" },
} as const;

/** 숨김 칩 한 장. `onTap`이 상태를 바꾸면 부르는 쪽이 다시 그린다. */
export function addDuelBlindToggle(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, hidden: boolean, onTap: () => void,
): Phaser.GameObjects.Container {
  const { chip } = DUEL_BLIND_STYLE;
  const tone = hidden ? DUEL_BLIND_STYLE.hidden : DUEL_BLIND_STYLE.shown;
  const box = scene.add.container(x, y);
  box.add(drawLayer(scene, 0, 0, slantedRect(chip.width, chip.height), hidden
    ? { fill: tone.fill, alpha: 0.97, edge: DUEL_BLIND_STYLE.hidden.edge, edgeAlpha: 1, edgeWidth: 3, glow: { color: DUEL_BLIND_STYLE.hidden.glow, strength: 0.4, height: 0.9 } }
    : { fill: tone.fill, alpha: DUEL_BLIND_STYLE.shown.alpha, edge: DUEL_BLIND_STYLE.shown.edge, edgeAlpha: 0.7 }));
  const glyphX = -chip.width / 2 + 40;
  box.add(drawGlyph(scene, hidden ? "eye-off" : "eye", glyphX, 0, 34, tone.glyph, 1, 3.5));
  const label = scene.add.text(glyphX + 28, 0, t(hidden ? "duel.blind.hidden" : "duel.blind.shown"), hidden ? textStyle({ role: "display", size: 28, color: tone.text }) : textStyle({ role: "emphasis", size: 24, color: tone.text }))
    .setOrigin(0, 0.5);
  squeezeTextToWidth(label, chip.width / 2 + 40 - 28 - 16);
  box.add(label);
  const hit = scene.add.rectangle(0, 0, chip.width + 16, chip.height + 20, 0xffffff, 0).setInteractive({ useHandCursor: true });
  box.add(hit);
  bindPress(hit, box);
  hit.on("pointerup", onTap);
  parent.add(box);
  return box;
}

/** 숨긴 칸 SD 가운데의 큰 물음표. 상대 창의 `???` 칸과 같은 말이다. */
export function addDuelBlindMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number): void {
  const { mark } = DUEL_BLIND_STYLE;
  parent.add(scene.add.text(x, y, "?", textStyle({ role: "display", size: mark.size, color: mark.color })).setStroke(mark.stroke, 12).setOrigin(0.5).setAlpha(0.92));
}

/**
 * 저장한 뒤로 약해진 렐릭의 표식 — 방어덱 칸의 SD 어깨 위에 붉은 칩(내림 화살표 + 「약해짐」)이 숨 쉬며 선다(응태 2026-11-28).
 * 로비·결투장의 빨간 점이 「누가」를 말하지 못하므로 방어덱에 들어오면 이 칩이 그 렐릭을 짚는다. 누를 것이 없는 표식이다.
 */
export const DUEL_WEAKENED_STYLE = {
  chip: { width: 150, height: 46 },
  fill: 0x7a1424, edge: 0xff8a8a, glow: 0xff4d5e, text: "#ffffff",
  /** SD 발끝 줄에서 칩 중심까지(위로) · 칸 가운데에서 오른쪽으로. */
  rise: 150, shift: 70,
  pulse: { from: 0.7, durationMs: 620 },
} as const;

export function addDuelWeakenedMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, reduceMotion: boolean): Phaser.GameObjects.Container {
  const S = DUEL_WEAKENED_STYLE;
  const box = scene.add.container(x, y);
  box.add(drawLayer(scene, 0, 0, slantedRect(S.chip.width, S.chip.height), { fill: S.fill, alpha: 0.96, edge: S.edge, edgeAlpha: 1, edgeWidth: 3, glow: { color: S.glow, strength: 0.5, height: 0.9 } }));
  const glyphX = -S.chip.width / 2 + 28;
  box.add(drawGlyph(scene, "demote", glyphX, 0, 28, 0xffffff, 1, 3.5));
  const label = scene.add.text(glyphX + 20, 0, t("duel.defense.weakenedMark"), textStyle({ role: "display", size: 24, color: S.text })).setOrigin(0, 0.5);
  squeezeTextToWidth(label, S.chip.width / 2 + 28 - 20 - 12);
  box.add(label);
  parent.add(box);
  if (!reduceMotion) {
    const tween = scene.tweens.add({ targets: box, alpha: S.pulse.from, scale: 1.06, duration: S.pulse.durationMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    box.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  }
  return box;
}
