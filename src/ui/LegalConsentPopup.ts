import Phaser from "phaser";
import { t } from "../i18n";
import { openPolicyDocument } from "../scenes/policyNavigation";
import { Button } from "./Button";
import { LEGAL_CONSENT_POPUP as L, legalConsentRowY } from "./legalConsentLayout";
import { drawLayer, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";

/**
 * 첫 로그인 앞의 약관 동의창. 이용약관·개인정보 처리방침·만 14세 이상 확인 세 칸이 모두 켜져야
 * 「동의하고 시작」이 열린다. 원문은 홈페이지가 갖고 「보기」가 고정 주소를 연다. 닫으면 동의하지 않은 것이다 —
 * `onAgree`는 세 칸이 켜진 채 버튼을 눌렀을 때만 한 번 불린다.
 */
export function openLegalConsentPopup(scene: Phaser.Scene, layer: PopupLayer, onAgree: () => void): void {
  layer.open({ width: L.width, height: L.height, title: t("legal.consent.title"), dim: true, closeOnBackdrop: true }, (body, close) => {
    body.add(scene.add.text(0, L.noteY, t("legal.consent.note"),
      textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: L.noteWidth, lineSpacing: 8 })).setOrigin(.5));

    const checked = [false, false, false];
    let submit: Button | undefined;
    const rows: Array<{ label: string; path?: "/terms" | "/privacy" }> = [
      { label: t("legal.consent.terms"), path: "/terms" },
      { label: t("legal.consent.privacy"), path: "/privacy" },
      { label: t("legal.consent.age") },
    ];
    rows.forEach((row, index) => {
      const y = legalConsentRowY(index);
      body.add(drawLayer(scene, 0, y, slantedRect(L.row.width, L.row.height, 14), { fill: 0x1a2430, alpha: 0.9 }));
      const box = scene.add.container(L.row.boxX, y);
      const frame = drawLayer(scene, 0, 0, slantedRect(L.row.box, L.row.box, 8), { fill: 0x0b0f15, alpha: 0.9, edge: COLOR.accent, edgeAlpha: 0.6 });
      const mark = scene.add.text(0, 0, "✓", textStyle({ role: "display", size: 38, color: COLOR.accentText })).setOrigin(.5).setVisible(false);
      box.add([frame, mark]);
      const label = scene.add.text(L.row.labelX, y, row.label,
        textStyle({ role: "emphasis", size: 27, color: COLOR.ink, wrap: row.path ? L.row.viewX - L.row.viewWidth / 2 - L.row.labelX - 20 : L.row.width - 190 })).setOrigin(0, .5);
      body.add([box, label]);
      const toggle = scene.add.rectangle(L.row.boxX + (row.path ? 250 : 320), y, row.path ? 600 : 740, L.row.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
      toggle.on("pointerdown", () => pressIn(box));
      toggle.on("pointerout", () => pressOut(box, "normal", { pop: false }));
      toggle.on("pointerup", () => {
        pressOut(box);
        checked[index] = !checked[index];
        mark.setVisible(checked[index]);
        submit?.setEnabled(checked.every(Boolean));
      });
      body.add(toggle);
      if (row.path) {
        const view = scene.add.text(L.row.viewX, y, t("legal.consent.view"), textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(.5);
        const hit = scene.add.rectangle(L.row.viewX, y, L.row.viewWidth, L.row.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(view));
        hit.on("pointerout", () => pressOut(view, "normal", { pop: false }));
        hit.on("pointerup", () => { pressOut(view); openPolicyDocument(row.path!); });
        body.add([view, hit]);
      }
    });

    body.add(scene.add.text(0, L.underAgeY, t("legal.consent.underAge"),
      textStyle({ role: "body", size: 23, color: COLOR.inkDim, align: "center", wrap: L.underAgeWidth, lineSpacing: 6 })).setOrigin(.5));

    submit = new Button(scene, 0, L.submitY, { ...L.submit, label: t("legal.consent.submit"), fontSize: 32, variant: "primary",
      onClick: () => { if (!checked.every(Boolean)) return; close(); onAgree(); } });
    submit.setEnabled(false);
    body.add(submit);
  });
}
