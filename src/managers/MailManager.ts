import type { ClaimMailRewardsResponse, GameApi, MailDto, MailListResponse } from "../api/contracts";
import type { Session } from "../state/session";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

/** 우편 API의 신뢰 경계와 지급 결과의 로컬 반영을 한곳에서 소유한다. */
export class MailManager {
  constructor(private readonly api: GameApi, private readonly state: Session, private readonly events: ManagerEvents = managerEvents) {}

  /** 화면에 넘기기 전에 날짜·ID·보상 수량을 검증하고 서버 배열에서 분리한다. */
  async list(): Promise<MailListResponse> { const result = await this.api.getMails(); this.assertList(result); this.publishMail(result); return structuredClone(result); }

  /** 우편을 펼친 순간 서버 읽음 상태까지 확정한다. */
  async read(mailId: string): Promise<MailListResponse> { if (!mailId) throw new Error("MAIL_ID_REQUIRED"); const result = await this.api.markMailsRead({ mailIds: [mailId] }); this.assertList(result); this.publishMail(result); return structuredClone(result); }

  /** 단일 수령도 일괄 수령과 같은 멱등 계약을 사용한다. */
  async claim(mailIds: readonly string[], requestId: string = crypto.randomUUID()): Promise<ClaimMailRewardsResponse> {
    const result = await this.api.claimMailRewards({ requestId, mailIds: [...new Set(mailIds)] }); this.assertList(result);
    // 서버 확정 스냅샷만 반영하며 UI가 보상 합계를 직접 더하지 않는다.
    this.state.wallet = { ...result.wallet };
    this.state.itemInventory = result.items.filter(({ category }) => category === "consumable" || category === "material").map(({ definitionId, quantity }) => ({ itemId: definitionId, quantity }));
    // 한 확정 영수증에서 지갑·가방·우편·알림을 동기 발행해 후속 API 조회로 시점이 갈리지 않게 한다.
    this.events.publish("wallet", { wallet: this.state.wallet }); this.events.publishInventory(); this.publishMail(result);
    return structuredClone(result);
  }

  /** 일괄 수령 대상은 만료·무첨부·기수령을 제외해 빈 요청도 안전하게 만든다. */
  claimableIds(result: MailListResponse): string[] { const now = Date.parse(result.serverTime); return result.mails.filter((mail) => mail.rewards.length > 0 && !mail.claimed && (!mail.expiresAt || Date.parse(mail.expiresAt) > now)).map(({ id }) => id); }

  /** 손상된 API 결과가 세션에 반영되기 전에 구조와 유일성을 거부한다. */
  private assertList(result: MailListResponse): void { if (!Number.isFinite(Date.parse(result.serverTime)) || new Set(result.mails.map(({ id }) => id)).size !== result.mails.length || result.mails.some((mail: MailDto) => !mail.id || !mail.title || !mail.sender || !Number.isFinite(Date.parse(mail.sentAt)) || (mail.expiresAt !== null && !Number.isFinite(Date.parse(mail.expiresAt))) || mail.rewards.some((reward) => !Number.isInteger(reward.amount) || reward.amount <= 0))) throw new Error("INVALID_MAIL_RESPONSE"); }

  /** 우편 응답이 아는 신호만 교체하고 다른 알림 키는 보존한다. */
  private publishMail(result: MailListResponse): void {
    this.events.publish("mail", { list: result }); this.events.publishMailNotification(result.unreadCount > 0);
  }
}
