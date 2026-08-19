import { applyPull, canPull, pull, spend } from "../core/gacha";
import { BANNERS } from "../data/banners";
import { session, type Session } from "../state/session";
import { GameApiError, type GameApi, type PlayerStateDto, type PullRequest, type PullResponse } from "./contracts";

/** FakeServer의 지연과 난수원을 테스트에서 결정적으로 바꾸기 위한 선택 설정이다. */
export interface FakeServerOptions {
  latencyMs?: number;
  random?: () => number;
}

/** 백엔드가 생기기 전까지 메모리 상태를 서버처럼 독점 변경하는 임시 어댑터다. */
export class FakeServer implements GameApi {
  private readonly latencyMs: number;
  private readonly random: () => number;

  constructor(
    private readonly state: Session = session,
    options: FakeServerOptions = {},
  ) {
    this.latencyMs = options.latencyMs ?? 180;
    this.random = options.random ?? Math.random;
  }

  /** 실제 통신처럼 다음 비동기 구간을 거친 뒤 직렬화 가능한 복사본을 돌려준다. */
  async getPlayerState(): Promise<PlayerStateDto> {
    await this.delay();
    return this.snapshot();
  }

  /** 비용 검사, 재화 차감, 난수 결과, 보유 반영을 모두 서버 경계 안에서 원자적으로 처리한다. */
  async pullRelics(request: PullRequest): Promise<PullResponse> {
    await this.delay();
    if (request.count !== 1 && request.count !== 10) {
      throw new GameApiError("INVALID_PULL_COUNT", "발굴 횟수는 1회 또는 10회여야 합니다.");
    }

    const banner = BANNERS.find((candidate) => candidate.id === request.bannerId);
    if (!banner) throw new GameApiError("BANNER_NOT_FOUND", "존재하지 않는 배너입니다.");
    if (!canPull(this.state.wallet, banner, request.count)) {
      throw new GameApiError("INSUFFICIENT_CURRENCY", "재화가 부족합니다.");
    }

    // 응답을 만들기 전에 서버 저장소 역할의 세션을 먼저 확정한다.
    this.state.wallet = spend(this.state.wallet, banner, request.count);
    const relicIds = pull(banner, request.count, this.random);
    const outcome = applyPull(this.state.owned, relicIds);
    return {
      ...this.snapshot(),
      relicIds,
      freshRelicIds: outcome.fresh,
      duplicateRelicIds: outcome.duplicates,
    };
  }

  private snapshot(): PlayerStateDto {
    // 중첩 슬롯까지 복사해 응답 변경이 서버 역할의 세션을 오염시키지 않게 한다.
    const relicProgress = Object.fromEntries(
      Object.entries(this.state.relicProgress).map(([id, progress]) => [id, { ...progress, heartGemSlots: [...progress.heartGemSlots] as typeof progress.heartGemSlots }]),
    );
    return {
      wallet: { ...this.state.wallet },
      ownedRelicIds: [...this.state.owned],
      relicProgress,
      ownedHeartGemIds: [...this.state.ownedHeartGemIds],
    };
  }

  private delay(): Promise<void> {
    // globalThis를 써서 브라우저와 Vitest(Node) 양쪽에서 같은 구현을 사용한다.
    return new Promise((resolve) => globalThis.setTimeout(resolve, this.latencyMs));
  }
}

/** 씬이 공유하는 임시 API 구현체다. 나중에는 이 한 줄을 HTTP 구현으로 교체한다. */
export const gameApi: GameApi = new FakeServer();
