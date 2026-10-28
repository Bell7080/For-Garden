import { getRelic } from "./relics";
import type { GuildGuardRoster } from "../core/guildGuard";
import type { Element } from "../core/types";

/**
 * 수호전 명단 — 그날 속성의 **스토리 적군**이 몰려온다(2026-10-28 응태 요청).
 *
 * 플레이어가 쓰는 아군 개체는 세우지 않는다 — 적 전용(`enemyOnly`) 개체 가운데 스토리 관문에 서는 공멸 단원과
 * 그 속성의 레이티아 겨울잠쥐만 쓴다. **정예는 따로 정해 둔 개체가 아니다** — 같은 명단에서 웨이브마다 무작위로
 * 골라 정예를 단다(같은 날 응태 요청). 그래서 무리와 정예가 한 명단을 함께 쓴다. 레이드 보스(공유 체력 자리)는
 * 쓰지 않는다. 개체 정의는 손대지 않고 레벨과 자리의 몫(`swarm`·`elite`)으로만 자란다.
 */
export const GUILD_GUARD_ROSTER_IDS: Readonly<Record<Element, readonly string[]>> = {
  fire: ["raitia-fire", "pulsi", "toby"],
  earth: ["raitia-earth", "mir", "amo"],
  water: ["raitia-water", "neuri", "ripa"],
  grass: ["raitia-grass", "koma", "atra"],
  wind: ["raitia-wind", "ikanixia"],
};

export function guildGuardRoster(element: Element): GuildGuardRoster {
  const pool = GUILD_GUARD_ROSTER_IDS[element].map((id) => getRelic(id));
  return { grunts: pool, elites: pool };
}
