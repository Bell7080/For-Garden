import Phaser from "phaser";
import type { GameApi, MailDto, MailListResponse } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { MailManager } from "../managers/MailManager";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { Button } from "./Button";
import { chipPoints, drawLayer, HOLO } from "./holo";
import { addPopupBackButton } from "./IconButton";
import type { PopupLayer } from "./PopupLayer";
import { POPUP_TITLE_SIZE } from "./PopupLayer";
import { RewardFrame } from "./RewardFrame";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { COLOR, textStyle } from "./theme";
import { setDebugMailPopup } from "../debug";

/** 기존 작업판·보상 액자를 조합해 목록 상태와 첨부물을 한 화면에서 읽게 하는 우편함이다. */
export class MailPopup {
  private body?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private result?: MailListResponse;
  private readonly manager: MailManager;
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer, api: GameApi = gameApi, private readonly onChanged?: () => void, private readonly onClose?: () => void) { this.manager = new MailManager(api, session); }

  /** 로비 위에 작업판 한 장만 열고 목록 조회 후 알림 점을 즉시 동기화한다. */
  open(): void { if (this.body) return; const width = BASE_WIDTH - 100; const height = BASE_HEIGHT - 180; this.popups.open({ width, height, title: "우편함", titleSize: POPUP_TITLE_SIZE.workboard, dim: true, dimAlpha: 0.72, closeOnBackdrop: false, hideCloseButton: true, onClose: () => { this.content?.destroy(); this.body = undefined; this.onClose?.(); } }, (body, close) => { this.body = body; body.add(new Button(this.scene, 0, height / 2 - 118, { width: 420, height: 82, label: "첨부 보상 일괄 수령", variant: "primary", onClick: () => void this.claimAll() })); addPopupBackButton(this.scene, body, width, height, close); void this.refresh(true); }); }

  /** 서버 목록을 다시 받아 렌더하고 열기 자체로 달라질 수 있는 점도 갱신한다. */
  private async refresh(syncNotification = false): Promise<void> { this.result = await this.manager.list(); setDebugMailPopup({ open: true, unreadCount: this.result.unreadCount, claimableCount: this.result.claimableCount }); this.render(); if (syncNotification) await notificationManager.refresh(); }

  /** 제목·발신자·만료·읽음·수령 상태를 같은 행의 고정된 위치에 배치한다. */
  private render(): void { this.content?.destroy(); if (!this.body || !this.result) return; this.content = this.scene.add.container(0, 0); this.body.add(this.content); const serverNow = Date.parse(this.result.serverTime); this.result.mails.forEach((mail, index) => { const y = -570 + index * 280; const expired = !!mail.expiresAt && Date.parse(mail.expiresAt) <= serverNow; const panel = drawLayer(this.scene, 0, y, chipPoints(850, 236, { bevel: { topLeft: 28, topRight: 0, bottomRight: 28, bottomLeft: 0 } }), { fill: mail.read ? 0x171b20 : 0x202b38, alpha: mail.read ? 0.62 : HOLO.glass, edge: !mail.read ? COLOR.accent : 0x68717d, edgeAlpha: 0.58 }); const title = this.scene.add.text(-385, y - 88, mail.title, textStyle({ role: "emphasis", size: 28, color: expired ? COLOR.inkDim : COLOR.ink })).setOrigin(0, 0); const sender = this.scene.add.text(-385, y - 43, mail.sender, textStyle({ role: "body", size: 21, color: COLOR.inkDim })).setOrigin(0, 0); const state = expired ? "만료" : mail.claimed ? "수령 완료" : mail.rewards.length === 0 ? "안내" : mail.read ? "읽음 · 수령 가능" : "새 우편 · 수령 가능"; const status = this.scene.add.text(-385, y + 61, `${state}  ·  ${this.expiryLabel(mail)}`, textStyle({ role: "emphasis", size: 21, color: !expired && !mail.claimed && mail.rewards.length ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0); this.content?.add([panel, title, sender, status]); mail.rewards.filter((reward) => reward.kind === "currency").slice(0, 2).forEach((reward, rewardIndex) => this.content?.add(new RewardFrame(this.scene, 265 + rewardIndex * 112, y, { icon: CURRENCY_ICON_BY_WALLET[reward.currency], amount: reward.amount, size: 96, state: mail.claimed ? "claimed" : !expired ? "claimable" : "normal", onClick: !expired && !mail.claimed ? () => void this.claim([mail.id]) : undefined }))); const hit = this.scene.add.rectangle(-80, y, 600, 210, 0xffffff, 0).setInteractive({ useHandCursor: true }); hit.on("pointerup", () => void this.read(mail)); this.content?.add(hit); }); }

  /** 영구 우편과 UTC 만료 시각을 짧고 일관된 표기로 구분한다. */
  private expiryLabel(mail: MailDto): string { if (!mail.expiresAt) return "기한 없음"; return `만료 ${mail.expiresAt.slice(0, 10)}`; }
  /** 안내 우편을 눌러도 수령을 시도하지 않고 읽음 상태만 갱신한다. */
  private async read(mail: MailDto): Promise<void> { const now = this.result ? Date.parse(this.result.serverTime) : Date.now(); const claimable = mail.rewards.length > 0 && !mail.claimed && (!mail.expiresAt || Date.parse(mail.expiresAt) > now); if (claimable) { await this.claim([mail.id]); return; } if (!mail.read) this.result = await this.manager.read(mail.id); this.render(); await notificationManager.refresh(); }
  /** 서버 영수증 반영 뒤 지갑·점·상단 표시를 같은 흐름에서 갱신한다. */
  private async claim(ids: string[]): Promise<void> { if (!ids.length) return; await this.manager.claim(ids); await this.refresh(); this.onChanged?.(); await notificationManager.refresh(); }
  /** 현재 서버 시각에서 가능한 항목만 골라 반복 실행해도 지급이 늘지 않게 한다. */
  private async claimAll(): Promise<void> { if (!this.result) return; await this.claim(this.manager.claimableIds(this.result)); }
}
