import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { accountApi, type AccountFailureCode, type AccountState } from "../api/AccountApi";
import { accountCredentialProblem, ACCOUNT_ID_MAX, ACCOUNT_PASSWORD_MAX } from "../core/accountCredentials";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { addAccountGuide } from "./AccountGuide";
import { paintCandyBackdrop } from "./candyBackdrop";
import { addCandyWordmark, drawCandyPlate } from "./candyPopupKit";
import { COUPON_TONE as TONE } from "./couponPopupLayout";
import { pressIn, pressOut } from "./pressFeedback";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { slideTabPage } from "./screenTransition";
import type { PopupLayer } from "./PopupLayer";
import { TextInputField } from "./TextInputField";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";
import { ACCOUNT_ID_POPUP, accountIdPopupRows, type AccountIdPopupMode, type AccountIdPopupTab } from "./accountIdPopupLayout";

export interface AccountIdPopupOptions {
  /** `both`: 타이틀. `link`: 설정의 게스트 연동. 둘 다 로그인·회원가입 탭을 제공한다. */
  mode: AccountIdPopupMode;
  onClose?: () => void;
  /** 인증이 끝난 뒤 부른다. 창은 이미 닫혀 있다. 이후의 저장 이어받기는 부른 쪽이 맡는다. */
  onDone: (state: AccountState, how: AccountIdPopupTab) => void;
}

/** 맨 위 굵은 제목 글자. 어느 언어에서나 같은 표식이라 번역하지 않는다. */
const ACCOUNT_WORDMARK = "ACCOUNT";

/** 사탕 결 탭 하나 — 고른 쪽은 말랑한 판이 솟고, 안 고른 쪽은 옅은 유리 알약으로 가라앉는다. */
function addCandyTab(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, spec: { x: number; y: number; width: number; height: number; label: string; selected: boolean; tone: number; onSelect: () => void }): void {
  const tab = scene.add.container(spec.x, spec.y);
  const { width, height } = spec;
  if (spec.selected) tab.add(drawCandyPlate(scene, 0, 0, width, height, height / 2, 7, 5, spec.tone));
  else {
    const g = scene.add.graphics();
    g.fillStyle(TONE.ink, 0.18).fillRoundedRect(-width / 2, -height / 2 + 6, width, height - 6, (height - 6) / 2);
    g.fillStyle(0xffffff, 0.55).fillRoundedRect(-width / 2 + 6, -height / 2 + 10, width - 12, height - 18, (height - 18) / 2);
    tab.add(g);
  }
  const text = scene.add.text(0, spec.selected ? 0 : 3, spec.label, textStyle({ role: "display", size: spec.selected ? 32 : 28, color: spec.selected ? TONE.inkText : TONE.soft })).setOrigin(.5);
  shrinkTextToWidth(text, width - 40);
  tab.add(text);
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(tab));
  hit.on("pointerout", () => pressOut(tab, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(tab); spec.onSelect(); });
  tab.add(hit);
  parent.add(tab);
}

const FAILURE_KEY: Partial<Record<AccountFailureCode, TextKey>> = {
  "invalid-id": "account.id.error.id",
  "weak-password": "account.id.error.password",
  "id-taken": "account.id.error.taken",
  "email-unconfirmed": "account.id.error.login",
  "invalid-credentials": "account.id.error.login",
  "rate-limited": "account.id.error.rate",
  "network-error": "settings.account.network",
  unsupported: "settings.account.unsupported",
};

/**
 * 아이디·비밀번호 계정 창. 메일 인증이 없고 비밀번호는 인증 서비스만 보관한다 — 이 창은 입력을 모아
 * `accountApi`에 넘길 뿐 검증 결과(중복·잘못된 비밀번호)는 서버가 정한다.
 */
export function openAccountIdPopup(scene: Phaser.Scene, layer: PopupLayer, options: AccountIdPopupOptions): void {
  const rows = accountIdPopupRows(options.mode);
  const L = ACCOUNT_ID_POPUP;
  let tab: AccountIdPopupTab = options.mode === "link" ? "register" : "signIn";
  let id = "", password = "", confirm = "";
  let alive = true, busy = false;
  const retryAt: Record<AccountIdPopupTab, number> = { signIn: 0, register: 0 };

  layer.open({ width: L.width, height: rows.height, title: t(options.mode === "link" ? "account.id.linkTitle" : "account.id.title"), dim: true, backButton: true, canClose: () => !busy, onClose: () => { alive = false; options.onClose?.(); } }, (body, close) => {
    const animate = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
    const C = L.candy;
    paintCandyBackdrop(scene, body, { width: L.width, height: rows.height, top: C.backdrop.top, bottom: C.backdrop.bottom, glowY: -rows.height / 2 + C.wordmark.dy }, animate);
    addCandyWordmark(scene, body, ACCOUNT_WORDMARK, { ...C.wordmark, y: -rows.height / 2 + C.wordmark.dy }, animate);
    const tabs = scene.add.container(0, 0);
    const view = scene.add.container(0, 0);
    body.add([tabs, view]);
    const guide = addAccountGuide(scene, body, L.width, rows.height);
    const guideLine = (): TextKey => tab === "signIn" ? "account.guide.signIn" : options.mode === "link" ? "account.guide.link" : "account.guide.register";

    const paintTabs = (): void => {
      tabs.removeAll(true);
      if (rows.tabsY === null) return;
      const { width, height, gap } = L.tabs;
      (["signIn", "register"] as const).forEach((which, index) => {
        addCandyTab(scene, tabs, {
          x: (index - 0.5) * (width + gap), y: rows.tabsY!, width, height, label: t(which === "signIn" ? "account.id.tab.signIn" : "account.id.tab.register"), selected: tab === which, tone: C.tabTone,
          onSelect: () => {
            if (busy || tab === which) return;
            const order = ["signIn", "register"] as const;
            const from = order.indexOf(tab); tab = which; password = ""; confirm = ""; paintTabs(); paint(); guide.say(guideLine());
            slideTabPage(scene, [view], from, order.indexOf(which));
          },
        });
      });
    };

    const label = (text: string, y: number): void => {
      view.add(scene.add.text(-L.field.width / 2, y, text, textStyle({ role: "display", size: 28, color: TONE.inkText })).setOrigin(0, 0.5));
    };
    // 입력 칸 뒤의 크림빛 사탕 판 + 흰 칸 — 피드백·닉네임 창과 같은 결.
    const palette = { fill: 0xffffff, fillAlpha: 1, ink: TONE.inkText, placeholder: TONE.placeholder, accent: C.rim };
    const fieldPlate = (y: number): void => {
      view.add(drawCandyPlate(scene, 0, y, L.field.width + C.fieldPad.x * 2, L.field.height + C.fieldPad.y * 2, 30, 7, 5, C.rim));
    };

    const paint = (): void => {
      view.removeAll(true);
      const register = tab === "register";
      const note = scene.add.text(0, rows.noteY, "", textStyle({ role: "emphasis", size: 25, color: TONE.soft, align: "center", wrap: L.field.width })).setOrigin(0.5);
      const setNote = (text: string, danger = false): void => { note.setText(text); note.setColor(danger ? TONE.danger : TONE.soft); };
      setNote(register ? t("account.id.note.register") : "");

      label(t("account.id.field.id"), rows.idLabelY);
      fieldPlate(rows.idFieldY);
      view.add(new TextInputField(scene, 0, rows.idFieldY, { ...L.field, palette, value: id, maxGlyphs: ACCOUNT_ID_MAX, ariaLabel: t("account.id.field.id"), autocomplete: "username", onChange: (v) => { id = v; } }));
      label(t("account.id.field.password"), rows.passwordLabelY);
      fieldPlate(rows.passwordFieldY);
      view.add(new TextInputField(scene, 0, rows.passwordFieldY, { ...L.field, palette, value: password, maxGlyphs: ACCOUNT_PASSWORD_MAX, ariaLabel: t("account.id.field.password"), mask: true, autocomplete: register ? "new-password" : "current-password", onChange: (v) => { password = v; } }));
      if (register) {
        label(t("account.id.field.confirm"), rows.confirmLabelY);
        fieldPlate(rows.confirmFieldY);
        view.add(new TextInputField(scene, 0, rows.confirmFieldY, { ...L.field, palette, value: confirm, maxGlyphs: ACCOUNT_PASSWORD_MAX, ariaLabel: t("account.id.field.confirm"), mask: true, autocomplete: "new-password", onChange: (v) => { confirm = v; } }));
      } else {
        // 회원가입의 확인 칸 자리가 비므로 안내 한 줄을 비밀번호 칸과 제출 버튼 사이 한가운데에 세운다.
        view.add(scene.add.text(0, (rows.passwordFieldY + L.field.height / 2 + rows.submitY - L.submit.height / 2) / 2, t("account.id.hint.signIn"), textStyle({ role: "body", size: 27, color: TONE.soft, align: "center", wrap: L.field.width })).setOrigin(0.5));
      }
      view.add(note);

      const submit = new RouletteSpinButton(scene, 0, rows.submitY, {
        ...L.submit, tone: C.rim, label: t(register ? (options.mode === "link" ? "account.id.link" : "account.id.register") : "account.id.signIn"),
        onClick: () => {
          if (register) {
            const problem = accountCredentialProblem(id, password);
            if (problem) { setNote(t(problem.startsWith("id") ? "account.id.error.id" : "account.id.error.password"), true); return; }
            if (password !== confirm) { setNote(t("account.id.error.mismatch"), true); return; }
          }
          if (busy) return;
          if (Date.now() < retryAt[tab]) { setNote(t("account.id.retryAfter", { seconds: Math.ceil((retryAt[tab] - Date.now()) / 1000) }), true); return; }
          const how = tab;
          const execute = (): void => {
            if (!alive || busy) return;
            busy = true;
            submit.setEnabled(false);
            setNote(t("account.id.busy"));
            const call = how === "register" ? accountApi.registerWithId(id, password) : accountApi.signInWithId(id, password);
            void call.then((result) => {
              if (!result.ok) {
                busy = false;
                if (result.retryAfterSeconds) retryAt[how] = Date.now() + result.retryAfterSeconds * 1000;
                if (alive) { submit.setEnabled(true); setNote(result.code === "network-error" || result.code === "rate-limited" ? result.message : t(FAILURE_KEY[result.code] ?? "settings.account.unavailable"), true); }
                return;
              }
              if (!alive || !scene.scene.isActive()) return;
              busy = false;
              if (alive) close();
              options.onDone(result.value, how);
            }).catch(() => {
              busy = false;
              if (alive) { submit.setEnabled(true); setNote(t("settings.account.network"), true); }
            });
          };
          if (how === "signIn" && options.mode === "link") {
            layer.confirm({ title: t("account.id.signIn"), message: t("account.id.switchWarning"), confirmLabel: t("account.id.signIn"), destructive: true }, execute);
          } else execute();
        },
      });
      view.add(submit);
    };

    paintTabs();
    paint();
    guide.say(guideLine());
  });
}
