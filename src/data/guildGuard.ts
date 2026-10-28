import { getRelic } from "./relics";
import type { GuildGuardRoster } from "../core/guildGuard";
import type { Element } from "../core/types";

/**
 * 수호전 명단 — 그날 속성의 **스토리 적군**이 몰려온다(2026-10-28 응태 요청).
 *
 * 플레이어가 쓰는 아군 개체는 세우지 않는다 — 적 전용(`enemyOnly`) 개체 가운데 스토리 관문에 서는 공멸 단원과
 * 그 속성의 레이티아 겨울잠쥐만 쓴다. 웨이브마다 이 명단에서 섞어 고르고 **모두 무리(`swarm`)로 선다**(같은 날 응태
 * 요청 — 정예 자리를 걷어 냈다). 레이드 보스(공유 체력 자리)는 쓰지 않는다. 개체 정의는 손대지 않고 레벨과 자리의
 * 몫으로만 자란다.
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
  return { units: pool };
}
