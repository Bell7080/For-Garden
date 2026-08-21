import type { RelicDef } from "../core/types";
import { PLAYABLE_RELICS } from "../data/relics";
import { session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";

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

  /** 애착 렐릭은 반드시 보유한 플레이 가능 렐릭이어야 한다. */
  setFavorite(relicId: string): boolean {
    if (!this.owns(relicId) || !PLAYABLE_RELICS.some((relic) => relic.id === relicId)) return false;
    this.state.favorite = relicId;
    this.persistSharedSession();
    return true;
  }

  /** 즐겨찾기 여부. 애착 렐릭과 달리 여러 명이 될 수 있다. */
  isBookmarked(relicId: string): boolean {
    return this.state.bookmarked.has(relicId);
  }

  /**
   * 즐겨찾기를 켜고 끈다. 보유하지 않은 렐릭은 담지 않는다.
   *
   * 애착 렐릭과 섞지 않는다. 애착은 로비에 서는 한 명이고 즐겨찾기는 목록을 추리는 표시라,
   * 하나를 바꿔도 다른 하나는 그대로 둔다.
   */
  toggleBookmark(relicId: string): boolean {
    if (!this.owns(relicId)) return false;
    if (this.state.bookmarked.has(relicId)) this.state.bookmarked.delete(relicId);
    else this.state.bookmarked.add(relicId);
    this.persistSharedSession();
    return true;
  }

  /** 파티는 서로 다른 보유 렐릭 3명으로만 확정한다. */
  setParty(relicIds: readonly string[]): boolean {
    const unique = new Set(relicIds);
    if (relicIds.length !== 3 || unique.size !== 3 || relicIds.some((id) => !this.owns(id))) return false;
    this.state.party = [...relicIds];
    this.persistSharedSession();
    return true;
  }

  /** 테스트 주입 상태는 디스크에 쓰지 않고 앱 공유 상태의 확정 변경만 저장한다. */
  private persistSharedSession(): void {
    if (this.state === session) saveManager.save(this.state);
  }
}

/** 앱 전체에서 공유하는 기본 수집 매니저다. 테스트에서는 별도 Session을 주입할 수 있다. */
export const relicCollection = new RelicCollectionManager();
