import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { BIO_MAX_LENGTH, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, nicknameProblem } from "../core/playerCard";
import { playerCardManager } from "../managers/PlayerCardManager";
import { profileModifierManager, MAX_EQUIPPED_PROFILE_MODIFIERS } from "../managers/ProfileModifierManager";
import { relicCollection } from "../managers/RelicCollectionManager";
import { chipPoints, drawLayer, drawShapeInnerGlow, drawShapeOutline, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, PROFILE_MODIFIER_RARITY_COLOR, textStyle } from "./theme";
import { Button } from "./Button";
import { TextInputField } from "./TextInputField";
import { drawGlyph } from "./glyphs";
import { addCategoryTab } from "./CategoryTab";
import { FaceFrame } from "./FaceFrame";
import { ProfileAvatar } from "./ProfileAvatar";
import { AVATAR_PICKER, avatarPickerHeight, compactProfileText, MODIFIER_PICKER, modifierPickerHeight, TEXT_EDITOR } from "./playerProfileLayout";
import { session } from "../state/session";
import { playerProfileDisplay, profileAvatarContent } from "../state/playerProfile";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/**
 * 프로필 카드의 요소를 하나씩 고치는 작은 창들.
 *
 * **편집 탭을 따로 두지 않는다** — 고칠 것을 카드에서 바로 누르면 그것만 고치는 창이 뜬다.
 * 얼굴을 누르면 사진·테두리, 이름을 누르면 닉네임, 소개 줄을 누르면 한 줄 소개, 수식어 줄을 누르면
 * 수식어다. 창은 카드 위에 겹치지 않고 카드를 닫은 자리에 서며, 닫히면 카드가 새 값으로 다시 선다.
 * 검증과 저장은 매니저가 한다.
 */

/** 사진·테두리 선택창 — 위에 지금 모습의 미리보기, 그 아래 두 라벨로 목록을 갈아 끼운다. 누르는 즉시 입는다. */
export function openAvatarPicker(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void, startTab: "photo" | "frame" = "photo"): void {
  const owned = relicCollection.owned;
  const frames = playerCardManager.frames();
  const height = avatarPickerHeight(owned.length, frames.length);
  const top = -height / 2;
  let tab = startTab;
  layer.open({ width: AVATAR_PICKER.width, height, title: t("profile.picker.title"), dim: true, closeOnBackdrop: true, onClose: onDone }, (body) => {
    const preview = scene.add.container(0, top + AVATAR_PICKER.preview.y);
    const tabs = scene.add.container(0, top + AVATAR_PICKER.tabs.y);
    const list = scene.add.container(0, top);
    body.add([preview, tabs, list]);

    const current = () => playerProfileDisplay(session, profileModifierManager.equipped());
    const paintPreview = (): void => {
      preview.removeAll(true);
      const profile = current();
      preview.add(new ProfileAvatar(scene, 0, 0, {
        size: AVATAR_PICKER.preview.size, frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId,
        fallback: profileAvatarContent(profile, () => false).fallback,
      }));
    };

    const paintTabs = (): void => {
      tabs.removeAll(true);
      const { width, height: tabHeight, gap } = AVATAR_PICKER.tabs;
      ([["photo", "profile.picker.photo"], ["frame", "profile.picker.frame"]] as const).forEach(([id, labelKey], index) => {
        addCategoryTab(scene, tabs, {
          x: (index - 0.5) * (width + gap), y: 0, width, height: tabHeight, label: t(labelKey), selected: tab === id, face: "down",
          onSelect: () => { if (tab === id) return; tab = id; paintTabs(); paintList(); },
        });
      });
    };

    const paintList = (): void => {
      list.removeAll(true);
      const profile = current();
      if (tab === "photo") {
        const { columns, cell, gap } = AVATAR_PICKER.photos;
        owned.forEach((relic, index) => {
          const x = ((index % columns) - (columns - 1) / 2) * (cell + gap);
          const y = AVATAR_PICKER.photos.top + cell / 2 + Math.floor(index / columns) * (cell + gap);
          const chosen = profile.avatar?.relicId === relic.id;
          const item = scene.add.container(x, y);
          item.add(new FaceFrame(scene, 0, 0, { portraitAssetId: relic.portraitAssetId, size: cell, color: chosen ? COLOR.accent : COLOR.inkDimHex }));
          if (chosen) {
            const shape = chipPoints(cell + 10, cell + 10, { bevel: { topLeft: (cell + 10) * 0.24, topRight: 0, bottomRight: (cell + 10) * 0.24, bottomLeft: 0 } });
            item.add(drawShapeInnerGlow(scene, 0, 0, shape, { color: COLOR.accent, strength: 0.6, bands: 5 }));
            item.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 1, width: 5 }));
          }
          const hit = scene.add.rectangle(0, 0, cell, cell, 0xffffff, 0).setInteractive({ useHandCursor: true });
          hit.on("pointerdown", () => item.setScale(1.06));
          hit.on("pointerout", () => item.setScale(1));
          hit.on("pointerup", () => {
            item.setScale(1);
            if (chosen) return;
            playerCardManager.setAvatar(relic.id);
            paintPreview(); paintList();
          });
          item.add(hit);
          list.add(item);
        });
        return;
      }
      const { columns, width, height: cellHeight, gap, avatarSize } = AVATAR_PICKER.frames;
      frames.forEach(({ frame, unlocked }, index) => {
        const x = ((index % columns) - (columns - 1) / 2) * (width + gap);
        const y = AVATAR_PICKER.frames.top + cellHeight / 2 + Math.floor(index / columns) * (cellHeight + gap);
        const chosen = profile.frameId === frame.id;
        const item = scene.add.container(x, y);
        const plate = chipPoints(width, cellHeight, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } });
        item.add(drawLayer(scene, 0, 0, plate, { fill: chosen ? 0x1b2836 : 0x0c1118, alpha: HOLO.glass, edge: chosen ? frame.color : undefined, edgeAlpha: 0.9 }));
        // 칸마다 **지금 얼굴에 그 테두리를 씌운 모습**을 세운다 — 이름만 보고는 어떤 장식인지 모른다.
        const sample = new ProfileAvatar(scene, 0, -34, {
          size: avatarSize, frameId: frame.id, portraitAssetId: profile.avatar?.portraitAssetId,
          fallback: profileAvatarContent(profile, () => false).fallback,
        });
        if (!unlocked) sample.setAlpha(0.55);
        item.add(sample);
        item.add(scene.add.text(0, cellHeight / 2 - 58, frame.displayName, textStyle({ role: "emphasis", size: 24, color: chosen ? hex(frame.color) : COLOR.ink })).setOrigin(0.5));
        if (!unlocked) {
          item.add(drawGlyph(scene, "lock", -30, cellHeight / 2 - 24, 22, COLOR.inkDimHex));
          item.add(scene.add.text(-12, cellHeight / 2 - 24, t("profile.edit.frameLocked", { level: frame.unlockLevel }), textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5));
        }
        const hit = scene.add.rectangle(0, 0, width, cellHeight, 0xffffff, 0).setInteractive({ useHandCursor: unlocked });
        hit.on("pointerup", () => {
          if (!unlocked || chosen) return;
          playerCardManager.setFrame(frame.id);
          paintPreview(); paintList();
        });
        item.add(hit);
        list.add(item);
      });
    };

    paintPreview();
    paintTabs();
    paintList();
  });
}

interface TextEditorOptions {
  titleKey: TextKey;
  value: string;
  maxGlyphs: number;
  /** 문제가 있으면 그 문장을 돌려준다. 저장하지 않고 그 자리에 붉게 적는다. */
  validate?: (value: string) => string | undefined;
  save: (value: string) => void;
  /** 입력 칸 위에 서는 주의 한 줄(닉네임의 변경 주기). 비우면 그 줄이 없다. */
  notice?: string;
  /** 지금은 고칠 수 없으면 그 이유 — 저장이 꺼지고 이 문장이 붉게 선다. */
  locked?: string;
}

/** 한 줄을 고치는 창 — 입력 칸, 글자 수, 저장. 누른 요소만 고친다. */
function openTextEditor(scene: Phaser.Scene, layer: PopupLayer, options: TextEditorOptions, onDone: () => void): void {
  layer.open({ width: TEXT_EDITOR.width, height: TEXT_EDITOR.height, title: t(options.titleKey), dim: true, closeOnBackdrop: true, onClose: onDone }, (body, close) => {
    const count = scene.add.text(TEXT_EDITOR.field.width / 2, TEXT_EDITOR.noteY, "", textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
    const error = scene.add.text(-TEXT_EDITOR.field.width / 2, TEXT_EDITOR.noteY, "", textStyle({ role: "body", size: 22, color: COLOR.dangerText })).setOrigin(0, 0.5);
    const paint = (value: string): void => { count.setText(`${Array.from(value).length} / ${options.maxGlyphs}`); error.setText(""); };
    const field = new TextInputField(scene, 0, TEXT_EDITOR.fieldY, {
      ...TEXT_EDITOR.field, value: options.value, maxGlyphs: options.maxGlyphs, ariaLabel: t(options.titleKey), onChange: paint,
    });
    paint(options.value);
    body.add([field, count, error]);
    if (options.notice) {
      body.add(scene.add.text(-TEXT_EDITOR.field.width / 2, TEXT_EDITOR.noticeY, options.notice, textStyle({ role: "body", size: 22, color: COLOR.accentText })).setOrigin(0, 0.5));
    }
    if (options.locked) error.setText(options.locked);
    const save = new Button(scene, 0, TEXT_EDITOR.saveY, {
      ...TEXT_EDITOR.save, label: t("profile.edit.save"), fontSize: 28, variant: "primary",
      onClick: () => {
        if (options.locked) return;
        const problem = options.validate?.(field.value);
        if (problem) { error.setText(problem); return; }
        options.save(field.value);
        close();
      },
    });
    save.setEnabled(!options.locked);
    body.add(save);
  });
}

const NICKNAME_PROBLEM: Record<string, TextKey> = {
  tooShort: "profile.edit.error.tooShort",
  tooLong: "profile.edit.error.tooLong",
  invalidCharacter: "profile.edit.error.invalidCharacter",
};

export function openNicknameEditor(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void): void {
  const lockedUntil = playerCardManager.nicknameLockedUntil();
  openTextEditor(scene, layer, {
    titleKey: "profile.edit.nickname",
    value: playerCardManager.card.nickname,
    maxGlyphs: NICKNAME_MAX_LENGTH,
    notice: t("profile.edit.nicknameCooldown"),
    locked: lockedUntil ? t("profile.edit.nicknameLocked", { time: lockedUntil.toLocaleString() }) : undefined,
    // 비워 둘 수 없다 — 비웠다 다시 적는 것이 「처음 정하는 이름」이 되어 주기를 비껴간다.
    validate: (value) => {
      const problem = nicknameProblem(value);
      return problem ? t(NICKNAME_PROBLEM[problem], { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH }) : undefined;
    },
    save: (value) => { playerCardManager.setNickname(value); },
  }, onDone);
}

export function openBioEditor(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void): void {
  openTextEditor(scene, layer, {
    titleKey: "profile.edit.bio",
    value: playerCardManager.card.bio,
    maxGlyphs: BIO_MAX_LENGTH,
    save: (value) => playerCardManager.setBio(value),
  }, onDone);
}

/** 수식어 고르기 — 얻은 것만 서고 최대 셋. 고른 순서가 카드에 서는 순서다. */
export function openModifierPicker(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void): void {
  const earned = profileModifierManager.earned();
  let chosen = profileModifierManager.equipped().map(({ id }) => id);
  const height = modifierPickerHeight(earned.length);
  const top = -height / 2;
  layer.open({ width: MODIFIER_PICKER.width, height, title: t("profile.edit.modifier", { max: MAX_EQUIPPED_PROFILE_MODIFIERS }), dim: true, closeOnBackdrop: true, onClose: onDone }, (body, close) => {
    const grid = scene.add.container(0, top);
    body.add(grid);
    const { columns, cell, gap } = MODIFIER_PICKER;
    const rows = Math.max(1, Math.ceil(earned.length / columns));
    const paint = (): void => {
      grid.removeAll(true);
      earned.forEach((modifier, index) => {
        const x = ((index % columns) - (columns - 1) / 2) * (cell.width + gap);
        const y = MODIFIER_PICKER.top + cell.height / 2 + Math.floor(index / columns) * (cell.height + gap);
        const order = chosen.indexOf(modifier.id);
        const on = order >= 0;
        const color = PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity];
        const shape = chipPoints(cell.width, cell.height, { bevel: { topLeft: 14, topRight: 0, bottomRight: 14, bottomLeft: 0 } });
        const item = scene.add.container(x, y);
        item.add(drawLayer(scene, 0, 0, shape, { fill: 0x161d26, alpha: on ? 0.96 : HOLO.glass, edge: color, edgeAlpha: on ? 1 : 0.4 }));
        if (on) item.add(drawShapeOutline(scene, 0, 0, shape, { color, alpha: 0.9, width: 3 }));
        item.add(scene.add.text(0, 0, compactProfileText(modifier.displayName, 9), textStyle({ role: "emphasis", size: 22, color: on ? hex(color) : COLOR.inkDim })).setOrigin(0.5));
        if (on) item.add(scene.add.text(cell.width / 2 - 14, -cell.height / 2 + 13, String(order + 1), textStyle({ role: "display", size: 18, color: hex(color) })).setOrigin(1, 0.5));
        const hit = scene.add.rectangle(0, 0, cell.width, cell.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => {
          if (on) chosen = chosen.filter((id) => id !== modifier.id);
          else if (chosen.length < MAX_EQUIPPED_PROFILE_MODIFIERS) chosen = [...chosen, modifier.id];
          paint();
        });
        item.add(hit);
        grid.add(item);
      });
    };
    paint();
    const saveY = top + MODIFIER_PICKER.top + rows * (cell.height + gap) + MODIFIER_PICKER.saveGap;
    body.add(new Button(scene, 0, saveY, {
      ...MODIFIER_PICKER.save, label: t("profile.edit.save"), fontSize: 28, variant: "primary",
      onClick: () => { profileModifierManager.equip(chosen); close(); },
    }));
  });
}
