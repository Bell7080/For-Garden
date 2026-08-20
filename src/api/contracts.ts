import type { Wallet } from "../core/gacha";
import type { RelicProgress } from "../core/types";

/** 네트워크로 직렬화할 수 있는 플레이어 진행 정보의 최소 규격이다. */
export interface PlayerStateDto {
  /** 서버가 확정한 현재 재화다. */
  wallet: Wallet;
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
}

/** 발굴 요청에는 클라이언트가 선택한 배너와 횟수만 보낸다. */
export interface PullRequest {
  bannerId: string;
  count: 1 | 10;
}

/** 서버가 확정한 발굴 결과와 그 직후 상태다. */
export interface PullResponse extends PlayerStateDto {
  relicIds: string[];
  freshRelicIds: string[];
  duplicateRelicIds: string[];
}

/** UI가 서버 실패 원인을 문구로 바꿀 수 있게 고정한 오류 코드다. */
export type ApiErrorCode = "BANNER_NOT_FOUND" | "INSUFFICIENT_CURRENCY" | "INVALID_PULL_COUNT";

/** 실제 HTTP API로 교체할 때도 씬이 의존할 단 하나의 통신 인터페이스다. */
export interface GameApi {
  getPlayerState(): Promise<PlayerStateDto>;
  pullRelics(request: PullRequest): Promise<PullResponse>;
}

/** 예상 가능한 요청 실패를 일반 네트워크 예외와 구분한다. */
export class GameApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = "GameApiError";
  }
}
