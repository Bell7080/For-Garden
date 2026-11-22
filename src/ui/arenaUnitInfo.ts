import type Phaser from "phaser";
import type { PublicRelicProfileDto } from "../api/contracts";
import type { ArenaUnit } from "../core/liveArena";
import { sceneInfoManager, type InfoManager } from "./info";

/**
 * 아레나 렐릭 하나를 공개 프로필 모양으로 옮긴다. 서버가 방을 만들 때 굳힌 대인전 능력치(`def.stats`)가
 * 그대로 실린다 — 내 렐릭이든 상대 렐릭이든 이 판에서 싸우는 값을 보여 준다.
 */
export function arenaUnitProfile(unit: ArenaUnit): PublicRelicProfileDto {
  return { relicId: unit.def.id, level: unit.level, breakthroughGrade: unit.breakthrough, stats: { ...unit.def.stats }, skillIds: [] };
}

/**
 * 아레나에서 렐릭을 꾹 누르면 **이 판의 모습**을 읽기 전용으로 연다(원정 도중 창과 같은 친구 문맥).
 * 밴·배치 시계가 도는 동안 급여·돌파를 열어 두면 그 값이 이 판에 먹는 것처럼 읽힌다.
 */
export function showArenaUnit(scene: Phaser.Scene, unit: ArenaUnit): InfoManager {
  const info = sceneInfoManager(scene, { key: "arena-unit", context: "friend" });
  info.setBrowsable(false);
  info.showFriend(arenaUnitProfile(unit));
  return info;
}
