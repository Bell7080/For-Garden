import { openNicknamePopup } from "./NicknamePopup";
import Phaser from "phaser";
import { slideTabPage } from "./screenTransition";
import { t, type TextKey } from "../i18n";
import { BIO_MAX_LENGTH } from "../core/playerCard";
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
import { AVATAR_PICKER, avatarPickerHeight, compactProfileText, TEXT_EDITOR } from "./playerProfileLayout";
import { session } from "../state/session";
import { playerProfileDisplay, profileAvatarContent } from "../state/playerProfile";
import { pressIn, pressOut } from "./pressFeedback";
import { PROFILE_MODIFIERS, type ProfileModifierDefinition } from "../data/profileModifiers";
import { frameUnlockText, modifierUnlockText } from "./profileUnlockText";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/**
 * 프로필 카드의 요소를 하나씩 고치는 작은 창들.
 *
 * **편집 탭을 따로 두지 않는다** — 고칠 것을 카드에서 바로 누르면 그것만 고치는 창이 뜬다.
 * 얼굴을 누르면 사진·테두리·수식어를 한 창에서 고치고, 이름을 누르면 닉네임, 소개 줄을 누르면 한 줄 소개다. 창은 카드 위에 겹치지 않고 카드를 닫은 자리에 서며, 닫히면 카드가 새 값으로 다시 선다.
 * 검증과 저장은 매니저가 한다.
 */

/**
 * 사진·테두리·수식어 선택창 — 위에 미리보기, 그 아래 이름과 해금 조건, 그 아래 세 라벨로 목록을 갈아 끼운다.
 * 사진·테두리 탭의 미리보기는 지금 모습이고, 수식어 탭은 얼굴 대신 수식어 칩이 선다. 열린 것은 누르는 즉시 입고,
 * 잠긴 것은 입지 못하지만 눌러 보면 미리보기와 해금 조건이 뜬다.
 */
export function openAvatarPicker(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void, startTab: "photo" | "frame" | "modifier" = "photo"): void {
  const owned = relicCollection.owned;
  const frames = playerCardManager.frames();
  const modifiers = PROFILE_MODIFIERS;
  const height = avatarPickerHeight(owned.length, frames.length, modifiers.length);
  const top = -height / 2;
  let tab = startTab;
  // 목록에서 마지막으로 누른 것 — 미리보기와 아래 문장이 이것을 따라간다. 없으면 지금 입은 것이다.
  let focusFrameId: string | undefined;
  let focusModifierId: string | undefined;
  let focusRelicId: string | undefined;
  layer.open({ width: AVATAR_PICKER.width, height, title: t("profile.picker.title"), dim: true, closeOnBackdrop: true, onClose: onDone }, (body) => {
    const preview = scene.add.container(0, top + AVATAR_PICKER.preview.y);
    const tabs = scene.add.container(0, top + AVATAR_PICKER.tabs.y);
    const list = scene.add.container(0, top);
    const info = scene.add.container(0, top);
    body.add([preview, info, tabs, list]);

    const current = () => playerProfileDisplay(session, profileModifierManager.equipped());
    const focusedFrame = () => frames.find(({ frame }) => frame.id === (focusFrameId ?? current().frameId))?.frame;
    const focusedModifier = (): ProfileModifierDefinition | undefined => {
      const id = focusModifierId ?? profileModifierManager.equipped()[0]?.id;
      return modifiers.find((modifier) => modifier.id === id) ?? modifiers[0];
    };

    const paintPreview = (): void => {
      preview.removeAll(true);
      const profile = current();
      if (tab === "modifier") {
        // 수식어 탭에서는 얼굴 대신 그 수식어의 레이어가 가운데에 선다.
        const modifier = focusedModifier();
        if (!modifier) return;
        const { width, height: chipHeight } = AVATAR_PICKER.info.previewChip;
        const color = PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity];
        preview.add(drawLayer(scene, 0, 0, chipPoints(width, chipHeight, { bevel: { topLeft: 20, topRight: 0, bottomRight: 20, bottomLeft: 0 } }), { fill: 0x161d26, alpha: 0.96, edge: color, edgeAlpha: 1 }));
        preview.add(scene.add.text(0, 0, compactProfileText(modifier.displayName, 9), textStyle({ role: "display", size: 34, color: hex(color) })).setOrigin(0.5));
        return;
      }
      // 테두리 탭은 누른 테두리를, 사진 탭은 누른 사진을 지금 얼굴에 씌워 보여 준다(잠긴 것도 미리 볼 수 있다).
      const frameId = tab === "frame" ? focusedFrame()?.id ?? profile.frameId : profile.frameId;
      const portraitAssetId = tab === "photo" && focusRelicId ? owned.find((relic) => relic.id === focusRelicId)?.portraitAssetId : undefined;
      preview.add(new ProfileAvatar(scene, 0, 0, {
        size: AVATAR_PICKER.preview.size, frameId, portraitAssetId: portraitAssetId ?? profile.avatar?.portraitAssetId,
        fallback: profileAvatarContent(profile, () => false).fallback,
      }));
    };

    /** 미리보기 아래 두 줄 — 고른 것의 이름과 입은 상태/해금 조건. */
    const paintInfo = (): void => {
      info.removeAll(true);
      const profile = current();
      let name = ""; let line = ""; let tone: string = COLOR.inkDim; let nameTone: string = COLOR.ink;
      if (tab === "photo") {
        const relic = owned.find((candidate) => candidate.id === (focusRelicId ?? profile.avatar?.relicId));
        name = relic?.name ?? "";
        if (relic && profile.avatar?.relicId === relic.id) line = t("profile.picker.equipped");
      } else if (tab === "frame") {
        const frame = focusedFrame();
        if (frame) {
          const unlocked = frames.find((entry) => entry.frame.id === frame.id)?.unlocked ?? false;
          name = frame.displayName; nameTone = hex(frame.color);
          line = !unlocked ? frameUnlockText(frame) : profile.frameId === frame.id ? t("profile.picker.equipped") : t("profile.picker.unlocked");
          if (!unlocked) tone = COLOR.dangerText;
        }
      } else {
        const modifier = focusedModifier();
        if (modifier) {
          const unlocked = profileModifierManager.earned().some(({ id }) => id === modifier.id);
          name = modifier.displayName; nameTone = hex(PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity]);
          const condition = modifierUnlockText(modifier);
          line = unlocked ? [t("profile.picker.unlocked"), condition].filter(Boolean).join(" · ") : condition;
          if (!unlocked) tone = COLOR.dangerText;
        }
      }
      const { nameY, conditionY } = AVATAR_PICKER.info;
      info.add(scene.add.text(0, nameY, name, textStyle({ role: "display", size: 34, color: nameTone })).setOrigin(0.5));
      info.add(scene.add.text(0, conditionY, line, textStyle({ role: "body", size: 24, color: tone, wrap: AVATAR_PICKER.width - 80, align: "center" })).setOrigin(0.5));
    };
    const repaintTop = (): void => { paintPreview(); paintInfo(); };

    const paintTabs = (): void => {
      tabs.removeAll(true);
      const { width, height: tabHeight, gap } = AVATAR_PICKER.tabs;
      const order = ["photo", "frame", "modifier"] as const;
      ([["photo", "profile.picker.photo"], ["frame", "profile.picker.frame"], ["modifier", "profile.picker.modifier"]] as const).forEach(([id, labelKey], index) => {
        addCategoryTab(scene, tabs, {
          x: (index - 1) * (width + gap), y: 0, width, height: tabHeight, label: t(labelKey), selected: tab === id, face: "down",
          onSelect: () => { if (tab === id) return; const from = order.indexOf(tab); tab = id; paintTabs(); repaintTop(); paintList(); slideTabPage(scene, [list], from, index); },
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
          hit.on("pointerdown", () => pressIn(item));
          hit.on("pointerout", () => pressOut(item, "normal", { pop: false }));
          hit.on("pointerup", () => {
            pressOut(item);
            focusRelicId = relic.id; repaintTop();
            if (chosen) return;
            void playerCardManager.setAvatar(relic.id).then(() => { focusRelicId = undefined; repaintTop(); paintList(); }, () => undefined);
          });
          item.add(hit);
          list.add(item);
        });
        return;
      }
      if (tab === "modifier") {
        // 얻지 못한 수식어도 목록에는 서서 무엇이 있는지 보인다. 얻은 것만 눌러 입고 벗는다(최대 셋, 고른 순서가 카드의 순서).
        const { columns, width, height: cellHeight, gap } = AVATAR_PICKER.modifiers;
        const earnedIds = new Set(profileModifierManager.earned().map(({ id }) => id));
        const equippedIds = profileModifierManager.equipped().map(({ id }) => id);
        modifiers.forEach((modifier, index) => {
          const x = ((index % columns) - (columns - 1) / 2) * (width + gap);
          const y = AVATAR_PICKER.modifiers.top + cellHeight / 2 + Math.floor(index / columns) * (cellHeight + gap);
          const unlocked = earnedIds.has(modifier.id);
          const order = equippedIds.indexOf(modifier.id);
          const on = order >= 0;
          const color = PROFILE_MODIFIER_RARITY_COLOR[modifier.rarity];
          const shape = chipPoints(width, cellHeight, { bevel: { topLeft: 14, topRight: 0, bottomRight: 14, bottomLeft: 0 } });
          const item = scene.add.container(x, y);
          item.add(drawLayer(scene, 0, 0, shape, { fill: 0x161d26, alpha: on ? 0.96 : HOLO.glass, edge: color, edgeAlpha: on ? 1 : unlocked ? 0.4 : 0.2 }));
          if (on) item.add(drawShapeOutline(scene, 0, 0, shape, { color, alpha: 0.9, width: 3 }));
          const label = scene.add.text(unlocked ? 0 : 12, 0, compactProfileText(modifier.displayName, 9), textStyle({ role: "emphasis", size: 24, color: on ? hex(color) : COLOR.inkDim })).setOrigin(0.5);
          if (!unlocked) { label.setAlpha(0.55); item.add(drawGlyph(scene, "lock", -width / 2 + 34, 0, 22, COLOR.inkDimHex)); }
          item.add(label);
          const hit = scene.add.rectangle(0, 0, width, cellHeight, 0xffffff, 0).setInteractive({ useHandCursor: unlocked });
          hit.on("pointerup", () => {
            focusModifierId = modifier.id; repaintTop();
            if (!unlocked) return;
            let next: string[];
            if (on) next = equippedIds.filter((id) => id !== modifier.id);
            else next = [...equippedIds, modifier.id].slice(-MAX_EQUIPPED_PROFILE_MODIFIERS);
            void profileModifierManager.equip(next).then(() => { repaintTop(); paintList(); }, () => undefined);
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
          const lockText = scene.add.text(-12, cellHeight / 2 - 24, frame.unlockAchievement ? t("achievement.tier", { current: frame.unlockAchievement.tiers, total: frame.unlockAchievement.tiers }) : t("profile.edit.frameLocked", { level: frame.unlockLevel }), textStyle({ role: "emphasis", size: 20, color: COLOR.inkDim })).setOrigin(0, 0.5);
          item.add(lockText);
        }
        const hit = scene.add.rectangle(0, 0, width, cellHeight, 0xffffff, 0).setInteractive({ useHandCursor: unlocked });
        hit.on("pointerup", () => {
          focusFrameId = frame.id; repaintTop();
          if (!unlocked || chosen) return;
          void playerCardManager.setFrame(frame.id).then(() => { repaintTop(); paintList(); }, () => undefined);
        });
        item.add(hit);
        list.add(item);
      });
    };

    repaintTop();
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
  /** 서버가 반영할 때까지 기다린다. 던지면 창을 닫지 않고 그 자리에 오류를 적는다. */
  save: (value: string) => Promise<unknown>;
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
        save.setEnabled(false);
        options.save(field.value).then(() => close(), (cause: unknown) => {
          save.setEnabled(true);
          error.setText(cause instanceof Error ? cause.message : "");
        });
      },
    });
    save.setEnabled(!options.locked);
    body.add(save);
  });
}

export function openNicknameEditor(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void, required = false): void {
  openNicknamePopup(scene, layer, onDone, required);
}

export function openBioEditor(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void): void {
  openTextEditor(scene, layer, {
    titleKey: "profile.edit.bio",
    value: playerCardManager.card.bio,
    maxGlyphs: BIO_MAX_LENGTH,
    save: (value) => playerCardManager.setBio(value),
  }, onDone);
}
