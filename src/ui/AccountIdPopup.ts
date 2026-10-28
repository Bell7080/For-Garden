import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { accountApi, type AccountFailureCode, type AccountState } from "../api/AccountApi";
import { accountCredentialProblem, ACCOUNT_ID_MAX, ACCOUNT_PASSWORD_MAX } from "../core/accountCredentials";
import { addAccountGuide } from "./AccountGuide";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { slideTabPage } from "./screenTransition";
import type { PopupLayer } from "./PopupLayer";
import { TextInputField } from "./TextInputField";
import { COLOR, textStyle } from "./theme";
import { ACCOUNT_ID_POPUP, accountIdPopupRows, type AccountIdPopupMode, type AccountIdPopupTab } from "./accountIdPopupLayout";

export interface AccountIdPopupOptions {
  /** `both`: 타이틀. `link`: 설정의 게스트 연동. 둘 다 로그인·회원가입 탭을 제공한다. */
  mode: AccountIdPopupMode;
  onClose?: () => void;
  /** 인증이 끝난 뒤 부른다. 창은 이미 닫혀 있다. 이후의 저장 이어받기는 부른 쪽이 맡는다. */
  onDone: (state: AccountState, how: AccountIdPopupTab) => void;
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

  layer.open({ width: L.width, height: rows.height, title: t(options.mode === "link" ? "account.id.linkTitle" : "account.id.title"), dim: true, closeOnBackdrop: false, backButton: true, canClose: () => !busy, onClose: () => { alive = false; options.onClose?.(); } }, (body, close) => {
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
        addCategoryTab(scene, tabs, {
          x: (index - 0.5) * (width + gap), y: rows.tabsY!, width, height, label: t(which === "signIn" ? "account.id.tab.signIn" : "account.id.tab.register"), selected: tab === which, face: "down",
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
      view.add(scene.add.text(-L.field.width / 2, y, text, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
    };

    const paint = (): void => {
      view.removeAll(true);
      const register = tab === "register";
      const note = scene.add.text(0, rows.noteY, "", textStyle({ role: "body", size: 24, color: COLOR.inkDim, align: "center", wrap: L.field.width })).setOrigin(0.5);
      const setNote = (text: string, danger = false): void => { note.setText(text); note.setColor(danger ? COLOR.dangerText : COLOR.inkDim); };
      setNote(register ? t("account.id.note.register") : "");

      label(t("account.id.field.id"), rows.idLabelY);
      view.add(new TextInputField(scene, 0, rows.idFieldY, { ...L.field, value: id, maxGlyphs: ACCOUNT_ID_MAX, ariaLabel: t("account.id.field.id"), autocomplete: "username", onChange: (v) => { id = v; } }));
      label(t("account.id.field.password"), rows.passwordLabelY);
      view.add(new TextInputField(scene, 0, rows.passwordFieldY, { ...L.field, value: password, maxGlyphs: ACCOUNT_PASSWORD_MAX, ariaLabel: t("account.id.field.password"), mask: true, autocomplete: register ? "new-password" : "current-password", onChange: (v) => { password = v; } }));
      if (register) {
        label(t("account.id.field.confirm"), rows.confirmLabelY);
        view.add(new TextInputField(scene, 0, rows.confirmFieldY, { ...L.field, value: confirm, maxGlyphs: ACCOUNT_PASSWORD_MAX, ariaLabel: t("account.id.field.confirm"), mask: true, autocomplete: "new-password", onChange: (v) => { confirm = v; } }));
      } else {
        // 회원가입의 확인 칸 자리가 비므로 안내 한 줄을 비밀번호 칸과 제출 버튼 사이 한가운데에 세운다.
        view.add(scene.add.text(0, (rows.passwordFieldY + L.field.height / 2 + rows.submitY - L.submit.height / 2) / 2, t("account.id.hint.signIn"), textStyle({ role: "body", size: 26, color: COLOR.inkDim, align: "center", wrap: L.field.width })).setOrigin(0.5));
      }
      view.add(note);

      const submit = new Button(scene, 0, rows.submitY, {
        ...L.submit, label: t(register ? (options.mode === "link" ? "account.id.link" : "account.id.register") : "account.id.signIn"), variant: "primary",
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
