import type Phaser from "phaser";
import type { ProfileFaceDto } from "../api/contracts";
import { RELICS } from "../data/relics";
import { RANKING_LIST } from "./expeditionRankingLayout";
import { ProfileAvatar } from "./ProfileAvatar";

/** 순위·명단 한 줄이 얼굴을 세우는 데 읽는 값 — 프로필 사진·테두리, 없으면 애착 렐릭. */
export type RankingFaceSource = ProfileFaceDto & { favoriteRelicId?: string | null };

/**
 * 순위 줄의 얼굴 — **플레이어 프로필 한 장**(`ProfileAvatar`)이다. 그 사람이 고른 사진과 두른 테두리가
 * 상단 줄·친구·길드 명단과 똑같이 선다. 사진이 비면 애착 렐릭, 그것도 없으면 이름 첫 글자다.
 *
 * `size`는 얼굴 한 변이고, 테두리 장식은 그 둘레로 `PROFILE_FRAME_REACH`만큼 뻗는다 — 부르는 쪽 배치표가
 * 그 넓이를 비워 둔다(`rankingLayouts.test.ts`).
 */
export function addRankingFace(scene: Phaser.Scene, row: Phaser.GameObjects.Container, source: RankingFaceSource, name: string, at: { x: number; y?: number; size: number } = { x: RANKING_LIST.faceX, size: RANKING_LIST.avatarSize }): ProfileAvatar {
  const avatar = new ProfileAvatar(scene, at.x, at.y ?? 0, {
    size: at.size,
    frameId: source.frameId ?? "",
    portraitAssetId: rankingFaceRelic(source)?.portraitAssetId,
    fallback: Array.from(name.trim())[0] ?? "?",
  });
  row.add(avatar);
  return avatar;
}

/** 사진 → 애착 렐릭 순으로 아는 개체를 고른다. 모르는 ID(지운 개체·옛 서버)는 건너뛴다. */
export function rankingFaceRelic(source: RankingFaceSource): (typeof RELICS)[number] | undefined {
  for (const id of [source.avatarRelicId, source.favoriteRelicId]) {
    const relic = id ? RELICS.find((candidate) => candidate.id === id) : undefined;
    if (relic) return relic;
  }
  return undefined;
}
