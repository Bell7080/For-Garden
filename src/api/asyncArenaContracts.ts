/**
 * 비동기 방어전의 서버 저장 규격 초안이다.
 *
 * 초기 출시 API에는 아직 연결하지 않는다. 이벤트와 기본 경제가 안정된 뒤 백엔드가 이 계약을
 * 구현할 때 `GameApi`에 조회·입장·입력 제출 메서드를 추가한다.
 */

/** 서버가 리플레이 호환성을 판별할 때 사용하는 전투 규칙 버전이다. */
export type SkirmishRulesVersion = string;

/** 성장 수치까지 고정한 방어 유닛이다. 서버는 현재 계정 상태가 아니라 이 값을 재현에 사용한다. */
export interface DefenseUnitSnapshot {
  /** 정적 `RelicDef`를 찾는 식별자다. */
  relicId: string;
  /** 스냅샷을 게시할 때 서버가 검증한 레벨이다. */
  level: number;
  /** 전투 보너스를 복원하기 위한 유대 단계다. */
  bondLevel: number;
  /** 시작 궁극기 등 전투 보너스를 복원하기 위한 각성 단계다. */
  breakthrough: number;
  /** 서버가 게시 시점에 확정한 룬 보정치다. 변경 가능한 인벤토리 객체나 인스턴스 ID를 노출하지 않는다. */
  runeStats: Readonly<Partial<Record<import("../core/runes").RuneStatKey, number>>>;
}

/** 매칭 중 성장이나 편성을 바꿔도 같은 상대와 싸우도록 만든 불변 방어 편성이다. */
export interface DefenseFormationSnapshot {
  snapshotId: string;
  ownerPlayerId: string;
  /** 세 자리의 순서도 전투 입력이므로 중복 없는 정확히 세 명이어야 한다. */
  units: [DefenseUnitSnapshot, DefenseUnitSnapshot, DefenseUnitSnapshot];
  /** 게시 순간 서버가 사용한 규칙과 정적 데이터 묶음의 버전이다. */
  rulesVersion: SkirmishRulesVersion;
  dataVersion: string;
  createdAt: string;
  /** 새 스냅샷으로 교체됐는지와 무관하게 이미 발급된 전투가 참조할 수 있는 만료 시각이다. */
  retainUntil: string;
}

/** UTC 일일 경계로 정규화되는 도전 횟수 상태다. */
export interface ArenaDailyAttempts {
  utcDate: string;
  used: number;
  limit: number;
}

/** 주간 경계에서 새 레코드로 교체되는 서버 권위 점수다. */
export interface ArenaWeeklyScore {
  weekId: string;
  score: number;
  wins: number;
  losses: number;
  /** 동점 정렬과 감사에 쓰는 마지막 서버 확정 시각이다. */
  updatedAt: string;
}

/** 시즌 보상은 경쟁력에 영향을 주지 않는 종류만 표현할 수 있다. */
export type ArenaCosmeticReward =
  | { kind: "profile_frame"; cosmeticId: string }
  | { kind: "title"; cosmeticId: string }
  | { kind: "soft_currency"; currency: "cheesecake" | "gold"; amount: number };

/** 시즌 종료 후 한 번만 수령 가능한 보상 상태다. */
export interface ArenaSeasonRewardState {
  seasonId: string;
  finalTier: string | null;
  rewards: ArenaCosmeticReward[];
  claimStatus: "not_eligible" | "claimable" | "claimed";
  claimedAt?: string;
}

/** 플레이어별 비동기 방어전 서버 상태의 집계 루트다. */
export interface AsyncArenaServerState {
  /** 서버 시즌 규칙이 확정한 공개 티어 ID다. 배치 전 계정은 null이며 클라이언트가 대신 만들지 않는다. */
  seasonTierId: string | null;
  activeDefenseSnapshotId: string | null;
  weekly: ArenaWeeklyScore;
  dailyAttempts: ArenaDailyAttempts;
  seasonReward: ArenaSeasonRewardState;
}

/** 프로필 등 읽기 화면이 서버 확정 결투장 상태만 조회하는 최소 API 경계다. */
export interface AsyncArenaProfileApi {
  /** 미개방·미배치 계정은 가짜 기본 티어 대신 null을 반환한다. */
  getAsyncArenaServerState(): Promise<AsyncArenaServerState | null>;
}

/** 서버가 발급한 전투 한 건이다. 시드와 양쪽 스냅샷이 재현 가능한 입력 전체를 고정한다. */
export interface ArenaBattleTicket {
  battleId: string;
  attackerPlayerId: string;
  attackerSnapshot: DefenseFormationSnapshot;
  defenderSnapshot: DefenseFormationSnapshot;
  /** 암호학적으로 예측 불가능한 서버 생성 시드이며 클라이언트가 고르지 않는다. */
  simulationSeed: string;
  issuedAt: string;
  expiresAt: string;
  /** 재전송으로 도전 횟수나 보상이 중복 반영되지 않게 하는 일회성 토큰이다. */
  submissionToken: string;
}

/** 클라이언트가 할 수 있는 결정만 기록하며 승패·피해·점수는 포함하지 않는다. */
export type ArenaPlayerCommand =
  // 야성은 전투가 스스로 채우고 가라앉히므로 플레이어가 기록할 전투 개입은 궁극기 발동뿐이다.
  { sequence: number; atTick: number; kind: "ultimate"; fighterSlot: 0 | 1 | 2 };

/** 클라이언트 제출물은 서버 재시뮬레이션에 필요한 결정 로그뿐이다. */
export interface SubmitArenaBattleRequest {
  battleId: string;
  submissionToken: string;
  /** 순번과 틱은 엄격히 증가하며 서버가 허용한 전투 시간 범위 안이어야 한다. */
  commands: ArenaPlayerCommand[];
}

/** 서버가 `src/core/skirmish.ts`를 재실행해 확정한 결과다. */
export interface ArenaBattleResult {
  battleId: string;
  outcome: "victory" | "defeat";
  durationTicks: number;
  scoreBefore: number;
  scoreAfter: number;
  attemptsRemaining: number;
  /** 재시도에는 같은 결과를 돌려주고 점수·횟수를 다시 변경하지 않는다. */
  alreadyResolved: boolean;
}
