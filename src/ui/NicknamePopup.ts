import Phaser from "phaser";
import { t } from "../i18n";
import { cleanNickname, nicknameProblem, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "../core/playerCard";
import { playerCardManager } from "../managers/PlayerCardManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { UI_ICON } from "./icons";
import { NICKNAME_POPUP as L } from "./nicknamePopupLayout";
import type { PopupLayer } from "./PopupLayer";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { startPuppetHop } from "./puppetHop";
import { COLOR, textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

/** 도디·파루아가 맞아 주는 이름 등록/변경창. 저장 성공 전에는 생성 절차를 완료하지 않는다. */
export function openNicknamePopup(scene: Phaser.Scene, layer: PopupLayer, onDone: () => void, required = false): void {
  const creating = playerCardManager.card.nickname === "";
  const lockedUntil = playerCardManager.nicknameLockedUntil();
  let pending = false, saved = false, disposed = false;
  const figures: PuppetCreature[] = [];
  const hops: Phaser.Tweens.Tween[] = [];
  const shadows: Phaser.GameObjects.Container[] = [];
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    hops.forEach((hop) => hop.stop());
    figures.forEach((figure) => figure.destroy());
    shadows.forEach((shadow) => shadow.destroy());
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  const title = t(creating ? "profile.nickname.create.title" : "profile.edit.nickname");
  layer.open({ width: L.width, height: L.height, title, dim: true,
    hideCloseButton: required, closeOnBackdrop: !required,
    canClose: () => !pending && (!required || saved), onClose: onDone,
  }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;
    body.add(scene.add.text(0, L.questionY, t("profile.nickname.create.question"),
      textStyle({ role: "body", size: 32, color: COLOR.ink, align: "center", wrap: 740 })).setOrigin(.5));
    ["dodo", "parua"].forEach((id, index) => {
      body.add(scene.add.text(L.sd.xs[index], L.sd.labelY, getRelic(id).name,
        textStyle({ role: "body", size: 22, color: COLOR.accentText })).setOrigin(.5));
      void spawnPuppet(scene, sdAssetFor(id), {
        x: body.x + L.sd.xs[index], groundY: body.y + L.sd.groundY, height: L.sd.height, depth,
      }).then((figure) => {
        if (disposed) { figure.destroy(); return; }
        figure.setName(`nickname-guide-${id}`);
        figure.disableInteractive();
        figures.push(figure);
        shadows.push(addSdFootShadow(scene, body.x + L.sd.xs[index], body.y + L.sd.groundY, 130).setDepth(depth - .1));
        hops.push(startPuppetHop(scene, figure, index, { once: true }));
      }).catch((error) => logError("puppet.display", "닉네임 안내 SD 표시 실패", error, { relic: String(id) }));
    });
    body.add(scene.add.text(-L.field.width / 2, L.fieldLabelY, t("profile.edit.nickname"),
      textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, .5));
    const help = new IconButton(scene, L.help.x, L.help.y, { icon: UI_ICON.back, centerText: "?", size: L.help.size,
      onClick: () => {
        // DOM 입력이 안내 쪽지 위에서 키보드를 열지 않게, 도움말이 열린 동안 입력을 숨긴다.
        field.setVisible(false);
        layer.open({ width: 800, height: 720, title: t("profile.nickname.help.title"), dim: true, closeOnBackdrop: true,
          onClose: () => { if (field.active) field.setVisible(true); },
        }, (tip) => {
          tip.add(scene.add.text(0, -240, t("profile.nickname.help.body"),
            textStyle({ role: "body", size: 26, color: COLOR.ink, wrap: 660, lineSpacing: 10 })).setOrigin(.5, 0));
        });
      },
    });
    body.add(help);
    const count = scene.add.text(L.field.width / 2, L.countY, "", textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(1, .5);
    const error = scene.add.text(-L.field.width / 2, L.countY, "", textStyle({ role: "body", size: 23, color: COLOR.dangerText, wrap: 580 })).setOrigin(0, .5);
    const problemText = (problem: string): string => t(problem === "tooShort" ? "profile.edit.error.tooShort"
      : problem === "tooLong" ? "profile.edit.error.tooLong" : "profile.edit.error.invalidCharacter",
    { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH });
    let save: Button | undefined;
    const field = new TextInputField(scene, 0, L.fieldY, { ...L.field,
      value: playerCardManager.card.nickname, maxGlyphs: NICKNAME_MAX_LENGTH, ariaLabel: t("profile.edit.nickname"),
      onChange: (value) => {
        count.setText(`${Array.from(cleanNickname(value)).length} / ${NICKNAME_MAX_LENGTH}`);
        error.setText("");
        save?.setEnabled(!pending && !lockedUntil && nicknameProblem(value) === undefined);
      },
    });
    body.add([field, count, error]);
    count.setText(`${Array.from(cleanNickname(field.value)).length} / ${NICKNAME_MAX_LENGTH}`);
    body.add(scene.add.text(-L.field.width / 2, L.rulesY, t("profile.nickname.requirements", { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH }),
      textStyle({ role: "body", size: 24, color: COLOR.inkDim, wrap: L.field.width, lineSpacing: 6 })).setOrigin(0, 0));
    body.add(scene.add.text(0, L.noticeY, t("profile.edit.nicknameCooldown"),
      textStyle({ role: "body", size: 22, color: COLOR.accentText, wrap: L.field.width, align: "center" })).setOrigin(.5));
    if (lockedUntil) error.setText(t("profile.edit.nicknameLocked", { time: lockedUntil.toLocaleString() }));
    save = new Button(scene, 0, L.saveY, { ...L.save,
      label: t(creating ? "profile.nickname.create.save" : "profile.edit.save"), fontSize: 30, variant: "primary",
      onClick: () => {
        if (pending || lockedUntil || disposed) return;
        const problem = nicknameProblem(field.value);
        if (problem) { error.setText(problemText(problem)); return; }
        pending = true; save!.setEnabled(false);
        void playerCardManager.setNickname(field.value).then((result) => {
          pending = false;
          if (disposed) return;
          if (result.ok) { saved = true; close(); return; }
          error.setText(result.reason === "nicknameCooldown" ? t("profile.edit.nicknameCooldown") : problemText(result.reason));
          save!.setEnabled(true);
        }).catch(() => {
          pending = false;
          if (disposed) return;
          error.setText(t("profile.edit.error.save")); save!.setEnabled(true);
        });
      },
    });
    save.setEnabled(!lockedUntil && nicknameProblem(field.value) === undefined);
    body.add(save);
  });
}
