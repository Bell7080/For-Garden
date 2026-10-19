import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { accountApi, type AccountFailureCode, type AccountState } from "../api/AccountApi";
import { accountCredentialProblem, ACCOUNT_ID_MAX, ACCOUNT_PASSWORD_MAX } from "../core/accountCredentials";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import type { PopupLayer } from "./PopupLayer";
import { TextInputField } from "./TextInputField";
import { COLOR, textStyle } from "./theme";
import { ACCOUNT_ID_POPUP, accountIdPopupRows, type AccountIdPopupMode, type AccountIdPopupTab } from "./accountIdPopupLayout";

export interface AccountIdPopupOptions {
  /** `both`: 로그인·회원가입 탭(타이틀). `link`: 이 기기의 게스트를 아이디 계정으로 승격(설정). */
  mode: AccountIdPopupMode;
  /** 인증이 끝난 뒤 부른다. 창은 이미 닫혀 있다. 이후의 저장 이어받기는 부른 쪽이 맡는다. */
  onDone: (state: AccountState, how: AccountIdPopupTab) => void;
}

const FAILURE_KEY: Partial<Record<AccountFailureCode, TextKey>> = {
  "invalid-id": "account.id.error.id",
  "weak-password": "account.id.error.password",
  "id-taken": "account.id.error.taken",
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
  let alive = true;

  layer.open({ width: L.width, height: rows.height, title: t(options.mode === "link" ? "account.id.linkTitle" : "account.id.title"), dim: true, closeOnBackdrop: false, onClose: () => { alive = false; } }, (body, close) => {
    const tabs = scene.add.container(0, 0);
    const view = scene.add.container(0, 0);
    body.add([tabs, view]);

    const paintTabs = (): void => {
      tabs.removeAll(true);
      if (rows.tabsY === null) return;
      const { width, height, gap } = L.tabs;
      (["signIn", "register"] as const).forEach((which, index) => {
        addCategoryTab(scene, tabs, {
          x: (index - 0.5) * (width + gap), y: rows.tabsY!, width, height, label: t(which === "signIn" ? "account.id.tab.signIn" : "account.id.tab.register"), selected: tab === which, face: "down",
          onSelect: () => { if (tab === which) return; tab = which; password = ""; confirm = ""; paintTabs(); paint(); },
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
        view.add(scene.add.text(0, rows.confirmFieldY - 40, t("account.id.hint.signIn"), textStyle({ role: "body", size: 26, color: COLOR.inkDim, align: "center", wrap: L.field.width })).setOrigin(0.5, 0));
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
          submit.setEnabled(false);
          setNote(t("account.id.busy"));
          const call = register ? accountApi.registerWithId(id, password) : accountApi.signInWithId(id, password);
          void call.then((result) => {
            if (!alive) return;
            if (!result.ok) { submit.setEnabled(true); setNote(t(FAILURE_KEY[result.code] ?? "settings.account.unavailable"), true); return; }
            const done = options.onDone;
            const how = tab;
            close();
            done(result.value, how);
          });
        },
      });
      view.add(submit);
    };

    paintTabs();
    paint();
  });
}
