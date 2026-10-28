import { BOND_TOTAL_XP_BY_LEVEL, BOND_LEVEL_CAP } from "./bond";
import type { CombatJournal } from "./combatProtocol";
import type { ExpeditionRelicSnapshot } from "./expeditionSnapshot";
import { isExpeditionRelicSnapshot } from "./expeditionSnapshot";
import type { PassEntitlementDto } from "../api/contracts";
import { isValidOpsJournal, type OpsJournal } from "./opsInbox";

/** 지급 결과와 처리 표식을 같은 저장에 담는다. 공개 계정 스냅샷은 영수증에 중복 저장하지 않는다. */
export interface ServerJournal {
  combat?: CombatJournal;
  /** 노드마다 최초 선택만 기록해 재접속·다른 요청 ID로도 보상을 중복 지급하지 않는다. */
  storyChoices?: Record<string, Record<string, string>>;
  /** 아직 만나지 않은 렐릭에게 쌓인 이야기 유대. 최초 획득과 같은 저장에서 소진한다. */
  pendingStoryBondXp?: Record<string, number>;
  receipts: Record<string, { identity: string; result: Record<string, unknown> }>;
  raidAdmissions: Record<string, { replayVersion?: 2; seed?: string; admittedAt?: string; raidId: string; seasonHp: number; expiresAt: string; relics: { relicId: string; snapshot: ExpeditionRelicSnapshot }[] }>;
  subscriptionEntitlements?: Record<string, PassEntitlementDto>;
  subscriptionBonusDates?: Record<string, string>;
  /** 운영 도구가 보낸 우편·재화 조정의 처리 기록(`opsInbox`). */
  ops?: OpsJournal;
  /** QA 디버그 도구가 걸어 둔 「다음 10연 승급 찬스」. 개발 도구가 켜진 서버만 읽고, 10연 한 번에 꺼낸다. */
  qaTenUpgrade?: boolean;
  /** 수호전 오늘의 도전 수와 최고 점수(UTC 날짜 번호로 묶인다). */
  guildGuard?: { day: number; used: number; best: number };
  /** 수호전 입장 영수증 — 입장 순간의 편성 사본과 시드. 제출은 이것으로만 다시 굴린다. */
  guildGuardAdmissions?: Record<string, GuildGuardAdmission>;
  subscriptionMails?: Record<string, { entitlementId: string; productId: string; sentAt: string; expiresAt: string; itemId: string; amount: number }>;
}

export interface GuildGuardAdmission {
  seed: string;
  day: number;
  element: string;
  expiresAt: string;
  lineup: ({ relicId: string; snapshot: ExpeditionRelicSnapshot } | null)[];
  /** 확정된 판이면 그 결과(재전송은 같은 답을 받는다). */
  settled?: boolean;
}

export const emptyServerJournal = (): ServerJournal => ({ receipts: {}, raidAdmissions: {} });

export function isValidServerJournal(value: unknown): value is ServerJournal {
  if (!value || typeof value !== "object") return false;
  const journal = value as ServerJournal;
  const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  const json = (v: unknown): boolean => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))
    || (Array.isArray(v) ? v.every(json) : record(v) && Object.values(v).every(json));
  return (journal.qaTenUpgrade === undefined || typeof journal.qaTenUpgrade === "boolean")
    && (journal.storyChoices === undefined || record(journal.storyChoices) && Object.entries(journal.storyChoices).every(([id, choices]) => id.length > 0 && id.length <= 120 && record(choices) && Object.entries(choices).every(([node, choice]) => node.length > 0 && typeof choice === "string" && choice.length > 0)))
    && (journal.pendingStoryBondXp === undefined || record(journal.pendingStoryBondXp) && Object.entries(journal.pendingStoryBondXp).every(([id, amount]) => id.length > 0 && Number.isSafeInteger(amount) && amount > 0 && amount <= BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_CAP]))
    && (journal.ops === undefined || isValidOpsJournal(journal.ops))
    && (journal.combat === undefined || record(journal.combat) && record(journal.combat.tickets) && record(journal.combat.records) && json(journal.combat))
    && (journal.subscriptionEntitlements === undefined || record(journal.subscriptionEntitlements) && Object.entries(journal.subscriptionEntitlements).every(([id, entry]) => record(entry)
    && entry.entitlementId === id && typeof entry.productId === "string" && Number.isFinite(Date.parse(entry.activatedAt))
    && (entry.expiresAt === null || Number.isFinite(Date.parse(entry.expiresAt))) && typeof entry.active === "boolean" && typeof entry.serverTime === "string"))
    && (journal.subscriptionBonusDates === undefined || record(journal.subscriptionBonusDates) && Object.values(journal.subscriptionBonusDates).every((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)))
    && (journal.subscriptionMails === undefined || record(journal.subscriptionMails) && Object.values(journal.subscriptionMails).every((mail) => record(mail)
      && typeof mail.entitlementId === "string" && typeof mail.productId === "string" && typeof mail.itemId === "string"
      && Number.isFinite(Date.parse(mail.sentAt)) && Number.isFinite(Date.parse(mail.expiresAt)) && Number.isInteger(mail.amount) && mail.amount > 0))
    && (journal.guildGuard === undefined || record(journal.guildGuard) && Number.isSafeInteger(journal.guildGuard.day) && Number.isSafeInteger(journal.guildGuard.used) && journal.guildGuard.used >= 0 && Number.isSafeInteger(journal.guildGuard.best) && journal.guildGuard.best >= 0)
    && (journal.guildGuardAdmissions === undefined || record(journal.guildGuardAdmissions) && Object.entries(journal.guildGuardAdmissions).every(([id, admission]) => id.length > 0 && record(admission)
      && typeof admission.seed === "string" && admission.seed.length <= 64 && Number.isSafeInteger(admission.day) && typeof admission.element === "string"
      && Number.isFinite(Date.parse(admission.expiresAt)) && (admission.settled === undefined || typeof admission.settled === "boolean")
      && Array.isArray(admission.lineup) && admission.lineup.length === 6
      && admission.lineup.every((slot) => slot === null || record(slot) && typeof slot.relicId === "string" && isExpeditionRelicSnapshot(slot.snapshot))))
    && record(journal.receipts) && record(journal.raidAdmissions)
    && Object.entries(journal.receipts).every(([id, receipt]) => id.length > 0 && record(receipt) && typeof receipt.identity === "string" && record(receipt.result) && json(receipt.result))
    && Object.entries(journal.raidAdmissions).every(([id, admission]) => id.length > 0 && record(admission) && typeof admission.raidId === "string"
      && (admission.seed === undefined || typeof admission.seed === "string" && admission.seed.length <= 64)
      && (admission.admittedAt === undefined || typeof admission.admittedAt === "string" && Number.isFinite(Date.parse(admission.admittedAt)))
      && (admission.replayVersion === undefined || admission.replayVersion === 2)
      && Number.isFinite(admission.seasonHp) && admission.seasonHp >= 0 && Number.isFinite(Date.parse(admission.expiresAt))
      && Array.isArray(admission.relics) && admission.relics.length === 3 && admission.relics.every((relic) => typeof relic.relicId === "string" && isExpeditionRelicSnapshot(relic.snapshot)));
}
