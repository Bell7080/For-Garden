import type { ArenaRoom } from './liveArena';

/**
 * 실시간 아레나 방에서 나가는 길. **친선전(랭크가 아닌 방)은 어디서 나가든 친구 화면의 친선전 선택판으로
 * 돌아가고**, 랭크전만 아레나 입구로 간다. 밴픽 화면의 취소·결과판의 돌아가기·전투가 끝난 뒤의 확인이 모두
 * 이 한 함수를 읽는다 — 한 곳만 `'arena'`를 적어 두면 친선전에서 나간 사람이 랭크 아레나에 떨어진다.
 *
 * 방을 아직 받지 못했을 때(조회 실패 등)는 들어온 길이 알려 준 친구(`friendId`)를 믿는다.
 */
export type ArenaExitRoute = { scene: 'arena' } | { scene: 'friends'; data: { arenaFriendId?: string } };

export function arenaExitRoute(room: Pick<ArenaRoom, 'ranked' | 'players'> | null | undefined, playerId: string | undefined, friendId?: string): ArenaExitRoute {
  if (room) {
    if (room.ranked) return { scene: 'arena' };
    const opponent = room.players.find((p) => p.id !== playerId);
    return { scene: 'friends', data: { arenaFriendId: opponent?.id ?? friendId } };
  }
  return friendId ? { scene: 'friends', data: { arenaFriendId: friendId } } : { scene: 'arena' };
}
