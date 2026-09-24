import type Phaser from "phaser";
import type { PublicRelicProfileDto } from "../api/contracts";
import type { ExpeditionRelicSnapshot } from "../core/expeditionSnapshot";
import { expeditionManager } from "../managers/ExpeditionManager";
import { sceneInfoManager, type InfoManager } from "./info";

/** 굳힌 모습을 정보창이 읽는 공개 프로필 모양으로 옮긴다. 친구 창과 같은 읽기 전용 길을 쓴다. */
export function expeditionSnapshotProfile(relicId: string, snapshot: ExpeditionRelicSnapshot): PublicRelicProfileDto {
  return {
    relicId,
    equippedSkinId: snapshot.skinId ?? undefined,
    level: snapshot.level,
    breakthroughGrade: snapshot.breakthrough + 1,
    stats: { ...snapshot.stats },
    skillIds: [],
  };
}

/**
 * 원정 도중 아군을 꾹 누르면 **떠날 때의 모습**을 연다.
 *
 * 지금 성장을 여는 창(급여·돌파·룬)을 띄우면 이 런에서 싸우지 않는 값을 보여 주고, 그 자리에서
 * 바꾼 것이 이 런에 먹는 것처럼 읽힌다. 그래서 친구 창과 같은 읽기 전용 문맥에 스냅샷을 싣는다 —
 * 무엇을 바꾸고 싶으면 원정 밖(도감·편성)에서 하고, 그 값은 다음 원정부터 먹는다.
 */
export function showExpeditionRelic(scene: Phaser.Scene, relicId: string, depth?: { portraitDepth: number; baseDepth: number }): InfoManager {
  const info = sceneInfoManager(scene, { key: "expedition-frozen", context: "friend", ...depth });
  info.showFriend(expeditionSnapshotProfile(relicId, expeditionManager.snapshotFor(relicId)));
  return info;
}
