import { describe, expect, it } from 'vitest';
import { arenaExitRoute } from '../../src/core/arenaExit';

const players = [{ id: 'me', name: '나', roster: [] }, { id: 'friend', name: '친구', roster: [] }];

describe('아레나 방에서 나가는 길', () => {
  it('친선전은 어느 자리에서 나가든 그 상대의 친선전 선택판으로 돌아간다', () => {
    expect(arenaExitRoute({ ranked: false, players }, 'me')).toEqual({ scene: 'friends', data: { arenaFriendId: 'friend' } });
    // 요청을 받은 쪽(1번 자리)도 보낸 친구의 선택판으로 간다.
    expect(arenaExitRoute({ ranked: false, players }, 'friend')).toEqual({ scene: 'friends', data: { arenaFriendId: 'me' } });
  });
  it('랭크전만 아레나 입구로 간다 — 친구가 함께 넘어와도 방의 종류가 이긴다', () => {
    expect(arenaExitRoute({ ranked: true, players }, 'me', 'friend')).toEqual({ scene: 'arena' });
  });
  it('방을 받지 못했으면 들어온 길이 알려 준 친구를 믿는다', () => {
    expect(arenaExitRoute(undefined, undefined, 'friend')).toEqual({ scene: 'friends', data: { arenaFriendId: 'friend' } });
    expect(arenaExitRoute(null, undefined)).toEqual({ scene: 'arena' });
  });
});
