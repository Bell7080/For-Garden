import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { clipText, glyphCount, paginate, ticketDraftProblem, TICKET_BODY_MAX, TICKET_CATEGORIES, TICKET_MESSAGE_VISIBLE, TICKET_SUBJECT_MAX, type TicketCategoryId } from "../core/supportDraft";
import { supportApi } from "../managers/SupportManager";
import type { SupportError, TicketDetail, TicketSummary } from "../api/SupportApi";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { slideTabPage } from "./screenTransition";
import { chipPoints, drawLayer, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { TextInputField } from "./TextInputField";
import { chipX, supportContentWidth, supportPopupHeight, SUPPORT_POPUP } from "./supportPopupLayout";

type Tab = "compose" | "mine";

/**
 * 고객 문의 창. 작성(종류·제목·여러 줄 내용)과 내 문의(목록·상세·답글)를 한 판에서 라벨로 가른다.
 * 접수·조회는 `supportApi()` 경계만 지나고, 길이·속도 제한은 서버가 마지막으로 검증한다.
 */
export function openSupportPopup(scene: Phaser.Scene, layer: PopupLayer): void {
  const height = supportPopupHeight();
  const top = -height / 2;
  let alive = true;
  let tab: Tab = "compose";
  let category: TicketCategoryId = "inquiry";
  let subject = "";
  let bodyText = "";
  let page = 0;
  let tickets: TicketSummary[] | null = null;

  layer.open({ width: SUPPORT_POPUP.width, height, title: t("support.title"), dim: true, closeOnBackdrop: false, onClose: () => { alive = false; } }, (body) => {
    const tabs = scene.add.container(0, top);
    const view = scene.add.container(0, top);
    body.add([tabs, view]);

    const notice = (title: string, message: string): void => layer.confirm({ title, message, confirmLabel: t("settings.action.confirm"), cancelLabel: false });
    const failure = (error: SupportError): void => notice(t("support.error.title"), t(`support.error.${error}` as TextKey));

    const paintTabs = (): void => {
      tabs.removeAll(true);
      const { y, width, height: tabHeight, gap } = SUPPORT_POPUP.tabs;
      ([["compose", "support.tab.compose"], ["mine", "support.tab.mine"]] as const).forEach(([id, labelKey], index) => {
        addCategoryTab(scene, tabs, {
          x: (index - 0.5) * (width + gap), y, width, height: tabHeight, label: t(labelKey), selected: tab === id, face: "down",
          onSelect: () => {
            if (tab === id) return;
            const order = ["compose", "mine"] as const;
            const from = order.indexOf(tab); tab = id; paintTabs(); paint();
            slideTabPage(scene, [view], from, order.indexOf(id));
          },
        });
      });
    };

    const label = (text: string, y: number): void => {
      view.add(scene.add.text(-supportContentWidth() / 2, y, text, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
    };

    const paintCompose = (): void => {
      const c = SUPPORT_POPUP;
      TICKET_CATEGORIES.forEach((id, index) => {
        addCategoryTab(scene, view, {
          x: chipX(index, TICKET_CATEGORIES.length), y: c.chips.y, width: c.chips.width, height: c.chips.height, label: t(`support.category.${id}` as TextKey), selected: category === id, face: "down",
          onSelect: () => { if (category === id) return; category = id; paint(); },
        });
      });
      label(t("support.field.subject"), c.subject.labelY);
      view.add(new TextInputField(scene, 0, c.subject.fieldY, { width: supportContentWidth(), height: c.subject.height, value: subject, maxGlyphs: TICKET_SUBJECT_MAX, ariaLabel: t("support.field.subject"), onChange: (value) => { subject = value; } }));
      label(t("support.field.body"), c.body.labelY);
      const counter = scene.add.text(supportContentWidth() / 2, c.counterY, t("support.counter", { count: glyphCount(bodyText), max: TICKET_BODY_MAX }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
      view.add(counter);
      view.add(new TextInputField(scene, 0, c.body.fieldY, {
        width: supportContentWidth(), height: c.body.height, value: bodyText, maxGlyphs: TICKET_BODY_MAX, ariaLabel: t("support.field.body"), multiline: true, fontSize: 28,
        onChange: (value) => { bodyText = value; counter.setText(t("support.counter", { count: glyphCount(value), max: TICKET_BODY_MAX })); },
      }));
      const submit = new Button(scene, 0, c.submit.y, { width: c.submit.width, height: c.submit.height, label: t("support.submit"), variant: "primary", onClick: () => {
        // 비어 있으면 서버를 부르지 않고 같은 오류 문구로 알린다(서버도 같은 판정을 한다).
        if (ticketDraftProblem({ subject, body: bodyText })) { failure("invalid_text"); return; }
        submit.setEnabled(false);
        void supportApi().submit({ category, subject: subject.trim(), body: bodyText.trim() }).then((result) => {
          if (!alive) return;
          if (!result.ok) { submit.setEnabled(true); failure(result.error); return; }
          subject = ""; bodyText = ""; tickets = null; page = 0;
          notice(t("support.sent.title"), t("support.sent.body", { no: result.value.ticketNo }));
          paint();
        });
      } });
      view.add(submit);
    };

    const paintMine = (): void => {
      const c = SUPPORT_POPUP;
      if (tickets === null) {
        view.add(scene.add.text(0, c.list.top + 120, t("support.loading"), textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
        void supportApi().listMine().then((result) => {
          if (!alive) return;
          if (!result.ok) { failure(result.error); tickets = []; } else tickets = result.value;
          if (tab === "mine") paint();
        });
        return;
      }
      if (tickets.length === 0) {
        view.add(scene.add.text(0, c.list.top + 120, t("support.empty"), textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
        return;
      }
      const paged = paginate(tickets, page);
      page = paged.page;
      const width = supportContentWidth();
      paged.slice.forEach((ticket, index) => {
        const y = c.list.top + c.list.rowHeight / 2 + index * (c.list.rowHeight + c.list.rowGap);
        const row = scene.add.container(0, y);
        row.add(drawLayer(scene, 0, 0, chipPoints(width, c.list.rowHeight, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } }), { fill: 0x161d26, alpha: HOLO.glass }));
        row.add(scene.add.text(-width / 2 + 28, -24, `${t("support.ticket.no", { no: ticket.ticketNo })} · ${t(`support.category.${ticket.category}` as TextKey)}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
        row.add(scene.add.text(-width / 2 + 28, 20, clipText(ticket.subject, 26), textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, 0.5));
        row.add(scene.add.text(width / 2 - 28, 0, t(`support.status.${ticket.status}` as TextKey), textStyle({ role: "emphasis", size: 24, color: ticket.status === "answered" ? COLOR.accentText : COLOR.inkDim })).setOrigin(1, 0.5));
        const hit = scene.add.rectangle(0, 0, width, c.list.rowHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => openDetail(ticket.id));
        row.add(hit);
        view.add(row);
      });
      const pagerY = c.list.top + c.list.rows * (c.list.rowHeight + c.list.rowGap) + c.pager.gapBelow + c.pager.height / 2;
      const prev = new Button(scene, -240, pagerY, { width: 200, height: c.pager.height, label: t("support.prev"), onClick: () => { page -= 1; paint(); } }).setEnabled(page > 0);
      const next = new Button(scene, 240, pagerY, { width: 200, height: c.pager.height, label: t("support.next"), onClick: () => { page += 1; paint(); } }).setEnabled(page < paged.pages - 1);
      view.add([prev, next, scene.add.text(0, pagerY, t("support.page", { page: page + 1, pages: paged.pages }), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0.5)]);
    };

    const openDetail = (id: string): void => {
      view.removeAll(true);
      view.add(scene.add.text(0, SUPPORT_POPUP.list.top + 120, t("support.loading"), textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
      void supportApi().get(id).then((result) => {
        if (!alive) return;
        if (!result.ok) { failure(result.error); paint(); return; }
        paintDetail(result.value);
      });
    };

    const paintDetail = (ticket: TicketDetail): void => {
      view.removeAll(true);
      const c = SUPPORT_POPUP.detail;
      const width = supportContentWidth();
      view.add(scene.add.text(-width / 2, c.headY - 30, `${t("support.ticket.no", { no: ticket.ticketNo })} · ${t(`support.category.${ticket.category}` as TextKey)} · ${t(`support.status.${ticket.status}` as TextKey)}`, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
      view.add(scene.add.text(-width / 2, c.headY + 20, clipText(ticket.subject, 34), textStyle({ role: "emphasis", size: 32, color: COLOR.ink })).setOrigin(0, 0.5));
      // 처음 글에 이어 최근 메시지만 보인다. 넘치는 글은 줄여 보이고 원문은 서버에 그대로 있다.
      const recent = ticket.messages.slice(-TICKET_MESSAGE_VISIBLE);
      const lines = [clipText(ticket.body), ...recent.map((m) => `${t(`support.author.${m.author}` as TextKey)}\n${clipText(m.body)}`)];
      view.add(scene.add.text(-width / 2, c.textTop, lines.join("\n\n"), textStyle({ role: "body", size: 26, wrap: width, lineSpacing: 8 })).setOrigin(0, 0));
      let reply = "";
      if (ticket.status !== "closed") {
        view.add(scene.add.text(-width / 2, c.replyLabelY, t("support.field.reply"), textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
        view.add(new TextInputField(scene, 0, c.replyFieldY, { width, height: c.replyHeight, value: "", maxGlyphs: TICKET_BODY_MAX, ariaLabel: t("support.field.reply"), multiline: true, fontSize: 26, onChange: (value) => { reply = value; } }));
        const send = new Button(scene, 190, c.sendY, { width: 340, height: SUPPORT_POPUP.submit.height, label: t("support.reply.send"), variant: "primary", onClick: () => {
          if (reply.trim().length === 0) { failure("invalid_text"); return; }
          send.setEnabled(false);
          void supportApi().addMessage(ticket.id, reply.trim()).then((result) => {
            if (!alive) return;
            if (!result.ok) { send.setEnabled(true); failure(result.error); return; }
            openDetail(ticket.id);
          });
        } });
        view.add(send);
      }
      view.add(new Button(scene, ticket.status === "closed" ? 0 : -190, c.backY, { width: 300, height: SUPPORT_POPUP.submit.height, label: t("support.back"), onClick: () => paint() }));
    };

    const paint = (): void => {
      view.removeAll(true);
      if (tab === "compose") paintCompose(); else paintMine();
    };

    paintTabs();
    paint();
  });
}
