import Phaser from "phaser";
import { t } from "../i18n";
import type { GameApi, MailDto, MailListResponse, MailRewardDto } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { findItem } from "../data/items";
import { formatCurrency } from "../core/formatCurrency";
import { MailManager } from "../managers/MailManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { addCategoryTab } from "./CategoryTab";
import { chipPoints, drawLayer, drawShapeEdge, HOLO, slantedRect, toPoints } from "./holo";
import { drawGlyph } from "./glyphs";
import { addFramedIcon, addItemFrame } from "./itemFrame";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./PopupLayer";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { COLOR, textStyle } from "./theme";
import { addSectionTitle } from "./SectionTitle";
import { fitTextToBox } from "./textFit";
import { shapeClipMask } from "./popupArt";
import { CurrencyGuidePopup } from "./CurrencyGuidePopup";
import { setDebugMailPopup } from "../debug";
import { pressIn, pressOut } from "./pressFeedback";
import { managerEvents } from "../managers/ManagerEvents";
import { isMailExpired, MAIL_DETAIL_LAYOUT, mailDetailRail, MAIL_POPUP_LAYOUT, mailListRows, mailRemaining, mailRewardSlots, mailRewardX, mailTabOf, mailTabX, sortMails, type MailTab } from "./mailPopupLayout";

const TABS: readonly MailTab[] = ["reward", "notice"];

/** 첨부물 한 칸의 그림 키. 재화는 지갑 아이콘, 아이템은 제 정의의 그림이다. */
function mailRewardTexture(reward: MailRewardDto): string {
  if (reward.kind === "currency") return CURRENCY_ICON_BY_WALLET[reward.currency];
  const icon = findItem(reward.itemId)?.icon;
  return icon?.kind === "asset" ? icon.key : icon?.kind === "currency" ? CURRENCY_ICON_BY_WALLET[icon.key] : "";
}

/**
 * 우편함 — **우편**(받을 것이 든 봉투)과 **안내**(읽을 글)를 두 탭으로 가른다.
 *
 * 우편은 줄마다 첨부 액자가 밑동에 주르륵 서고 오른쪽에 받기가 선다. 안내는 본문 첫 줄을 미리
 * 보이고 누르면 글 전체가 열린다. 탭은 가방·임무와 같은 전환 라벨로 목록 아래에 선다.
 */
export class MailPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private footer?: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Rectangle;
  private mask?: Phaser.Display.Masks.GeometryMask;
  private result?: MailListResponse;
  private tab: MailTab = "reward";
  /** 탭을 바꾸지 않은 채 다시 그릴 때는 보던 자리를 지킨다 — 받기 한 번에 목록이 맨 위로 튀지 않게. */
  private scroll = 0;
  private readonly manager: MailManager;
  private unsubscribeMail?: () => void;
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, api: GameApi = gameApi, private readonly onClose?: () => void) { this.manager = new MailManager(api, session); }

  /** 로비 위에 작업판 한 장만 열고 목록 조회 후 알림 점을 즉시 동기화한다. */
  open(): void {
    if (this.body) return;
    const { popup } = MAIL_POPUP_LAYOUT;
    const width = BASE_WIDTH - popup.widthInset; const height = BASE_HEIGHT - popup.heightInset;
    this.popups.open({ width, height, title: t("mail.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: false, backButton: true, onClose: () => { this.unsubscribeMail?.(); this.unsubscribeMail = undefined; this.body = undefined; this.content = undefined; this.footer = undefined; this.onClose?.(); } }, (body) => {
      this.body = body;
      // 마스크는 판이 사는 동안만 산다 — 닫는 연출이 도는 동안에도 목록은 그려지므로 `onClose`가 아니라 판의 파괴에 건다.
      body.once(Phaser.GameObjects.Events.DESTROY, () => { this.mask?.destroy(); this.mask = undefined; this.maskShape?.destroy(); this.maskShape = undefined; });
      this.unsubscribeMail = managerEvents.subscribe("mail", ({ list }) => {
        this.result = list;
        setDebugMailPopup({ open: true, unreadCount: list.unreadCount, claimableCount: list.claimableCount });
        this.render();
      });
      void this.manager.list();
    });
  }

  private select(tab: MailTab): void {
    if (tab === this.tab) return;
    this.tab = tab; this.scroll = 0; this.render();
  }

  private render(): void {
    if (!this.body || !this.result) return;
    const nowMs = Date.parse(this.result.serverTime);
    const mails = sortMails(this.result.mails, this.tab, nowMs);
    const { viewport } = MAIL_POPUP_LAYOUT;
    // 새 목록을 먼저 세우고 옛 것을 걷는다 — 거꾸로 하면 한 프레임 비어 번쩍인다.
    const previous = this.content;
    const content = this.scene.add.container(0, viewport.top);
    this.body.add(content);
    const rows = mailListRows(this.tab, mails.length);
    mails.forEach((mail, index) => {
      if (this.tab === "reward") this.renderRewardMail(content, mail, rows.centers[index], nowMs);
      else this.renderNotice(content, mail, rows.centers[index], nowMs);
    });
    if (mails.length === 0) content.add(this.scene.add.text(0, (viewport.bottom - viewport.top) / 2, t(this.tab === "reward" ? "mail.empty.reward" : "mail.empty.notice"), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0.5));
    previous?.destroy();
    this.content = content;
    this.attachScroll(content, rows.contentHeight);
    this.renderFooter();
  }

  /** 목록이 창보다 길면 판 안에서만 흐른다. 마스크는 판의 월드 자리로 한 번 맞춘다. */
  private attachScroll(content: Phaser.GameObjects.Container, contentHeight: number): void {
    const body = this.body; if (!body) return;
    const { viewport } = MAIL_POPUP_LAYOUT;
    const viewHeight = viewport.bottom - viewport.top;
    const minScroll = Math.min(0, viewHeight - contentHeight);
    this.scroll = Phaser.Math.Clamp(this.scroll, minScroll, 0);
    content.y = viewport.top + this.scroll;
    if (!this.maskShape) {
      const matrix = body.getWorldTransformMatrix();
      const center = matrix.transformPoint(0, (viewport.top + viewport.bottom) / 2);
      this.maskShape = this.scene.add.rectangle(center.x, center.y, viewport.width * body.scaleX, viewHeight * body.scaleY, 0xffffff).setVisible(false);
      this.mask = this.maskShape.createGeometryMask();
      const drag = this.scene.add.rectangle(0, (viewport.top + viewport.bottom) / 2, viewport.width, viewHeight, 0xffffff, 0).setInteractive({ draggable: true });
      let lastY = 0;
      drag.on("dragstart", (pointer: Phaser.Input.Pointer) => { lastY = pointer.y; });
      drag.on("drag", (pointer: Phaser.Input.Pointer) => { this.moveScroll(pointer.y - lastY); lastY = pointer.y; });
      drag.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => this.moveScroll(-dy * 0.65));
      body.add(drag); body.sendToBack(drag);
    }
    if (this.mask) content.setMask(this.mask);
    content.setData("minScroll", minScroll);
  }

  private moveScroll(delta: number): void {
    const content = this.content; if (!content) return;
    this.scroll = Phaser.Math.Clamp(this.scroll + delta, Number(content.getData("minScroll") ?? 0), 0);
    content.y = MAIL_POPUP_LAYOUT.viewport.top + this.scroll;
  }

  /** 카드 판과 왼쪽 위의 봉투 아이콘. 안 읽은 것은 강조선과 작은 마름모가 먼저 말한다. */
  private addCardChrome(parent: Phaser.GameObjects.Container, mail: MailDto, y: number, height: number, dim: boolean, glyph: "mail" | "scroll"): void {
    const { card } = MAIL_POPUP_LAYOUT;
    const shape = chipPoints(card.width, height, { bevel: { topLeft: 30, topRight: 0, bottomRight: 30, bottomLeft: 0 } });
    parent.add(drawLayer(this.scene, 0, y, shape, { fill: dim ? 0x12161b : mail.read ? 0x18202a : 0x1e2a38, alpha: dim ? 0.62 : HOLO.glass }));
    if (!dim) parent.add(drawShapeEdge(this.scene, 0, y, shape, "top", { color: COLOR.accent, alpha: mail.read ? 0.4 : 0.9, width: mail.read ? 2 : 3 }));
    const iconX = -card.width / 2 + 34 + card.icon / 2;
    const iconY = y - height / 2 + 26 + card.icon / 2;
    parent.add(addItemFrame(this.scene, iconX, iconY, card.icon, { color: dim ? 0x68717d : COLOR.accent, outlineAlpha: dim ? 0.4 : 0.85 }));
    parent.add(drawGlyph(this.scene, glyph, iconX, iconY, card.icon * 0.5, dim ? COLOR.inkDimHex : COLOR.accent, dim ? 0.5 : 1));
    if (!mail.read && !dim) {
      const dot = this.scene.add.graphics({ x: iconX + card.icon / 2 - 4, y: iconY - card.icon / 2 + 4 });
      dot.fillStyle(0x05070a, 0.9).fillPoints(toPoints([0, -12, 12, 0, 0, 12, -12, 0]), true);
      dot.fillStyle(COLOR.missionClaim, 1).fillPoints(toPoints([0, -9, 9, 0, 0, 9, -9, 0]), true);
      parent.add(dot);
    }
  }

  /** 제목·보낸 이 한 덩어리와 오른쪽 위의 남은 기한. */
  private addHeadline(parent: Phaser.GameObjects.Container, mail: MailDto, y: number, height: number, dim: boolean, nowMs: number): void {
    const { card } = MAIL_POPUP_LAYOUT;
    const textX = -card.width / 2 + 34 + card.icon + 24;
    const top = y - height / 2 + 26;
    parent.add(this.scene.add.text(textX, top + 8, mail.title, textStyle({ role: "emphasis", size: 30, color: dim ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0));
    parent.add(this.scene.add.text(textX, top + 54, mail.sender, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0));
    const expiry = this.expiryLabel(mail, nowMs);
    const soon = !!mail.expiresAt && !isMailExpired(mail, nowMs) && Date.parse(mail.expiresAt) - nowMs < 3 * 86_400_000;
    parent.add(this.scene.add.text(card.width / 2 - 34, top + 12, expiry, textStyle({ role: "emphasis", size: 22, color: soon && !dim ? COLOR.dangerText : COLOR.inkDim })).setOrigin(1, 0));
  }

  /** 우편 한 장 — 첨부가 밑동에 주르륵 서고, 오른쪽에 받기(또는 받은 뒤의 한 마디). */
  private renderRewardMail(parent: Phaser.GameObjects.Container, mail: MailDto, y: number, nowMs: number): void {
    const { card, rewards } = MAIL_POPUP_LAYOUT;
    const height = card.rewardHeight;
    const expired = isMailExpired(mail, nowMs);
    const dim = expired || mail.claimed;
    this.addCardChrome(parent, mail, y, height, dim, "mail");
    this.addHeadline(parent, mail, y, height, dim, nowMs);
    const stripY = y + height / 2 - 30 - rewards.size / 2;
    // 첨부 줄 뒤에 얕은 홈을 깔아 "이 봉투에 든 것"이 한 줄로 묶여 읽히게 한다.
    const trayWidth = mailRewardX(rewards.maxVisible - 1) - mailRewardX(0) + rewards.size + 24;
    parent.add(drawLayer(this.scene, mailRewardX(0) - rewards.size / 2 - 12 + trayWidth / 2, stripY, slantedRect(trayWidth, rewards.size + 20, 14), { fill: 0x05070a, alpha: 0.45 }));
    const { shown, overflow } = mailRewardSlots(mail.rewards);
    shown.forEach((reward, index) => {
      const frame = addFramedIcon(this.scene, parent, mailRewardX(index), stripY, rewards.size, mailRewardTexture(reward), {
        amount: formatCurrency(reward.amount), iconAlpha: dim ? 0.4 : 1, outlineAlpha: dim ? 0.35 : undefined, color: dim ? 0x68717d : undefined,
      });
      if (dim) frame.setAlpha(0.75);
    });
    if (overflow > 0) {
      const x = mailRewardX(shown.length);
      parent.add(addItemFrame(this.scene, x, stripY, rewards.size, { color: 0x68717d, outlineAlpha: 0.6 }));
      parent.add(this.scene.add.text(x, stripY, `+${overflow}`, textStyle({ role: "display", size: 30, color: COLOR.inkDim })).setOrigin(0.5));
    }
    // 받기 버튼은 줄에 두지 않는다 — 우편을 눌러 펼친 판에서 글을 읽고 받는다. 줄은 상태만 말한다.
    if (dim) parent.add(this.scene.add.text(card.width / 2 - 96, stripY, t(expired ? "mail.state.expired" : "mail.state.claimed"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
    this.addOpenHit(parent, mail, y, height);
  }

  /** 카드 전체가 우편을 펼치는 입력면이다. 끌어서 흘린 손은 펼치지 않는다. */
  private addOpenHit(parent: Phaser.GameObjects.Container, mail: MailDto, y: number, height: number): void {
    const hit = this.scene.add.rectangle(0, y, MAIL_POPUP_LAYOUT.card.width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => { if (pointer.getDistance() < 24) void this.openMail(mail); });
    parent.add(hit);
  }

  /** 안내 한 장 — 본문 첫 줄만 미리 보이고 누르면 글 전체가 열린다. */
  private renderNotice(parent: Phaser.GameObjects.Container, mail: MailDto, y: number, nowMs: number): void {
    const { card } = MAIL_POPUP_LAYOUT;
    const height = card.noticeHeight;
    this.addCardChrome(parent, mail, y, height, false, "scroll");
    this.addHeadline(parent, mail, y, height, false, nowMs);
    const textX = -card.width / 2 + 34 + card.icon + 24;
    const preview = this.scene.add.text(textX, y + height / 2 - 30, mail.body.split("\n")[0] ?? "", textStyle({ role: "body", size: 23, color: mail.read ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 1);
    // 한 줄에 들지 않으면 잘라 말줄임을 단다 — 두 줄로 넘기면 카드 높이가 글마다 달라진다.
    const room = card.width / 2 - 40 - textX;
    if (preview.width > room) {
      let text = preview.text;
      while (text.length > 1 && preview.width > room) { text = text.slice(0, -1); preview.setText(`${text}…`); }
    }
    parent.add(preview);
    this.addOpenHit(parent, mail, y, height);
  }

  /**
   * 우편 한 통을 펼친다 — **위가 글, 아래가 첨부**다. 여는 순간 읽음으로 확정한다.
   *
   * 첨부는 줄에 받기 버튼을 두지 않고 여기서 받는다 — 무엇을 왜 받는지 읽고 나서 받게 하려는
   * 것이다. 첨부가 많으면 그 줄만 옆으로 흐르고, 액자를 누르면 그 재화·아이템의 안내가 열린다.
   */
  private async openMail(mail: MailDto): Promise<void> {
    const L = MAIL_DETAIL_LAYOUT;
    const nowMs = this.result ? Date.parse(this.result.serverTime) : Date.now();
    const expired = isMailExpired(mail, nowMs);
    const claimable = mail.rewards.length > 0 && !mail.claimed && !expired;
    const left = -L.width / 2 + L.padX;
    const textWidth = L.width - L.padX * 2;
    const hasRewards = mail.rewards.length > 0;
    let close: (() => void) | undefined;
    this.popups.open({ width: L.width, height: L.height, title: t(hasRewards ? "mail.tab.reward" : "mail.notice.heading"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.6, closeOnBackdrop: true }, (body, closePopup) => {
      close = closePopup;
      body.add(this.scene.add.text(left, L.titleY, mail.title, textStyle({ role: "display", size: 36, color: COLOR.ink, wrap: textWidth })).setOrigin(0, 0.5));
      body.add(this.scene.add.text(left, L.metaY, `${mail.sender}  ·  ${mail.sentAt.slice(0, 10)}  ·  ${this.expiryLabel(mail, nowMs)}`, textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
      const rule = this.scene.add.graphics(); rule.lineStyle(2, COLOR.accent, 0.5).lineBetween(left, L.ruleY, -left, L.ruleY); body.add(rule);
      const bodyBottom = hasRewards ? L.body.bottom : L.height / 2 - 70;
      const text = this.scene.add.text(left, L.body.top, mail.body, textStyle({ role: "body", size: 27, color: COLOR.ink, wrap: textWidth, lineSpacing: 10 })).setOrigin(0, 0);
      fitTextToBox(text, { width: textWidth, height: bodyBottom - L.body.top });
      body.add(text);
      if (!hasRewards) return;
      addSectionTitle(this.scene, left - 20, L.attachTitleY, t("mail.attachments", { count: mail.rewards.length }), { size: 26, parent: body });
      this.addDetailRail(body, mail.rewards, expired || mail.claimed);
      if (claimable) {
        body.add(new Button(this.scene, 0, L.claim.y, { width: L.claim.width, height: L.claim.height, label: t("mail.claim"), variant: "primary", onClick: () => { close?.(); void this.claim([mail.id]); } }));
      } else {
        body.add(this.scene.add.text(0, L.claim.y, t(expired ? "mail.state.expired" : "mail.state.claimed"), textStyle({ role: "emphasis", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
      }
    });
    if (!mail.read) await this.manager.read(mail.id);
  }

  /**
   * 펼친 판의 첨부 줄 — **끌면 흐르고 누르면 그 액자의 안내가 열린다.**
   *
   * 액자마다 입력면을 두지 않고 한 면이 둘을 함께 맡는다 — 줄 위를 덮는 끌기 면이 액자의 손짓을
   * 삼키지 않게, 얼마나 끌었는지로 누름과 끌기를 가른다(교류의 보상 줄과 같은 방법이다).
   * 마스크는 흐르지 않는 틀(`holder`)을 따라가므로 판이 떠오르는 동안에도 어긋나지 않는다.
   */
  private addDetailRail(body: Phaser.GameObjects.Container, rewards: readonly MailRewardDto[], dim: boolean): void {
    const L = MAIL_DETAIL_LAYOUT;
    const layout = mailDetailRail(rewards.length);
    const holder = this.scene.add.container(0, L.rail.y);
    const rail = this.scene.add.container(0, 0);
    holder.add(rail); body.add(holder);
    const frames = rewards.map((reward, index) => addFramedIcon(this.scene, rail, layout.xs[index], 0, L.rail.size, mailRewardTexture(reward), {
      amount: formatCurrency(reward.amount), plain: true, iconAlpha: dim ? 0.45 : 1, color: dim ? 0x68717d : undefined,
    }));
    const halfView = layout.viewWidth / 2;
    const half = L.rail.size / 2 + 12;
    rail.setMask(shapeClipMask(this.scene, holder, [-halfView - 8, -half, halfView + 8, -half, halfView + 8, half, -halfView - 8, half]));
    const overflow = Math.max(0, layout.contentWidth - layout.viewWidth);
    const hit = this.scene.add.rectangle(0, 0, layout.viewWidth + 16, L.rail.size + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
    holder.add(hit);
    let downX = 0; let originX = 0; let moved = 0; let dragging = false;
    let pressed: (typeof frames)[number] | undefined;
    const frameAt = (pointer: Phaser.Input.Pointer): number => {
      const local = holder.getWorldTransformMatrix().applyInverse(pointer.x, pointer.y);
      return frames.findIndex((frame) => Math.abs(local.x - rail.x - frame.x) <= L.rail.size / 2);
    };
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { dragging = true; downX = pointer.x; originX = rail.x; moved = 0; pressed = frames[frameAt(pointer)]; if (pressed) pressIn(pressed); });
    // 누른 액자만 제 크기로 돌아온다. 끌었거나 빠져나간 손은 튀지 않는다.
    const release = (tapped = false): void => { dragging = false; if (pressed) pressOut(pressed, "normal", { pop: tapped }); pressed = undefined; };
    hit.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!dragging || !pointer.isDown) return;
      moved = Math.max(moved, Math.abs(pointer.x - downX));
      if (moved > 12 && pressed) { pressOut(pressed, "normal", { pop: false }); pressed = undefined; }
      if (overflow > 0) rail.setX(Phaser.Math.Clamp(originX + (pointer.x - downX) / Math.max(0.01, holder.getWorldTransformMatrix().scaleX), -overflow, 0));
    });
    hit.on("pointerout", () => release());
    hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const index = moved <= 12 ? frameAt(pointer) : -1;
      release(index >= 0);
      const reward = rewards[index];
      if (reward) this.openRewardNote(reward);
    });
    // 넘치면 오른쪽 끝을 어둠으로 눌러 "더 있다"를 말한다.
    if (overflow > 0) {
      const fade = this.scene.add.graphics();
      fade.fillGradientStyle(0x05070a, 0x05070a, 0x05070a, 0x05070a, 0, 0.85, 0, 0.85);
      fade.fillRect(halfView - 60, -half, 68, half * 2);
      holder.add(fade);
    }
  }

  /** 첨부 액자 하나의 안내 — 재화는 공용 재화 안내, 아이템은 제 이름과 설명 한 장. */
  private openRewardNote(reward: MailRewardDto): void {
    if (reward.kind === "currency") { new CurrencyGuidePopup(this.scene, this.popups).open(reward.currency); return; }
    const item = findItem(reward.itemId);
    if (!item) return;
    this.popups.open({ width: 620, height: 320, title: item.name, dim: true, dimAlpha: 0.3, closeOnBackdrop: true }, (body) => {
      body.add(this.scene.add.text(0, 10, item.description, textStyle({ role: "body", size: 25, color: COLOR.ink, align: "center", wrap: 520 })).setOrigin(0.5));
    });
  }

  /** 하단 줄 — 우편·안내 라벨과, 지금 탭이 할 수 있는 일괄 조작 하나. */
  private renderFooter(): void {
    if (!this.body || !this.result) return;
    this.footer?.destroy();
    const footer = this.scene.add.container(0, 0); this.footer = footer; this.body.add(footer);
    const { footer: layout } = MAIL_POPUP_LAYOUT;
    const nowMs = Date.parse(this.result.serverTime);
    TABS.forEach((tab, index) => {
      const pending = this.result!.mails.filter((mail) => mailTabOf(mail) === tab && !isMailExpired(mail, nowMs) && (tab === "reward" ? !mail.claimed : !mail.read)).length;
      const label = addCategoryTab(this.scene, footer, { x: mailTabX(index), y: layout.tabY, width: layout.tab.width, height: layout.tab.height, label: t(tab === "reward" ? "mail.tab.reward" : "mail.tab.notice"), selected: tab === this.tab, onSelect: () => this.select(tab) });
      if (pending > 0) {
        const badge = this.scene.add.text(layout.tab.width / 2 - 14, -layout.tab.height / 2 + 4, `${pending}`, textStyle({ role: "display", size: 20, color: "#1a1206" })).setOrigin(0.5);
        const plate = this.scene.add.graphics({ x: badge.x, y: badge.y });
        const half = Math.max(16, badge.width / 2 + 9);
        plate.fillStyle(COLOR.missionClaim, 1).fillPoints(toPoints(slantedRect(half * 2, 30, 8)), true);
        label.add([plate, badge]);
      }
    });
    const claimable = this.manager.claimableIds(this.result);
    const unreadNotices = this.result.mails.filter((mail) => mailTabOf(mail) === "notice" && !mail.read).map(({ id }) => id);
    const action = this.tab === "reward"
      ? new Button(this.scene, layout.action.x, layout.action.y, { width: layout.action.width, height: layout.action.height, label: t("mail.claimAll"), variant: "primary", onClick: () => void this.claim(claimable) })
      : new Button(this.scene, layout.action.x, layout.action.y, { width: layout.action.width, height: layout.action.height, label: t("mail.readAll"), onClick: () => void this.readAll(unreadNotices) });
    if ((this.tab === "reward" ? claimable : unreadNotices).length === 0) action.setEnabled(false);
    footer.add(action);
  }

  private expiryLabel(mail: MailDto, nowMs: number): string {
    if (isMailExpired(mail, nowMs)) return t("mail.state.expired");
    const left = mailRemaining(mail.expiresAt, nowMs);
    if (!left) return t("mail.noExpiry");
    // 한 해가 넘게 남은 것은 사실상 기한이 없는 것이라 날짜를 세우지 않는다.
    if (left.days >= 365) return t("mail.noExpiry");
    if (left.days > 0) return t("mail.daysLeft", { days: left.days });
    return t("mail.hoursLeft", { hours: left.hours, minutes: String(left.minutes).padStart(2, "0") });
  }

  /** 서버 영수증 반영 뒤 지갑·점·상단 표시를 같은 흐름에서 갱신한다. */
  private async claim(ids: string[]): Promise<void> { if (!ids.length) return; await this.manager.claim(ids); }
  private async readAll(ids: string[]): Promise<void> { if (!ids.length) return; await this.manager.readAll(ids); }
}
