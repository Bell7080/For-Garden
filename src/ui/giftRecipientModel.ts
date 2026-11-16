/**
 * 선물 받을 사람 고르기 창의 순수 모델 — 친구·길드 두 탭의 줄과 쪽 나누기.
 *
 * 서버가 친구 또는 같은 길드에 14일 넘게 함께 있은 사람만 받게 하므로(`giftEligibility`) 두 목록을 모두 세운다.
 * 자격은 여기서 셈하지 않는다 — 줄을 고른 순간 서버(`getGiftOptions`)가 그 사람에게 그 상품을 보낼 수 있는지 답한다.
 */
export type GiftRecipientTab = "friends" | "guild";

export interface GiftRecipientRow { id: string; name: string; level: number; relicId: string }

export const GIFT_RECIPIENT_PAGE_SIZE = 6;

export interface GiftRecipientSources {
  friends: readonly { id: string; displayName: string; level: number; favoriteRelic: { relicId: string } }[];
  guild: readonly { userId: string; name: string; level: number; avatarRelicId: string; isMe: boolean }[];
}

/** 탭마다의 줄. 길드는 나를 빼고, 둘 다 이름순이다(같은 이름은 id순). */
export function giftRecipientRows(sources: GiftRecipientSources, tab: GiftRecipientTab): GiftRecipientRow[] {
  const rows = tab === "friends"
    ? sources.friends.map(friend => ({ id: friend.id, name: friend.displayName, level: friend.level, relicId: friend.favoriteRelic.relicId }))
    : sources.guild.filter(member => !member.isMe).map(member => ({ id: member.userId, name: member.name, level: member.level, relicId: member.avatarRelicId }));
  const seen = new Set<string>();
  return rows.filter(row => !seen.has(row.id) && seen.add(row.id))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/** 쪽 수(줄이 없어도 1)와, 범위를 벗어난 쪽 번호를 안으로 당긴 값. */
export function giftRecipientPage(rows: readonly GiftRecipientRow[], page: number): { page: number; pages: number; rows: GiftRecipientRow[] } {
  const pages = Math.max(1, Math.ceil(rows.length / GIFT_RECIPIENT_PAGE_SIZE));
  const clamped = Math.min(pages - 1, Math.max(0, Math.floor(page)));
  return { page: clamped, pages, rows: rows.slice(clamped * GIFT_RECIPIENT_PAGE_SIZE, (clamped + 1) * GIFT_RECIPIENT_PAGE_SIZE) };
}
