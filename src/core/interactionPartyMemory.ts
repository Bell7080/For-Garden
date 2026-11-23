/**
 * 교류 도시마다 마지막으로 보낸 파견대(`settings.game.interactionParties`) — 기기 선호다.
 *
 * **받고 나서도 배치가 빠지지 않는다**(응태 요청 2026-11-23). 파견을 받으면 서버 슬롯이 비고, 판이
 * 빈 칸으로 다시 서면 같은 셋을 또 보내려고 매번 셋을 다시 골라야 했다. 그래서 보낸 자리 그대로
 * 기억해 두었다가 그 도시가 비어 있을 때 칸에 미리 세운다 — 보내기 한 번이면 같은 구성으로 다시 간다.
 * 서버 규칙(인원·소유·다른 도시에 나가 있음)은 그대로이고 여기서는 **칸을 미리 채우기만** 한다.
 */
export const INTERACTION_PARTY_SLOTS = 3;
const MAX_CITIES = 64;
const MAX_ID_LENGTH = 64;

export type StoredInteractionParties = Readonly<Record<string, readonly (string | null)[]>>;

/** 저장에서 읽은 값을 도시 수·칸 수·ID 길이로 다듬는다. 모르는 모양은 버린다. */
export function normalizeInteractionParties(value: unknown): Record<string, (string | null)[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, (string | null)[]> = {};
  for (const [cityId, slots] of Object.entries(value as Record<string, unknown>).slice(0, MAX_CITIES)) {
    if (cityId.length === 0 || cityId.length > MAX_ID_LENGTH || !Array.isArray(slots)) continue;
    const seen = new Set<string>();
    const cleaned = Array.from({ length: INTERACTION_PARTY_SLOTS }, (_, index) => {
      const id = slots[index];
      if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
    if (cleaned.some((id) => id !== null)) out[cityId] = cleaned;
  }
  return out;
}

/**
 * 기억한 자리를 지금 세울 수 있는 이로만 되살린다. 잃었거나 다른 도시에 나가 있는 렐릭은 그 칸만
 * 비우고 나머지는 **제 자리를 지킨다** — 앞으로 당기면 손이 기억하는 자리와 어긋난다.
 * 세울 수 있는 이가 하나도 없으면 빈 편성이다.
 */
export function restoreInteractionParty(remembered: readonly (string | null)[] | undefined, available: ReadonlySet<string>, max = INTERACTION_PARTY_SLOTS): (string | null)[] {
  const slots: (string | null)[] = Array.from({ length: INTERACTION_PARTY_SLOTS }, () => null);
  if (!remembered) return slots;
  const seen = new Set<string>();
  let placed = 0;
  for (let index = 0; index < INTERACTION_PARTY_SLOTS; index += 1) {
    const id = remembered[index];
    if (!id || seen.has(id) || !available.has(id) || placed >= max) continue;
    seen.add(id);
    slots[index] = id;
    placed += 1;
  }
  return slots;
}

/** 보낸 편성을 기억할 모양으로 — 비면 그 도시의 기억을 지운다(`undefined`). */
export function interactionPartyToRemember(party: readonly (string | null)[]): (string | null)[] | undefined {
  const slots = normalizeInteractionParties({ city: party }).city;
  return slots;
}
