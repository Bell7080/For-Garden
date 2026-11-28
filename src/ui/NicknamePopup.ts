import Phaser from "phaser";
import { t } from "../i18n";
import { cleanNickname, nicknameProblem, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from "../core/playerCard";
import { playerCardManager } from "../managers/PlayerCardManager";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { PopupLayer } from "./PopupLayer";
import { NICKNAME_POPUP as L } from "./candyNoticeLayout";
import { paintCandyBackdrop } from "./candyBackdrop";
import { addCandySparkles, addCandyWordmark, drawCandyPlate } from "./candyPopupKit";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { addSdFootShadow } from "./SdFootShadow";
import { TextInputField } from "./TextInputField";
import { pressIn, pressOut } from "./pressFeedback";
import { startPuppetHop } from "./puppetHop";
import { fitTextToBox, shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

/** 맨 위 굵은 제목 글자. 어느 언어에서나 같은 표식이라 번역하지 않는다. */
const NICKNAME_WORDMARK = "NICKNAME";
const NICKNAME_GUIDES = ["dodi", "parua"] as const;

/** 그림자 없는 동그란 사탕 「?」 단추 — 옆 이름표를 덮지 않게 판 그림자를 깔지 않는다. */
function addCandyHelpButton(scene: Phaser.Scene, x: number, y: number, size: number, onClick: () => void): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const r = size / 2;
  const g = scene.add.graphics();
  g.fillStyle(TONE.ink, 1).fillCircle(0, 0, r + 4);
  g.fillStyle(TONE.rim, 1).fillCircle(0, 0, r);
  g.fillStyle(TONE.cream, 1).fillCircle(0, 0, r - 6);
  g.fillStyle(0xffffff, 0.85).fillEllipse(-r * 0.25, -r * 0.5, r * 0.7, r * 0.22);
  const mark = scene.add.text(0, 2, "?", textStyle({ role: "display", size: Math.round(size * 0.6), color: TONE.inkText })).setOrigin(.5);
  const hit = scene.add.circle(0, 0, r + 14, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(button));
  hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(button); onClick(); });
  button.add([g, mark, hit]);
  return button;
}

/** 가운데 말풍선 — 양쪽 아래로 꼬리를 내려 두 SD를 함께 가리킨다. */
function addCenterBubble(scene: Phaser.Scene, body: Phaser.GameObjects.Container, text: string, animate: boolean): void {
  const { bubble } = L;
  const box = scene.add.container(bubble.x, bubble.y);
  const tails = scene.add.graphics();
  for (const side of [-1, 1]) {
    const ex = side * (bubble.width / 2 - 40), ey = bubble.height / 2 - 8;
    tails.fillStyle(TONE.ink, 1).fillTriangle(ex - 26, ey - 10, ex + 26, ey - 10, ex + side * (bubble.tail + 30), ey + bubble.tail + 9);
    tails.fillStyle(TONE.rim, 1).fillTriangle(ex - 18, ey - 10, ex + 18, ey - 10, ex + side * (bubble.tail + 22), ey + bubble.tail);
  }
  box.add([tails, drawCandyPlate(scene, 0, 0, bubble.width, bubble.height, bubble.radius, bubble.rim, bubble.outline)]);
  const question = scene.add.text(0, 2, text, textStyle({ role: "display", size: bubble.size, color: TONE.inkText, align: "center", wrap: bubble.width - 60, lineSpacing: 8 })).setOrigin(.5);
  fitTextToBox(question, { width: bubble.width - 60, height: bubble.height - 40 });
  box.add(question);
  body.add(box);
  if (!animate) return;
  box.setScale(.6).setAlpha(0);
  scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 320, delay: 140, ease: "Back.Out", onComplete: () => {
    if (box.active) scene.tweens.add({ targets: box, y: bubble.y - 6, duration: 1500, ease: "Sine.InOut", yoyo: true, repeat: -1 });
  } });
}

/**
 * 도디·파루아가 맞아 주는 이름 등록/변경창. 저장 성공 전에는 생성 절차를 완료하지 않는다.
 *
 * 피드백 창과 같은 사탕 결이다(응태 2026-11-28) — 굵은 제목 글자, 양옆에서 통통 뛰는 두 SD와 가운데 말풍선,
 * 크림빛 입력 카드, 큰 글자 수·조건, 사탕 저장 단추. 처음 정하는 이름(`required`)은 닫을 수 없다.
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
  const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  const loops = motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  layer.open({ width: L.width, height: L.height, title, dim: true,
    hideCloseButton: required, closeOnBackdrop: !required,
    canClose: () => !pending && (!required || saved), onClose: onDone,
  }, (body, close) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    const depth = (body.parentContainer?.depth ?? 0) + 1;
    paintCandyBackdrop(scene, body, { width: L.width, height: L.height, top: L.backdrop.top, bottom: L.backdrop.bottom, glowY: L.wordmark.y, loot: L.loot }, animate);
    addCandyWordmark(scene, body, NICKNAME_WORDMARK, L.wordmark, animate);
    addCandySparkles(scene, body, L.sparkles, animate);
    addCenterBubble(scene, body, t("profile.nickname.create.question"), animate);

    // SD는 씬 최상층에 화면 좌표로 선다 — 판 위로 앞서 서야 하고, 이름(`nickname-guide-*`)으로 찾는 검사가 있다.
    NICKNAME_GUIDES.forEach((id, index) => {
      const x = L.sd.xs[index];
      body.add(scene.add.text(x, L.nameY, getRelic(id).name, textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(.5).setStroke(TONE.inkText, 7));
      void spawnPuppet(scene, sdAssetFor(id), { x: body.x + x, groundY: body.y + L.sd.groundY, height: L.sd.height, depth }).then((figure) => {
        if (disposed) { figure.destroy(); return; }
        figure.setName(`nickname-guide-${id}`);
        figure.disableInteractive();
        figures.push(figure);
        shadows.push(addSdFootShadow(scene, body.x + x, body.y + L.sd.groundY, L.sd.shadowWidth).setDepth(depth - .1));
        hops.push(startPuppetHop(scene, figure, index, loops ? {} : { once: true }));
      }).catch((error) => logError("puppet.display", "닉네임 안내 SD 표시 실패", error, { relic: String(id) }));
    });

    // 이름표 줄 — 왼쪽 이름표, 오른쪽 끝 「?」.
    const label = scene.add.text(L.labelX, L.labelY, t("profile.edit.nickname"), textStyle({ role: "display", size: L.labelSize, color: TONE.inkText })).setOrigin(0, .5);
    shrinkTextToWidth(label, L.help.x - L.help.size / 2 - 30 - L.labelX);
    body.add(label);
    body.add(addCandyHelpButton(scene, L.help.x, L.labelY, L.help.size, () => {
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
    }));

    // 입력 카드.
    const { card } = L;
    body.add(drawCandyPlate(scene, 0, card.y, card.width, card.height, card.radius, card.rim, card.outline));
    const half = card.width / 2 - 10;
    const count = scene.add.text(half, L.countY, "", textStyle({ role: "display", size: L.countSize, color: TONE.soft })).setOrigin(1, .5);
    const error = scene.add.text(-half, L.countY, "", textStyle({ role: "emphasis", size: L.countSize, color: TONE.danger, wrap: card.width - 180 })).setOrigin(0, .5).setStroke("#ffffff", 6);
    const problemText = (problem: string): string => t(problem === "tooShort" ? "profile.edit.error.tooShort"
      : problem === "tooLong" ? "profile.edit.error.tooLong" : problem === "banned" ? "profile.edit.error.banned" : "profile.edit.error.invalidCharacter",
    { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH });
    let save: RouletteSpinButton | undefined;
    const field = new TextInputField(scene, 0, card.y, { ...L.field,
      palette: { fill: 0xffffff, fillAlpha: 1, ink: TONE.inkText, placeholder: TONE.placeholder, accent: TONE.rim },
      value: playerCardManager.card.nickname, maxGlyphs: NICKNAME_MAX_LENGTH, ariaLabel: t("profile.edit.nickname"),
      onChange: (value) => {
        count.setText(`${Array.from(cleanNickname(value)).length} / ${NICKNAME_MAX_LENGTH}`);
        error.setText("");
        save?.setEnabled(!pending && !lockedUntil && nicknameProblem(value) === undefined);
      },
    });
    body.add([field, count, error]);
    count.setText(`${Array.from(cleanNickname(field.value)).length} / ${NICKNAME_MAX_LENGTH}`);

    body.add(scene.add.text(-half, L.rulesY, t("profile.nickname.requirements", { min: NICKNAME_MIN_LENGTH, max: NICKNAME_MAX_LENGTH }),
      textStyle({ role: "body", size: L.rulesSize, color: TONE.inkText, wrap: card.width - 20, lineSpacing: 8 })).setOrigin(0, 0));
    const notice = scene.add.text(0, L.noticeY, t("profile.edit.nicknameCooldown"),
      textStyle({ role: "emphasis", size: L.noticeSize, color: TONE.accentText, wrap: card.width, align: "center" })).setOrigin(.5);
    fitTextToBox(notice, { width: card.width, height: 70 });
    body.add(notice);
    if (lockedUntil) error.setText(t("profile.edit.nicknameLocked", { time: lockedUntil.toLocaleString() }));

    save = new RouletteSpinButton(scene, 0, L.saveY, { ...L.save,
      label: t(creating ? "profile.nickname.create.save" : "profile.edit.save"),
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
