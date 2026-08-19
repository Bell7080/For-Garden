import type { RelicDef } from "../core/types";
import type { PullOutcome } from "../core/gacha";
import { PLAYABLE_RELICS, getRelic } from "../data/relics";
import { session, type Session } from "../state/session";

/**
 * 보유 렐릭과 편성처럼 여러 화면이 함께 쓰는 수집 상태의 단일 진입점이다.
 *
 * 씬이 `Set`과 배열을 직접 고치기 시작하면 저장 데이터 검증, 중복 보상, 잠금 조건을
 * 추가할 때 모든 씬을 다시 고쳐야 한다. 이후 서버 저장소를 붙이더라도 이 매니저의
 * 공개 메서드는 유지하고 내부 저장 방식만 바꿀 수 있도록 상태 규칙을 이곳에 모은다.
 */
export class RelicCollectionManager {
  constructor(private readonly state: Session = session) {}

  /** 도감에 표시할 전체 플레이 가능 렐릭이다. 미보유 렐릭도 포함한다. */
  get catalog(): readonly RelicDef[] {
    return PLAYABLE_RELICS;
  }

  /** 실제 보유 렐릭만 도감 순서대로 반환한다. */
  get owned(): RelicDef[] {
    return PLAYABLE_RELICS.filter((relic) => this.state.owned.has(relic.id));
  }

  /** 보유 여부 검사를 한곳에서 처리해 잠금 규칙이 UI마다 달라지지 않게 한다. */
  owns(relicId: string): boolean {
    return this.state.owned.has(relicId);
  }

  /** 획득 결과를 반영한다. 이미 보유했다면 false를 반환해 추후 중복 보상에 연결할 수 있다. */
  acquire(relicId: string): boolean {
    getRelic(relicId); // 잘못된 콘텐츠 id가 저장 데이터에 들어가기 전에 즉시 막는다.
    const wasOwned = this.owns(relicId);
    this.state.owned.add(relicId);
    return !wasOwned;
  }

  /** 발굴 결과를 일괄 반영하고 신규/중복을 UI가 바로 표시할 수 있게 나눈다. */
  applyAcquisitions(relicIds: readonly string[]): PullOutcome {
    const outcome: PullOutcome = { fresh: [], duplicates: [] };
    for (const relicId of relicIds) {
      const target = this.acquire(relicId) ? outcome.fresh : outcome.duplicates;
      target.push(relicId);
    }
    return outcome;
  }

  /** 애착 렐릭은 반드시 보유한 플레이 가능 렐릭이어야 한다. */
  setFavorite(relicId: string): boolean {
    if (!this.owns(relicId) || !PLAYABLE_RELICS.some((relic) => relic.id === relicId)) return false;
    this.state.favorite = relicId;
    return true;
  }

  /** 파티는 서로 다른 보유 렐릭 3명으로만 확정한다. */
  setParty(relicIds: readonly string[]): boolean {
    const unique = new Set(relicIds);
    if (relicIds.length !== 3 || unique.size !== 3 || relicIds.some((id) => !this.owns(id))) return false;
    this.state.party = [...relicIds];
    return true;
  }
}

/** 앱 전체에서 공유하는 기본 수집 매니저다. 테스트에서는 별도 Session을 주입할 수 있다. */
export const relicCollection = new RelicCollectionManager();
