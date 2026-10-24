/**
 * 로비가 연구원 레벨업을 **언제, 몇에서 몇으로** 알릴지 — Phaser를 모르는 순수 규칙.
 *
 * 레벨은 스테미나를 쓰는 곳마다 오르지만 알림은 로비 한 곳에서 모아 한 번 띄운다. **첫 플레이 튜토리얼 동안은
 * 띄우지 않는다** — 안내 화살표·선물 쪽지와 겹친다. 그 사이 오른 레벨은 버리지 않고 튜토리얼이 끝난 뒤 처음
 * 선 로비가 한 번에 알린다(`1 → 4`). 튜토리얼 중에 처음 선 로비는 기준을 1로 잡는다 — 튜토리얼이 끝나지
 * 않았다는 것은 그 사이 오른 레벨을 아직 한 번도 알리지 않았다는 뜻이다.
 */
export interface LevelUpAnnouncement {
  /** 다음 로비가 비교할 기준. */
  baseline: number | undefined;
  /** 이번에 알릴 오름. 없으면 띄우지 않는다. */
  announce?: { from: number; to: number };
}

export function levelUpAnnouncement(previous: number | undefined, level: number, tutorialActive: boolean): LevelUpAnnouncement {
  if (tutorialActive) return { baseline: previous ?? 1 };
  if (previous === undefined || level <= previous) return { baseline: level };
  return { baseline: level, announce: { from: previous, to: level } };
}
