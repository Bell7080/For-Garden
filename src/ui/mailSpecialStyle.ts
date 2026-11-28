import type { MailContent, MailSpecial } from "../core/mailCategory";
import { mailContentOf } from "../core/mailCategory";
import { BACKGROUND } from "./backgroundAssets";

/**
 * 특수 우편(콘텐츠 보상)의 결 — 콘텐츠마다 색 한 벌과 배경 원화 한 장. Phaser 없이 읽혀 테스트가 같은 값을 쓴다.
 *
 * 보통 우편은 남색 유리 카드에 봉투 아이콘이고, 콘텐츠 보상 우편은 **그 콘텐츠의 원화가 카드 오른쪽에 깔리고**
 * 왼쪽(글이 서는 쪽)은 어둠이 눌러 둔다. 윗변 선과 이름표가 콘텐츠 색이고, 아이콘 자리에는 티어 휘장(티어 우편)
 * 또는 순위 메달(순위 우편)이 선다. 한 목록에 섞여도 무엇을 보낸 우편인지 색과 그림이 먼저 말한다.
 */
export const MAIL_CONTENT_TONE: Readonly<Record<MailContent, { color: number; text: string; art: string }>> = {
  duel: { color: 0xff7a52, text: "#ffb39a", art: BACKGROUND.sortieDuel },
  arena: { color: 0xb98aff, text: "#d9c2ff", art: BACKGROUND.duelField },
  expedition: { color: 0x4fc6ea, text: "#a6e6f8", art: BACKGROUND.expeditionRanking },
  ancient: { color: 0xe0ac5e, text: "#f4d29c", art: BACKGROUND.ancientEntry },
  guild: { color: 0x6fd38a, text: "#b4efc4", art: BACKGROUND.guildWar },
};

/** 카드 원화의 누르기 — 글이 서는 왼쪽 55%는 짙게 버티고 오른쪽 끝에서 원화가 드러난다. */
export const MAIL_SPECIAL_FADE = { split: 0.55, left: 0.9, mid: 0.66, right: 0.18, wash: 0.16 } as const;

export function mailSpecialTone(special: MailSpecial): { color: number; text: string; art: string } {
  return MAIL_CONTENT_TONE[mailContentOf(special.kind)];
}

/** 티어 우편이면 휘장을, 아니면 순위 메달을 세운다. 순위 우편이라도 아레나 예전 우편처럼 티어를 알면 휘장이 선다. */
export function mailSpecialBadge(special: MailSpecial): { kind: "tier"; tier: string } | { kind: "rank"; rank: number } | { kind: "content" } {
  if (special.tier && (special.kind === "duelTier" || special.kind === "arenaTier" || special.kind === "arenaRank")) return { kind: "tier", tier: special.tier };
  if (special.rank && special.rank > 0) return { kind: "rank", rank: special.rank };
  return { kind: "content" };
}
