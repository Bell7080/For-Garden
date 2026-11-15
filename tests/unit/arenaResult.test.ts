import { describe, it, expect } from 'vitest';
import { arenaUnseenResult, normalizeArenaSeen, sameArenaSeen } from '../../src/core/arenaNotice';
import { arenaGaugeSteps } from '../../src/core/arenaStanding';
import { normalizePartyContent, partyPreview } from '../../src/data/partyContent';
import { practiceDefenseIds, practicePartyIds } from '../../src/server/liveArena';
import { createDefaultSession } from '../../src/state/session';
import { getBattleStage } from '../../src/data/stages';
import { normalizeSettings } from '../../src/core/settings';

describe('아레나 결과 — 로비의 지난 판 알림', () => {
  const seen = { owner: 'uid-a', score: 1000, wins: 2, losses: 1 };
  it('결과판 없이 진 판이 쌓이면 패배로 한 번 알린다', () => {
    expect(arenaUnseenResult(seen, { ...seen, score: 980, losses: 2 })).toEqual({ outcome: 'loss', before: 1000, after: 980 });
    expect(arenaUnseenResult(seen, { ...seen, score: 1020, wins: 3 })).toEqual({ outcome: 'win', before: 1000, after: 1020 });
  });
  it('기록이 없거나 다른 계정이거나 바뀐 것이 없으면 알리지 않는다', () => {
    expect(arenaUnseenResult(null, seen)).toBeNull();
    expect(arenaUnseenResult(seen, { ...seen, owner: 'uid-b', losses: 5 })).toBeNull();
    expect(arenaUnseenResult(seen, { ...seen })).toBeNull();
  });
  it('승패가 함께 늘면 패배를 먼저 알린다', () => {
    expect(arenaUnseenResult(seen, { ...seen, wins: 3, losses: 2 })?.outcome).toBe('loss');
  });
  it('기기 설정에 저장되고 잘못된 값은 버린다', () => {
    expect(normalizeArenaSeen({ owner: '', score: 1, wins: 0, losses: 0 })).toBeNull();
    expect(normalizeArenaSeen({ owner: 'x', score: -1, wins: 0, losses: 0 })).toBeNull();
    expect(sameArenaSeen(normalizeArenaSeen(seen), seen)).toBe(true);
    expect(normalizeSettings({ game: { arenaSeen: seen } }).game.arenaSeen).toEqual(seen);
    expect(normalizeSettings({}).game.arenaSeen).toBeNull();
  });
});

describe('아레나 RP 게이지', () => {
  it('티어를 넘으면 끝까지 찼다가 다음 티어에서 이어 찬다', () => {
    const steps = arenaGaugeSteps(1080, 1120);
    expect(steps.map(({ tierId }) => tierId)).toEqual(['bronze', 'silver']);
    expect(steps[0].to).toBe(1);
    expect(steps[1].from).toBe(0);
  });
  it('깎이면 아래 티어로 내려가고 브론즈 밑으로는 가지 않는다', () => {
    expect(arenaGaugeSteps(1110, 1090).map(({ tierId }) => tierId)).toEqual(['silver', 'bronze']);
    expect(arenaGaugeSteps(50, 0)).toHaveLength(1);
  });
  it('마스터는 끝이 없어 늘 찬 줄이다', () => {
    const [step] = arenaGaugeSteps(2200, 2240);
    expect(step).toMatchObject({ tierId: 'master', top: true, to: 1 });
  });
});

describe('친선전 편성', () => {
  const state = () => {
    const s = createDefaultSession();
    s.owned = new Set([...s.owned, 'rex', 'mette', 'stella']);
    s.party = ['rex', 'mette', 'stella'];
    return s as unknown as Parameters<typeof practiceDefenseIds>[0];
  };
  it('친구의 편은 방어덱, 없으면 지금 편성에서 보유한 셋까지다', () => {
    const s = state();
    expect(practiceDefenseIds(s)).toEqual(['rex', 'mette', 'stella']);
    (s as { duel?: { defense: string[] } }).duel = { ...(s as { duel?: object }).duel, defense: ['stella', 'nonowned'] } as never;
    expect(practiceDefenseIds(s)).toEqual(['stella']);
  });
  it('내 편은 보낸 편성을 다시 가리고, 쓸 수 없으면 지금 편성이다', () => {
    const s = state();
    expect(practicePartyIds(s, ['mette'])).toEqual(['mette']);
    expect(practicePartyIds(s, ['mette', 'mette'])).toEqual(['rex', 'mette', 'stella']);
    expect(practicePartyIds(s, ['nonowned'])).toEqual(['rex', 'mette', 'stella']);
  });
  it('편성 화면은 친구의 방어팀(1~3)을 위에 세우고, 가려진 칸은 받지 않는다', () => {
    const friend = { id: 'f1', name: '친구', frameId: 'basic', favoriteRelicId: 'rex', level: 7 };
    const units = [{ relicId: 'rex', level: 10, breakthrough: 0, power: 900 }, { relicId: 'mette', level: 12, breakthrough: 1, power: 1100 }];
    const content = normalizePartyContent({ content: 'friendly', opponent: { id: 'f1', displayName: '친구', score: 0, totalPower: 2000, units }, friend });
    expect(content.content).toBe('friendly');
    const preview = partyPreview(content, getBattleStage('1-1'));
    expect(preview.shown).toHaveLength(2);
    expect(preview.totalPower).toBe(2000);
    expect(normalizePartyContent({ content: 'friendly', opponent: { id: 'f1', displayName: 'x', score: 0, units: [{ relicId: null, level: 1, breakthrough: 0, power: 1 }] }, friend }).content).toBe('stage');
    expect(normalizePartyContent({ content: 'friendly', opponent: { id: 'f2', displayName: 'x', score: 0, units }, friend }).content).toBe('stage');
  });
});
