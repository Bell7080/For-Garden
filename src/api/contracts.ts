import type { AcquisitionResult, Wallet } from "../core/gacha";
import type { RelicProgress } from "../core/types";

/** 네트워크로 직렬화할 수 있는 플레이어 진행 정보의 최소 규격이다. */
export interface PlayerStateDto {
  /** 서버가 확정한 현재 재화다. */
  wallet: Wallet;
  /** 서버가 확정한 배너별 SSR 천장 진행도다. */
  pullCountSinceHighestRarity: Record<string, number>;
  /** Set 대신 배열을 써서 JSON 응답과 같은 모양을 유지한다. */
  ownedRelicIds: string[];
  /** 렐릭 id별 성장과 Heart Gem 3슬롯 장착 상태다. */
  relicProgress: Record<string, RelicProgress>;
  /** 플레이어가 보유한 Heart Gem id 목록이다. */
  ownedHeartGemIds: string[];
  /** 서버 동기화 대상인 편성, 애착, 클리어 진행이다. 로컬 SaveData와 버전 책임은 분리한다. */
  party: string[];
  favorite: string;
  clearedStageIds: string[];
  /** 서버 UTC 키와 일일 복원 소비 횟수다. */
  dailyContent: { date: string; restorationEntries: number };
}

/** 발굴 요청에는 클라이언트가 선택한 배너와 횟수만 보낸다. */
export interface PullRequest {
  bannerId: string;
  count: 1 | 10;
}

/** 서버가 확정한 발굴 결과와 그 직후 상태다. */
export interface PullResponse extends PlayerStateDto {
  /** 추첨 순서를 보존하며 각 슬롯의 신규/숙련/상한 변화를 명시한다. */
  results: AcquisitionResult[];
  newRelicIds: string[];
  duplicateRelicIds: string[];
}

/** UI가 서버 실패 원인을 문구로 바꿀 수 있게 고정한 오류 코드다. */
export type ApiErrorCode = "BANNER_NOT_FOUND" | "INSUFFICIENT_CURRENCY" | "INVALID_PULL_COUNT" | "RELIC_NOT_FOUND" | "RELIC_MAX_LEVEL" | "STAGE_NOT_FOUND" | "DAILY_ENTRY_LIMIT";

/**
 * 급여 응답.
 *
 * 요청한 횟수를 다 먹이지 못할 수도 있으므로(잡초 부족·레벨 상한) 실제로 소비한 횟수와
 * 그때 오른 레벨 수를 함께 돌려준다. 화면은 이 값으로만 연출을 정한다.
 */
export interface FeedRelicResponse extends PlayerStateDto { relicId: string; feeds: number; weedsSpent: number; levelsGained: number; }
/** 돌파 결과. 열린 상한을 함께 돌려줘 화면이 표를 다시 뒤지지 않게 한다. */
export interface BreakThroughResponse extends PlayerStateDto { relicId: string; breakthrough: number; levelCap: number; }
/** 전투 확인 시 저장되는 보상으로 최초 여부와 획득 잡초를 결과 UI에 그대로 전달한다. */
export interface CompleteStageResponse extends PlayerStateDto { stageId: string; firstClear: boolean; weedsEarned: number; }
/** 로비 터치 결과는 중복 여부와 대사 UI가 표시할 유대 변화량을 돌려준다. */
export interface LobbyInteractionResponse extends PlayerStateDto { relicId: string; bondXpEarned: number; bondLevelsGained: number; }
/** 일일 입장 소비와 즉시 지급된 프로토타입 보상을 한 응답으로 확정한다. */
export interface EnterDailyRestorationResponse extends PlayerStateDto { entriesRemaining: number; weedsEarned: number; }

/** 실제 HTTP API로 교체할 때도 씬이 의존할 단 하나의 통신 인터페이스다. */
export interface GameApi {
  getPlayerState(): Promise<PlayerStateDto>;
  pullRelics(request: PullRequest): Promise<PullResponse>;
  /** 급여로 경험치를 올린다. 횟수를 넘기면 한 번에 여러 번 먹인다. */
  feedRelic(relicId: string, feeds?: number): Promise<FeedRelicResponse>;
  /** 레벨 상한을 한 단계 연다. 재료 차감과 단계 확정을 한 처리로 맡는다. */
  breakThroughRelic(relicId: string): Promise<BreakThroughResponse>;
  /** 패배도 서버에 명시해 승리 전용 보상이 새지 않도록 한다. */
  completeStage(stageId: string, victory?: boolean): Promise<CompleteStageResponse>;
  interactInLobby(relicId: string): Promise<LobbyInteractionResponse>;
  enterDailyRestoration(): Promise<EnterDailyRestorationResponse>;
}

/** 예상 가능한 요청 실패를 일반 네트워크 예외와 구분한다. */
export class GameApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = "GameApiError";
  }
}
