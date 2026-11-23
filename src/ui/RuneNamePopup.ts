import Phaser from "phaser";
import { t } from "../i18n";
import { GameApiError } from "../api/contracts";
import { MAX_RUNE_NAME_LENGTH, normalizeRuneName, runeNameProblem, type RuneNameProblem } from "../core/runeName";
import { runePartLabel, runeRarityLabel, type RuneInstance } from "../core/runes";
import { Button } from "./Button";
import { chipPoints, drawLayer, drawShapeEdge } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { addRuneFrame, RUNE_ACCENT } from "./runeIcons";
import { shrinkTextToWidth } from "./textFit";
import { TextInputField } from "./TextInputField";
import { COLOR, textStyle } from "./theme";
import { RUNE_NAME_EDITOR } from "./runeNameEditorLayout";

export { RUNE_NAME_EDITOR };


const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

const PROBLEM_TEXT: Record<RuneNameProblem | "banned" | "failed", () => string> = {
  empty: () => t("rune.nameError.empty"),
  tooLong: () => t("rune.nameError.invalid"),
  invalid: () => t("rune.nameError.invalid"),
  banned: () => t("rune.nameError.banned"),
  failed: () => t("rune.nameError.failed"),
};

export interface RuneNamePopupOptions {
  rune: RuneInstance;
  /** 서버에 보내고 반영될 때까지 기다린다. 던지면 창을 닫지 않고 그 자리에 오류를 적는다. */
  save: (name: string) => Promise<void>;
  onClose?: () => void;
}

/**
 * 룬 이름을 고치는 작은 창.
 *
 * 예전에는 화면 위에 브라우저 기본 입력 상자를 그대로 띄워 글꼴·테두리가 게임과 따로 놀았다. 지금은 공용
 * 입력 칸(`TextInputField` — 글자는 Phaser가 게임 글꼴로 그린다)과 공용 팝업 판을 쓰고, 고친 이름이 어떻게
 * 설지를 룬 등급색으로 미리 보여 준다. 글자 수·빈 이름·제어 문자 규칙은 서버와 같은 함수(`runeNameProblem`)가
 * 판정하고, 금칙어만 서버가 따로 본다.
 */
export function openRuneNamePopup(scene: Phaser.Scene, popups: PopupLayer, options: RuneNamePopupOptions): void {
  const L = RUNE_NAME_EDITOR;
  const { rune } = options;
  const accent = RUNE_ACCENT[rune.rarity];
  const rarity = runeRarityLabel(rune.rarity);
  const defaultName = t("rune.named", { rarity });
  popups.open({
    width: L.width, height: L.height, title: t("rune.nameTitle"), dim: true, closeOnBackdrop: true,
    y: Math.round(scene.scale.height * L.centerRatio), onClose: options.onClose,
  }, (body, close) => {
    const top = -L.height / 2;
    const P = L.preview;
    const previewY = top + P.y;
    const plate = chipPoints(P.width, P.height, { bevel: { topLeft: P.bevel, topRight: 0, bottomRight: P.bevel, bottomLeft: 0 } });
    body.add(drawLayer(scene, 0, previewY, plate, { fill: 0x0c1219, alpha: 0.9, shadow: false }));
    body.add(drawShapeEdge(scene, 0, previewY, plate, "top", { color: accent, alpha: 0.85, width: 3 }));
    body.add(addRuneFrame(scene, P.frameX, previewY, P.frame, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved: rune.engravings.length > 0 }));
    body.add(scene.add.text(P.textX, previewY + P.rarityY, `${rarity}  ·  ${runePartLabel(rune.part)}`, textStyle({ role: "emphasis", size: 22, color: hex(accent) })).setOrigin(0, 0.5));
    const nameRoom = P.width / 2 - P.textX - 32;
    const preview = scene.add.text(P.textX, previewY + P.nameY, "", textStyle({ role: "display", size: P.nameSize, color: hex(accent) })).setOrigin(0, 0.5).setStroke("#05070b", 5);
    body.add(preview);

    const count = scene.add.text(L.field.width / 2, top + L.noteY, "", textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
    const error = scene.add.text(-L.field.width / 2, top + L.noteY, "", textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0, 0.5);
    const paint = (value: string): void => {
      const name = normalizeRuneName(value);
      // 비워 두면 기본 이름이 흐리게 선다 — 저장은 되지 않지만 지금 이 룬이 무엇으로 불리는지는 남는다.
      preview.setText(name || defaultName).setAlpha(name ? 1 : 0.45).setScale(1);
      shrinkTextToWidth(preview, nameRoom, { size: P.nameSize, minSize: 24 });
      count.setText(`${Array.from(value).length} / ${MAX_RUNE_NAME_LENGTH}`);
      error.setText("");
    };
    const field = new TextInputField(scene, 0, top + L.field.y, {
      width: L.field.width, height: L.field.height, fontSize: L.field.fontSize,
      value: rune.customName ?? "", maxGlyphs: MAX_RUNE_NAME_LENGTH, ariaLabel: t("rune.nameTitle"),
      placeholder: defaultName, onChange: paint,
    });
    paint(rune.customName ?? "");
    body.add([field, count, error]);

    const save = new Button(scene, 0, top + L.save.y, {
      width: L.save.width, height: L.save.height, fontSize: L.save.fontSize, label: t("rune.nameSave"), variant: "primary",
      onClick: () => {
        const name = normalizeRuneName(field.value);
        const problem = runeNameProblem(name);
        if (problem) { error.setText(PROBLEM_TEXT[problem]()); return; }
        if (name === rune.customName) { close(); return; }
        save.setEnabled(false);
        options.save(name).then(() => close(), (cause: unknown) => {
          if (!save.active) return;
          save.setEnabled(true);
          const code = cause instanceof GameApiError ? cause.code : undefined;
          error.setText(PROBLEM_TEXT[code === "RUNE_NAME_BANNED" ? "banned" : code === "INVALID_RUNE_NAME" ? "invalid" : "failed"]());
        });
      },
    });
    body.add(save);
  });
}
