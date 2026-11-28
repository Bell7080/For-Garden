import Phaser from "phaser";
import { t } from "../i18n";
import { cleanNickname, nicknameProblem, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "../core/playerCard";
import { playerCardManager } from "../managers/PlayerCardManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { UI_ICON } from "./icons";
import { CUTE_GUIDE_TONES, NICKNAME_POPUP as L, nicknamePopupSpots } from "./cuteGuideLayout";
import { addCuteBubble, paintCuteBackdrop } from "./CuteGuidePopup";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { PopupLayer } from "./PopupLayer";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { startPuppetHop } from "./puppetHop";
import { fitTextToBox } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

/**
 * 도디·파루아가 맞아 주는 이름 등록/변경창. 저장 성공 전에는 생성 절차를 완료하지 않는다.
 *
 * 위는 안내 판과 같은 무대(빛살·점 무늬·반짝임) — 둘이 양옆에서 통통 뛰고 가운데 말풍선이 이름을 묻는다. 아래 입력 칸·
 * 글자 수·조건·주기 안내는 예전보다 한 뼘씩 크게 선다(응태 2026-11-28 — 가시성). 자리는 `cuteGuideLayout.ts`가 갖는다.
 */
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
  const spots = nicknamePopupSpots();
  const tone = CUTE_GUIDE_TONES.pink;
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  const S = L.stage;
  layer.open({ width: L.width, height: spots.height, title, dim: true, fill: tone.panel, accent: tone.accent,
    hideCloseButton: required, closeOnBackdrop: !required,
    canClose: () => !pending && (!required || saved), onClose: onDone,
  }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;
    paintCuteBackdrop(scene, body, {
      width: L.width, height: spots.height, stageTop: spots.stageTop, stageBottom: spots.stageBottom,
      rayOrigin: { x: 0, y: spots.stageTop + S.bubble.y }, buttonY: spots.saveY, tone, loops,
    });
    const bubble = addCuteBubble(scene, body, S.bubble.x, spots.stageTop + S.bubble.y, S.bubble.width, S.bubble.height, { tail: S.bubble.tail, tailSide: "bottomLeft" });
    const question = scene.add.text(0, 0, t("profile.nickname.create.question"),
      textStyle({ role: "display", size: S.bubble.size, color: tone.heading, align: "center", wrap: S.bubble.wrap })).setOrigin(.5);
    fitTextToBox(question, { width: S.bubble.wrap, height: S.bubble.height - 30 });
    bubble.add(question);
    if (loops) {
      bubble.setScale(.6).setAlpha(0);
      scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 140, ease: "Back.Out" });
    }
    const ground = spots.stageTop + S.sd.ground;
    // SD는 씬 최상층에 화면 좌표로 선다 — 판 위로 앞서 서야 하고, 이름(`nickname-guide-*`)으로 찾는 검사가 있다.
    ["dodi", "parua"].forEach((id, index) => {
      body.add(scene.add.text(S.sd.xs[index], ground + S.sd.labelDy, getRelic(id).name,
        textStyle({ role: "display", size: S.sd.labelSize, color: COLOR.ink })).setOrigin(.5).setStroke("#05070a", 6));
      void spawnPuppet(scene, sdAssetFor(id), {
        x: body.x + S.sd.xs[index], groundY: body.y + ground, height: S.sd.height, depth,
      }).then((figure) => {
        if (disposed) { figure.destroy(); return; }
        figure.setName(`nickname-guide-${id}`);
        figure.disableInteractive();
        figures.push(figure);
        shadows.push(addSdFootShadow(scene, body.x + S.sd.xs[index], body.y + ground, S.sd.shadow).setDepth(depth - .1));
        hops.push(startPuppetHop(scene, figure, index, loops ? {} : { once: true }));
      }).catch((error) => logError("puppet.display", "닉네임 안내 SD 표시 실패", error, { relic: String(id) }));
    });
    body.add(scene.add.text(-L.field.width / 2, spots.fieldLabelY, t("profile.edit.nickname"),
      textStyle({ role: "display", size: L.fieldLabelSize, color: COLOR.ink })).setOrigin(0, .5));
    const count = scene.add.text(L.field.width / 2, spots.countY, "", textStyle({ role: "emphasis", size: L.countSize, color: COLOR.inkDim })).setOrigin(1, .5);
    const error = scene.add.text(-L.field.width / 2, spots.countY, "", textStyle({ role: "emphasis", size: L.countSize, color: COLOR.dangerText, wrap: 620 })).setOrigin(0, .5);
    const problemText = (problem: string): string => t(problem === "tooShort" ? "profile.edit.error.tooShort"
      : problem === "tooLong" ? "profile.edit.error.tooLong" : problem === "banned" ? "profile.edit.error.banned" : "profile.edit.error.invalidCharacter",
    { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH });
    let save: Button | undefined;
    const field = new TextInputField(scene, 0, spots.fieldY, { ...L.field,
      palette: { fill: 0xfdfbf7, fillAlpha: 1, ink: tone.heading, placeholder: "#9a8f9a", accent: tone.accent },
      value: playerCardManager.card.nickname, maxGlyphs: NICKNAME_MAX_LENGTH, ariaLabel: t("profile.edit.nickname"),
      onChange: (value) => {
        count.setText(`${Array.from(cleanNickname(value)).length} / ${NICKNAME_MAX_LENGTH}`);
        error.setText("");
        save?.setEnabled(!pending && !lockedUntil && nicknameProblem(value) === undefined);
      },
    });
    body.add([field, count, error]);
    const help = new IconButton(scene, L.field.width / 2 - L.help.size / 2, spots.fieldLabelY, { icon: UI_ICON.back, centerText: "?", size: L.help.size,
      onClick: () => {
        // DOM 입력이 안내 쪽지 위에서 키보드를 열지 않게, 도움말이 열린 동안 입력을 숨긴다.
        field.setVisible(false);
        layer.open({ width: 820, height: 760, title: t("profile.nickname.help.title"), dim: true, closeOnBackdrop: true,
          onClose: () => { if (field.active) field.setVisible(true); },
        }, (tip) => {
          const text = scene.add.text(0, -270, t("profile.nickname.help.body"),
            textStyle({ role: "body", size: 30, color: COLOR.ink, wrap: 700, lineSpacing: 12 })).setOrigin(.5, 0);
          fitTextToBox(text, { width: 700, height: 560 });
          tip.add(text);
        });
      },
    });
    body.add(help);
    count.setText(`${Array.from(cleanNickname(field.value)).length} / ${NICKNAME_MAX_LENGTH}`);
    body.add(scene.add.text(-L.field.width / 2, spots.rulesY, t("profile.nickname.requirements", { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH }),
      textStyle({ role: "body", size: L.rulesSize, color: COLOR.ink, wrap: L.field.width, lineSpacing: 8 })).setOrigin(0, 0));
    body.add(scene.add.text(0, spots.noticeY, t("profile.edit.nicknameCooldown"),
      textStyle({ role: "emphasis", size: L.noticeSize, color: `#${tone.ray.toString(16).padStart(6, "0")}`, wrap: L.field.width, align: "center" })).setOrigin(.5));
    if (lockedUntil) error.setText(t("profile.edit.nicknameLocked", { time: lockedUntil.toLocaleString() }));
    save = new Button(scene, 0, spots.saveY, { ...L.save,
      label: t(creating ? "profile.nickname.create.save" : "profile.edit.save"), variant: "primary", fill: tone.button, decorDots: true,
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
