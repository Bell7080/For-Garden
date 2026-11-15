import type Phaser from "phaser";
import { arenaCall, type ArenaStatus } from "../api/arenaApi";
import type { DuelBattleInputDto } from "../core/expeditionBattle";
import type { ArenaRoom } from "../core/liveArena";
import { startScene } from "../ui/screenTransition";

/**
 * 서버가 열어 준 아레나 방(전투 단계 + 발급표)을 전투 입력으로 옮긴다 — 실시간 방(`ArenaRoomScene`)과 비동기 친선전이
 * 같은 함수를 읽는다. 전투 화면은 언제나 내 편을 아래에 세운다: 공격 편은 나, 상대 칸은 상대의 픽이다.
 */
export function arenaBattleInput(r: ArenaRoom, playerId: string): DuelBattleInputDto {
  const side = Math.max(0, r.players.findIndex((p) => p.id === playerId));
  const me = side, foe = 1 - side, opponent = r.players[foe];
  return {
    mode: "duel", requestId: r.id, attack: r.picks[me].map((p) => p.relicId), opponentName: opponent.name, opponentScore: 0,
    units: r.picks[foe].map((p) => { const u = opponent.roster.find((unit) => unit.def.id === p.relicId)!; return { relicId: p.relicId, level: u.level, breakthrough: u.breakthrough, stats: u.def.stats }; }),
    arena: { roomId: r.id, side, lease: r.lease!, practice: (r as ArenaRoom & { practice?: boolean }).practice === true, ...(r.ranked ? {} : { friendId: opponent.id }) },
  };
}

/**
 * 비동기 친선전 — 친구의 방어팀과 내 편성으로 곧바로 전투에 들어간다. 밴픽 방(「연결 중」)을 거치지 않는다:
 * 서버가 한 번의 호출로 방을 열고 발급표까지 세워 돌려준다. 친선전이라 RP·도전권·재화는 움직이지 않는다.
 * 거절은 던진다 — 편성 화면이 그 자리에서 알린다.
 */
export async function startArenaPractice(scene: Phaser.Scene, friendId: string, party: readonly string[]): Promise<void> {
  const status: ArenaStatus = await arenaCall("practice", { target: friendId, party: [...party], rules: { ban: false, order: "random", placement: "hidden", unique: true } });
  const r = status.room;
  if (!scene.scene.isActive()) return;
  if (!r || !r.lease) throw Error("ARENA_LEASE");
  startScene(scene, "battle", arenaBattleInput(r, status.playerId));
}

/** 결과판의 「다시 하기」 — 같은 편성으로 곧장 다시 붙는다. 실패는 `onError`가 받는다. */
export async function enterArenaPractice(scene: Phaser.Scene, friendId: string, party: readonly string[], onError: (error: unknown) => void): Promise<void> {
  try { await startArenaPractice(scene, friendId, party); } catch (error) { onError(error); }
}
