import type Phaser from "phaser";
import { accountApi, type AccountState } from "../api/AccountApi";
import { t } from "../i18n";
import { addAccountGuide } from "./AccountGuide";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { TextInputField } from "./TextInputField";
import { COLOR, textStyle } from "./theme";
/** 이메일/연동과 다른 계정 로그인은 처음부터 다른 의도로 고정한다. */
export function openAccountEmailPopup(scene: Phaser.Scene, layer: PopupLayer, intent: "link" | "sign-in", onDone: (state: AccountState) => void, onClose?: () => void): void {
    let email = "", code = "", sent = false, busy = false, alive = true, retryAt = 0;
    layer.open({ width: 850, height: 740, title: t("account.email.title"), dim: true, backButton: true, canClose: () => !busy, onClose: () => { alive = false; onClose?.(); } }, (body, close) => {
        const view = scene.add.container(0, 0);
        body.add(view);
        const guide = addAccountGuide(scene, body, 850, 740);
        const render = (message = "") => {
            view.removeAll(true);
            view.add(scene.add.text(0, -245, t(sent ? "account.email.sent" : "account.email.note"), textStyle({ role: "body", size: 26, align: "center", wrap: 720, color: COLOR.inkDim })).setOrigin(.5));
            view.add(scene.add.text(-340, -165, t("account.email.address"), textStyle({ role: "emphasis", size: 25 })));
            view.add(new TextInputField(scene, 0, -85, { width: 690, height: 80, value: email, maxGlyphs: 254, ariaLabel: t("account.email.address"), autocomplete: "email", onChange: v => { email = v; } }));
            if (sent) {
                view.add(scene.add.text(-340, -15, t("account.email.code"), textStyle({ role: "emphasis", size: 25 })));
                view.add(new TextInputField(scene, 0, 62, { width: 690, height: 80, value: code, maxGlyphs: 10, ariaLabel: t("account.email.code"), autocomplete: "one-time-code", onChange: v => { code = v; } }));
            }
            view.add(scene.add.text(0, 145, message, textStyle({ role: "body", size: 23, color: COLOR.dangerText, align: "center", wrap: 720 })).setOrigin(.5));
            const submit = new Button(scene, 0, 235, { width: 420, height: 84, label: t(sent ? "account.email.verify" : "account.email.send"), variant: "primary", onClick: () => {
                    if (busy || Date.now() < retryAt)
                        return;
                    const address = email.trim();
                    const token = code.trim();
                    busy = true;
                    submit.setEnabled(false);
                    const execute = async () => {
                        try {
                            const result = sent ? await accountApi.verifyEmailCode?.(address, token, intent) : await accountApi.requestEmailCode?.(address, intent);
                            if (!alive)
                                return;
                            busy = false;
                            if (!result) {
                                render(t("account.identity.unavailable"));
                                return;
                            }
                            if (!result.ok) {
                                if (result.retryAfterSeconds)
                                    retryAt = Date.now() + result.retryAfterSeconds * 1000;
                                render(result.message);
                                return;
                            }
                            if (sent) {
                                close();
                                onDone(result.value as AccountState);
                                return;
                            }
                            sent = true;
                            email = address;
                            render();
                            guide.say("account.guide.emailSent");
                        }
                        catch {
                            busy = false;
                            if (alive)
                                render(t("settings.account.network"));
                        }
                    };
                    void execute();
                } });
            view.add(submit);
        };
        render();
        guide.say("account.guide.email");
    });
}
