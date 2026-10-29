/**
 * 문의·버그·신고 접수. DB 함수(`submit_ticket` 등)를 로그인한 계정으로 부르며, 서버에 연결되지 않은 빌드는
 * `unsupported`를 돌려준다. 속도 제한·길이 검증은 서버가 하고, 화면은 돌려받은 오류 코드로 문구를 고른다.
 */
import type { AccountResult } from "./AccountApi";

export type TicketCategory = "inquiry" | "bug" | "report" | "privacy" | "other";
export type TicketStatus = "open" | "in_progress" | "answered" | "closed";
export type SupportError = "unsupported" | "network" | "no_player" | "invalid_category" | "invalid_text" | "rate_limited" | "not_found" | "ticket_closed";

export type SupportResult<T> = { ok: true; value: T } | { ok: false; error: SupportError };

export interface TicketSummary { id: string; ticketNo: number; category: TicketCategory; subject: string; status: TicketStatus; createdAt: string; updatedAt: string; }
export interface TicketMessage { author: "player" | "staff"; body: string; at: string; }
export interface TicketDetail extends Omit<TicketSummary, "updatedAt"> { body: string; messages: TicketMessage[]; }

/** 로그인한 계정으로 DB 함수를 부르는 최소 계약(`SupabaseAccountApi.callRpc`가 만족한다). */
export interface RpcCaller { callRpc(name: string, args: Record<string, unknown>): Promise<AccountResult<unknown>>; }

const KNOWN: ReadonlySet<string> = new Set(["no_player", "invalid_category", "invalid_text", "rate_limited", "not_found", "ticket_closed"]);

function fromRpc(r: AccountResult<unknown>): SupportResult<unknown> {
  if (!r.ok) return { ok: false, error: r.code === "unsupported" ? "unsupported" : "network" };
  const body = r.value as { ok?: boolean; error?: string } | null;
  if (body && body.ok === false) return { ok: false, error: KNOWN.has(body.error ?? "") ? (body.error as SupportError) : "network" };
  return { ok: true, value: r.value };
}

export class SupportApi {
  constructor(private readonly rpc: RpcCaller | null, private readonly meta: { version: string; platform: string }) {}

  private async call(name: string, args: Record<string, unknown>): Promise<SupportResult<unknown>> {
    if (!this.rpc) return { ok: false, error: "unsupported" };
    return fromRpc(await this.rpc.callRpc(name, args));
  }

  async submit(input: { category: TicketCategory; subject: string; body: string; reportedUid?: number }): Promise<SupportResult<{ id: string; ticketNo: number }>> {
    const r = await this.call("submit_ticket", {
      p_category: input.category, p_subject: input.subject, p_body: input.body,
      p_reported_uid: input.reportedUid ?? null, p_version: this.meta.version, p_platform: this.meta.platform,
    });
    if (!r.ok) return r;
    const v = r.value as { id?: string; ticket_no?: number };
    return typeof v.id === "string" && typeof v.ticket_no === "number" ? { ok: true, value: { id: v.id, ticketNo: v.ticket_no } } : { ok: false, error: "network" };
  }

  async listMine(): Promise<SupportResult<TicketSummary[]>> {
    const r = await this.call("list_my_tickets", {});
    if (!r.ok) return r;
    const rows = Array.isArray(r.value) ? (r.value as Array<Record<string, unknown>>) : [];
    return { ok: true, value: rows.map((t) => ({
      id: String(t.id), ticketNo: Number(t.ticket_no), category: t.category as TicketCategory, subject: String(t.subject),
      status: t.status as TicketStatus, createdAt: String(t.created_at), updatedAt: String(t.updated_at),
    })) };
  }

  async get(id: string): Promise<SupportResult<TicketDetail>> {
    const r = await this.call("get_my_ticket", { p_id: id });
    if (!r.ok) return r;
    const t = r.value as Record<string, unknown> | null;
    if (!t) return { ok: false, error: "not_found" };
    const messages = Array.isArray(t.messages) ? (t.messages as Array<Record<string, unknown>>) : [];
    return { ok: true, value: {
      id: String(t.id), ticketNo: Number(t.ticket_no), category: t.category as TicketCategory, subject: String(t.subject),
      status: t.status as TicketStatus, createdAt: String(t.created_at), body: String(t.body),
      messages: messages.map((m) => ({ author: m.author === "staff" ? "staff" : "player", body: String(m.body), at: String(m.at) })),
    } };
  }

  async addMessage(id: string, body: string): Promise<SupportResult<void>> {
    const r = await this.call("add_my_ticket_message", { p_id: id, p_body: body });
    return r.ok ? { ok: true, value: undefined } : r;
  }
}
