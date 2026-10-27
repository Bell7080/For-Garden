import { RELICS } from "./relics";
import type { GuildGuardRoster } from "../core/guildGuard";
import type { Element, RelicDef } from "../core/types";

/**
 * 수호전 명단 — 그날 속성의 개체들이 몰려온다.
 *
 * **무리**는 R 등급(적 전용 포함)과 그 속성의 레이티아 자매, **정예**는 SR·SSR이다. 레이드 보스(공유 체력 자리)와
 * 소환수를 데리고 다니는 개체(디안·모르페)는 빼고, 소환 전용 몸도 세우지 않는다 — 웨이브로 수십이 서는 판에 소환수까지
 * 붙으면 머릿수 상한이 소환수로 찬다. 개체 정의는 손대지 않고 레벨과 자리의 몫(`swarm`·`elite`)으로만 자란다.
 */
const RAID_BOSSES = new Set(["pontos", "taboa", "sukusuino", "quetzalcoatlus"]);

function eligible(def: RelicDef): boolean {
  return def.summonOnly !== true && !RAID_BOSSES.has(def.id) && (def.summons?.length ?? 0) === 0;
}

export function guildGuardRoster(element: Element): GuildGuardRoster {
  const pool = RELICS.filter((def) => def.element === element && eligible(def));
  const grunts = pool.filter((def) => def.rarity === "R" || def.id.startsWith("raitia-"));
  const elites = pool.filter((def) => (def.rarity === "SR" || def.rarity === "SSR") && !def.id.startsWith("raitia-"));
  return { grunts, elites };
}
