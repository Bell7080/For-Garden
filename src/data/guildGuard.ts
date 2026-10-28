import { getRelic } from "./relics";
import type { GuildGuardRoster } from "../core/guildGuard";
import type { Element } from "../core/types";

/**
 * 수호전 명단 — 그날 속성의 **스토리 적군**이 몰려온다(2026-10-28 응태 요청).
 *
 * 플레이어가 쓰는 아군 개체는 세우지 않는다 — 적 전용(`enemyOnly`) 개체 가운데 스토리 관문에 서는 공멸 단원과
 * 그 속성의 레이티아 겨울잠쥐만 쓴다. **무리**는 그 속성의 겨울잠쥐와 R급 단원, **정예**는 스토리에서 혼자 서는 정예로
 * 나왔던 개체다(1-5 토비 · 2-7/2-9 아모·리파 · 1-10 코마 · 3-5 아트라 · 3-10 이카니시아). 레이드 보스(공유 체력 자리)는
 * 쓰지 않는다. 개체 정의는 손대지 않고 레벨과 자리의 몫(`swarm`·`elite`)으로만 자란다.
 */
export const GUILD_GUARD_ROSTER_IDS: Readonly<Record<Element, { grunts: readonly string[]; elites: readonly string[] }>> = {
  fire: { grunts: ["raitia-fire", "pulsi"], elites: ["toby"] },
  earth: { grunts: ["raitia-earth", "mir"], elites: ["amo"] },
  water: { grunts: ["raitia-water", "neuri"], elites: ["ripa"] },
  grass: { grunts: ["raitia-grass"], elites: ["koma", "atra"] },
  wind: { grunts: ["raitia-wind"], elites: ["ikanixia"] },
};

export function guildGuardRoster(element: Element): GuildGuardRoster {
  const ids = GUILD_GUARD_ROSTER_IDS[element];
  return { grunts: ids.grunts.map((id) => getRelic(id)), elites: ids.elites.map((id) => getRelic(id)) };
}
