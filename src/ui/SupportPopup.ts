import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { clipText, glyphCount, paginate, ticketDraftProblem, TICKET_BODY_MAX, TICKET_CATEGORIES, TICKET_MESSAGE_VISIBLE, TICKET_SUBJECT_MAX, type TicketCategoryId } from "../core/supportDraft";
import { supportApi } from "../managers/SupportManager";
import type { SupportError, TicketDetail, TicketSummary } from "../api/SupportApi";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { slideTabPage } from "./screenTransition";
import { chipPoints, drawLayer, HOLO, slantedRect } from "./holo";
import { drawGlyph } from "./glyphs";
import { pressIn, pressOut } from "./pressFeedback";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { TextInputField } from "./TextInputField";
import { chipX, supportActionXs, supportBackChipX, supportContentWidth, supportPopupHeight, supportTabX, SUPPORT_POPUP } from "./supportPopupLayout";
import { CONFIRM_DIALOG } from "./confirmDialogLayout";

type Tab = "compose" | "mine";

/** 문의 창의 색 한 벌 — 판·입력 칸·신고 띠, 그리고 상태마다의 꼬리표·빗금 색. */
const SUPPORT_TONE = {
  panel: 0x111821,
  staffFill: 0x2a2416,
  reportFill: 0x2a1416,
  reportInk: 0xf0a08a,
  status: {
    open: { edge: 0x8b8f96, fill: 0x3a3f47, text: "#e6e4df" },
    in_progress: { edge: 0x6fa8dc, fill: 0x1f3c5a, text: "#cfe4f7" },
    answered: { edge: COLOR.accent, fill: 0x5a4a26, text: "#f4e2b8" },
    closed: { edge: 0x4d525a, fill: 0x262a30, text: "#8b8f96" },
  },
} as const;

/** 빗금 하나의 꼭짓점 — 제목표의 빗금과 같은 기울기로 (dx, dy)에 놓는다. */
function slantPoints(width: number, height: number, slant: number, dx: number, dy: number): Phaser.Geom.Point[] {
  const flat = slantedRect(width, height, slant);
  const list: Phaser.Geom.Point[] = [];
  for (let i = 0; i < flat.length; i += 2) list.push(new Phaser.Geom.Point(flat[i] + dx, flat[i + 1] + dy));
  return list;
}

/** 판 위에 한 겹 더 떠 보이도록 판보다 밝고 푸른 입력 칸. 강조색은 밑줄이다. */
const SUPPORT_FIELD = { fill: 0x1c2735, fillAlpha: 0.96, ink: COLOR.ink, placeholder: COLOR.inkDim, accent: COLOR.accent };

/**
 * 고객 문의 창. 작성(종류·제목·여러 줄 내용)과 내 문의(목록·상세·답글)를 한 판에서 라벨로 가른다.
 * 접수·조회는 `supportApi()` 경계만 지나고, 길이·속도 제한은 서버가 마지막으로 검증한다.
 */
/** 다른 플레이어의 카드에서 연 신고 — 종류는 신고로 굳고, 대상 UID는 접수에 함께 실린다. */
export interface SupportReportTarget { uid: number; name: string }

export function openSupportPopup(scene: Phaser.Scene, layer: PopupLayer, options: { report?: SupportReportTarget } = {}): void {
  const height = supportPopupHeight();
  const top = -height / 2;
  let alive = true;
  let tab: Tab = "compose";
  const report = options.report;
  let category: TicketCategoryId = report ? "report" : "inquiry";
  let subject = report ? t("support.report.subject", { name: report.name }) : "";
  let bodyText = "";
  let page = 0;
  let tickets: TicketSummary[] | null = null;

  layer.open({ width: SUPPORT_POPUP.width, height, title: t("support.title"), dim: true, onClose: () => { alive = false; } }, (body) => {
    const tabs = scene.add.container(0, top);
    const view = scene.add.container(0, top);
    // 조작 줄은 목록과 따로 선다 — 탭을 넘길 때 미끄러지는 것은 내용 판 하나뿐이다.
    const actions = scene.add.container(0, top);
    body.add([view, tabs, actions]);

    const notice = (title: string, message: string): void => layer.confirm({ title, message, confirmLabel: t("settings.action.confirm"), cancelLabel: false });
    const failure = (error: SupportError): void => notice(t("support.error.title"), t(`support.error.${error}` as TextKey));

    const paintTabs = (): void => {
      tabs.removeAll(true);
      const { lineY, tabY: y, tab: { width, height: tabHeight } } = SUPPORT_POPUP.footer;
      // 내용과 밑동을 가르는 얇은 선 한 줄 — 라벨 탭이 그 위로 솟는다.
      const line = scene.add.graphics();
      line.lineStyle(2, COLOR.accent, 0.35);
      line.lineBetween(-supportContentWidth() / 2, lineY, supportContentWidth() / 2, lineY);
      tabs.add(line);
      ([["compose", "support.tab.compose"], ["mine", "support.tab.mine"]] as const).forEach(([id, labelKey], index) => {
        addCategoryTab(scene, tabs, {
          x: supportTabX(index), y, width, height: tabHeight, label: t(labelKey), selected: tab === id,
          onSelect: () => {
            if (tab === id) return;
            const order = ["compose", "mine"] as const;
            const from = order.indexOf(tab); tab = id; paintTabs(); paint();
            slideTabPage(scene, [view], from, order.indexOf(id));
          },
        });
      });
    };

    const width = supportContentWidth();
    const actionY = SUPPORT_POPUP.footer.actionY;
    const action = SUPPORT_POPUP.footer.action;

    /** 진행 버튼 — 확인 창의 확정 판과 같은 한 벌(제 색으로 물든 판 + 양 끝 점). 아이콘을 얹지 않는다. */
    const proceed = (x: number, label: string, onClick: () => void): Button => {
      const button = new Button(scene, x, actionY, { width: action.width, height: action.height, fontSize: CONFIRM_DIALOG.button.fontSize, label, variant: "primary", fill: CONFIRM_DIALOG.confirmFill, decorDots: true, onClick });
      actions.add(button);
      return button;
    };
    /** 되돌리기·넘기기 버튼 — 옅은 유리 판. */
    const secondary = (x: number, w: number, label: string, onClick: () => void): Button => {
      const button = new Button(scene, x, actionY, { width: w, height: action.height, fontSize: 30, label, onClick });
      actions.add(button);
      return button;
    };

    /** 안쪽 유리 판 — 몸판과 같이 왼쪽 위·오른쪽 아래만 깎이고 윗변에 얇은 강조선이 흐른다. */
    const glass = (parent: Phaser.GameObjects.Container, y: number, w: number, h: number, options: { fill?: number; edge?: number; bevel?: number } = {}): void => {
      const bevel = options.bevel ?? 22;
      parent.add(drawLayer(scene, 0, y, chipPoints(w, h, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } }), {
        fill: options.fill ?? SUPPORT_TONE.panel, alpha: HOLO.glass, edge: options.edge ?? COLOR.accent, edgeAlpha: 0.45,
      }));
    };

    /** 이름표 — 제목표와 같은 빗금 + 강조색 글자. 오른쪽 끝에는 글자 수가 선다. */
    const fieldLabel = (y: number, text: string, count?: string): Phaser.GameObjects.Text | undefined => {
      const left = -width / 2 + SUPPORT_POPUP.form.pad;
      const bar = scene.add.graphics();
      bar.fillStyle(COLOR.accent, 0.95);
      bar.fillPoints(slantPoints(8, 26, 6, left + 4, y), true);
      view.add([bar, scene.add.text(left + 20, y, text, textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(0, 0.5)]);
      if (count === undefined) return undefined;
      const counter = scene.add.text(width / 2 - SUPPORT_POPUP.form.pad, y, count, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, 0.5);
      view.add(counter);
      return counter;
    };

    /** 상태 꼬리표 — 색이 칠해진 작은 칩. 오른쪽 끝(`right`)에 붙는다. */
    const statusTag = (parent: Phaser.GameObjects.Container, right: number, y: number, status: TicketSummary["status"]): void => {
      const tone = SUPPORT_TONE.status[status];
      const text = scene.add.text(0, y, t(`support.status.${status}` as TextKey), textStyle({ role: "emphasis", size: 22, color: tone.text })).setOrigin(0.5);
      const tagWidth = text.width + 36;
      text.setX(right - tagWidth / 2);
      parent.add([drawLayer(scene, right - tagWidth / 2, y, chipPoints(tagWidth, 40, { bevel: { topLeft: 10, topRight: 0, bottomRight: 10, bottomLeft: 0 } }), { fill: tone.fill, alpha: 0.95, shadow: false }), text]);
    };

    const subjectCount = (): string => t("support.counter", { count: glyphCount(subject), max: TICKET_SUBJECT_MAX });
    const bodyCount = (): string => t("support.counter", { count: glyphCount(bodyText), max: TICKET_BODY_MAX });

    const paintCompose = (): void => {
      const c = SUPPORT_POPUP;
      const formWidth = width + c.form.pad * 2 - 20;
      glass(view, (c.form.top + c.form.bottom) / 2, formWidth, c.form.bottom - c.form.top, { bevel: 34 });
      if (report) {
        // 신고 대상 띠 — 붉은 빗금과 깃발이 이 글이 신고라는 것을 먼저 말하고, 대상의 이름·UID가 뒤따른다.
        const band = scene.add.container(0, c.chips.y);
        band.add(drawLayer(scene, 0, 0, chipPoints(width, c.chips.height, { bevel: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } }), { fill: SUPPORT_TONE.reportFill, alpha: 0.95, edge: COLOR.danger, edgeAlpha: 0.9, shadow: false }));
        band.add(drawGlyph(scene, "report", -width / 2 + 46, 0, 34, SUPPORT_TONE.reportInk, 1, 3));
        const tag = scene.add.text(-width / 2 + 82, 0, t("profile.report"), textStyle({ role: "emphasis", size: 22, color: COLOR.ink })).setOrigin(0, 0.5);
        band.add(drawLayer(scene, tag.x + tag.width / 2, 0, chipPoints(tag.width + 26, 38, { bevel: { topLeft: 9, topRight: 0, bottomRight: 9, bottomLeft: 0 } }), { fill: COLOR.danger, alpha: 0.95, shadow: false }));
        band.add(tag);
        band.add(scene.add.text(tag.x + tag.width + 30, 0, t("support.report.target", { name: report.name, uid: report.uid }), textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0, 0.5));
        view.add(band);
      } else TICKET_CATEGORIES.forEach((id, index) => {
        addCategoryTab(scene, view, {
          x: chipX(index, TICKET_CATEGORIES.length), y: c.chips.y, width: c.chips.width, height: c.chips.height, label: t(`support.category.${id}` as TextKey), selected: category === id, face: "down",
          onSelect: () => { if (category === id) return; category = id; paint(); },
        });
      });
      const subjectCounter = fieldLabel(c.subject.labelY, t("support.field.subject"), subjectCount());
      view.add(new TextInputField(scene, 0, c.subject.fieldY, {
        width: width - c.form.pad * 2 + 20, height: c.subject.height, value: subject, maxGlyphs: TICKET_SUBJECT_MAX, ariaLabel: t("support.field.subject"), icon: "edit", palette: SUPPORT_FIELD,
        onChange: (value) => { subject = value; subjectCounter?.setText(subjectCount()); },
      }));
      const bodyCounter = fieldLabel(c.body.labelY, t("support.field.body"), bodyCount());
      view.add(new TextInputField(scene, 0, c.body.fieldY, {
        width: width - c.form.pad * 2 + 20, height: c.body.height, value: bodyText, maxGlyphs: TICKET_BODY_MAX, ariaLabel: t("support.field.body"), multiline: true, fontSize: 28, palette: SUPPORT_FIELD,
        onChange: (value) => { bodyText = value; bodyCounter?.setText(bodyCount()); },
      }));
      const submit = proceed(supportActionXs(1)[0], t("support.submit"), () => {
        // 비어 있으면 서버를 부르지 않고 같은 오류 문구로 알린다(서버도 같은 판정을 한다).
        if (ticketDraftProblem({ subject, body: bodyText })) { failure("invalid_text"); return; }
        submit.setEnabled(false);
        void supportApi().submit({ category, subject: subject.trim(), body: bodyText.trim(), reportedUid: report?.uid }).then((result) => {
          if (!alive) return;
          if (!result.ok) { submit.setEnabled(true); failure(result.error); return; }
          subject = report ? t("support.report.subject", { name: report.name }) : ""; bodyText = ""; tickets = null; page = 0;
          notice(t("support.sent.title"), t("support.sent.body", { no: result.value.ticketNo }));
          paint();
        });
      });
    };

    /** 비었거나 불러오는 중 — 판 가운데에 큰 우편 표식과 한 줄. */
    const placeholder = (text: string): void => {
      const y = SUPPORT_POPUP.list.top + 300;
      view.add(drawGlyph(scene, "mail", 0, y - 80, 96, COLOR.inkDimHex, 0.45, 4));
      view.add(scene.add.text(0, y + 20, text, textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
    };

    const paintMine = (): void => {
      const c = SUPPORT_POPUP;
      if (tickets === null) {
        placeholder(t("support.loading"));
        void supportApi().listMine().then((result) => {
          if (!alive) return;
          if (!result.ok) { failure(result.error); tickets = []; } else tickets = result.value;
          if (tab === "mine") paint();
        });
        return;
      }
      if (tickets.length === 0) { placeholder(t("support.empty")); return; }
      const paged = paginate(tickets, page);
      page = paged.page;
      paged.slice.forEach((ticket, index) => {
        const y = c.list.top + c.list.rowHeight / 2 + index * (c.list.rowHeight + c.list.rowGap);
        const row = scene.add.container(0, y);
        const tone = SUPPORT_TONE.status[ticket.status];
        glass(row, 0, width, c.list.rowHeight, { bevel: 18, edge: tone.edge });
        // 왼쪽 빗금 하나가 상태의 색을 줄 전체에 묶는다.
        const stripe = scene.add.graphics();
        stripe.fillStyle(tone.edge, 0.95);
        stripe.fillPoints(slantPoints(8, c.list.rowHeight - 44, 8, -width / 2 + 26, 0), true);
        row.add(stripe);
        row.add(scene.add.text(-width / 2 + 50, -24, `${t("support.ticket.no", { no: ticket.ticketNo })} · ${t(`support.category.${ticket.category}` as TextKey)}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
        row.add(scene.add.text(-width / 2 + 50, 20, clipText(ticket.subject, 24), textStyle({ role: "emphasis", size: 28, color: ticket.status === "closed" ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0.5));
        statusTag(row, width / 2 - 24, -20, ticket.status);
        row.add(scene.add.text(width / 2 - 24, 24, ticket.updatedAt.slice(0, 10), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(1, 0.5));
        const hit = scene.add.rectangle(0, 0, width, c.list.rowHeight, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerdown", () => pressIn(row));
        hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
        hit.on("pointerup", () => { pressOut(row); openDetail(ticket.id); });
        row.add(hit);
        view.add(row);
      });
      // 넘기기는 조작 줄에 좌우로, 쪽 번호는 그 사이 가운데에 선다.
      const prev = secondary(-260, 240, t("support.prev"), () => { page -= 1; paint(); }).setEnabled(page > 0);
      const next = secondary(260, 240, t("support.next"), () => { page += 1; paint(); }).setEnabled(page < paged.pages - 1);
      actions.add([prev, next, scene.add.text(0, actionY, t("support.page", { page: page + 1, pages: paged.pages }), textStyle({ role: "emphasis", size: 28, color: COLOR.accentText })).setOrigin(0.5)]);
    };

    const openDetail = (id: string): void => {
      view.removeAll(true); actions.removeAll(true);
      placeholder(t("support.loading"));
      void supportApi().get(id).then((result) => {
        if (!alive) return;
        if (!result.ok) { failure(result.error); paint(); return; }
        paintDetail(result.value);
      });
    };

    const paintDetail = (ticket: TicketDetail): void => {
      view.removeAll(true); actions.removeAll(true);
      const c = SUPPORT_POPUP.detail;
      const tone = SUPPORT_TONE.status[ticket.status];
      glass(view, c.headY, width, c.headHeight, { edge: tone.edge, bevel: 20 });
      view.add(scene.add.text(-width / 2 + 28, c.headY - 22, `${t("support.ticket.no", { no: ticket.ticketNo })} · ${t(`support.category.${ticket.category}` as TextKey)}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      view.add(scene.add.text(-width / 2 + 28, c.headY + 20, clipText(ticket.subject, 26), textStyle({ role: "emphasis", size: 32, color: COLOR.ink })).setOrigin(0, 0.5));
      statusTag(view, width / 2 - 24, c.headY - 22, ticket.status);

      // 처음 글과 최근 메시지를 말풍선 판으로 쌓는다. 운영팀 답은 강조색 판·이름표로 갈라 읽힌다.
      // 칸을 넘치면 처음 글은 남기고 그다음 오래된 것부터 뺀다. 넘치는 글은 줄여 보이고 원문은 서버에 그대로 있다.
      const recent = ticket.messages.slice(-TICKET_MESSAGE_VISIBLE);
      const entries = [{ author: "player" as const, body: ticket.body }, ...recent];
      const textWidth = width - 72;
      const blocks = entries.map((entry) => {
        const staff = entry.author === "staff";
        const block = scene.add.container(0, 0);
        const text = scene.add.text(-width / 2 + 36, 52, clipText(entry.body), textStyle({ role: "body", size: 25, wrap: textWidth, lineSpacing: 6 })).setOrigin(0, 0);
        const height = Math.ceil(text.height) + 72;
        block.add(drawLayer(scene, 0, height / 2, chipPoints(width, height, { bevel: { topLeft: 16, topRight: 0, bottomRight: 16, bottomLeft: 0 } }), {
          fill: staff ? SUPPORT_TONE.staffFill : SUPPORT_TONE.panel, alpha: HOLO.glass, edge: staff ? COLOR.accent : COLOR.inkDimHex, edgeAlpha: staff ? 0.8 : 0.3, shadow: false,
        }));
        block.add(scene.add.text(-width / 2 + 36, 26, t(`support.author.${entry.author}` as TextKey), textStyle({ role: "emphasis", size: 22, color: staff ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5));
        block.add(text);
        return { block, height };
      });
      const gap = 14;
      const total = (): number => blocks.reduce((sum, b) => sum + b.height, 0) + gap * (blocks.length - 1);
      while (blocks.length > 1 && total() > c.textHeight) blocks.splice(1, 1)[0].block.destroy();
      let y = c.textTop;
      for (const { block, height } of blocks) { block.setY(y); view.add(block); y += height + gap; }

      let reply = "";
      if (ticket.status !== "closed") {
        fieldLabel(c.replyLabelY, t("support.field.reply"));
        view.add(new TextInputField(scene, 0, c.replyFieldY, { width, height: c.replyHeight, value: "", maxGlyphs: TICKET_BODY_MAX, ariaLabel: t("support.field.reply"), multiline: true, fontSize: 26, palette: SUPPORT_FIELD, onChange: (value) => { reply = value; } }));
        const send = proceed(supportActionXs(1)[0], t("support.reply.send"), () => {
          if (reply.trim().length === 0) { failure("invalid_text"); return; }
          send.setEnabled(false);
          void supportApi().addMessage(ticket.id, reply.trim()).then((result) => {
            if (!alive) return;
            if (!result.ok) { send.setEnabled(true); failure(result.error); return; }
            openDetail(ticket.id);
          });
        });
      }
      // 목록으로 돌아가는 길은 진행과 나란히 세우지 않고 라벨 줄 오른쪽 끝으로 비켜 둔다.
      const chip = SUPPORT_POPUP.footer.backChip;
      actions.add(new Button(scene, supportBackChipX(), SUPPORT_POPUP.footer.tabY, { width: chip.width, height: chip.height, fontSize: 28, label: `‹ ${t("support.back")}`, onClick: () => paint() }));
    };

    const paint = (): void => {
      view.removeAll(true); actions.removeAll(true);
      if (tab === "compose") paintCompose(); else paintMine();
    };

    paintTabs();
    paint();
  });
}
