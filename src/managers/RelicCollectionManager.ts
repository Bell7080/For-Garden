import { BOND_XP_REWARD, grantBondXp } from "../core/bond";
import type { RelicDef } from "../core/types";
import { PLAYABLE_RELICS } from "../data/relics";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";

/** 편성 실패를 UI와 테스트가 문자열 추측 없이 구분하기 위한 안정적인 사유 코드다. */
export type SetPartyFailureReason = "wrong-size" | "duplicate" | "not-owned";

/** 성공과 검증 실패를 판별 가능한 형태로 돌려주는 편성 확정 결과다. */
export type SetPartyResult =
  | { ok: true }
  | { ok: false; reason: SetPartyFailureReason; relicId?: string };

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

  /** 파티는 서로 다른 보유 렐릭 3명으로만 확정하고, 실패하면 정확한 원인을 돌려준다. */
  setParty(relicIds: readonly string[]): SetPartyResult {
    const unique = new Set(relicIds);
    if (relicIds.length !== 3) return { ok: false, reason: "wrong-size" };
    if (unique.size !== 3) return { ok: false, reason: "duplicate" };
    const notOwnedId = relicIds.find((id) => !this.owns(id));
    if (notOwnedId !== undefined) return { ok: false, reason: "not-owned", relicId: notOwnedId };

    // 저장이 실패하면 메모리 파티도 이전 값으로 되돌려 확정과 영속화를 하나의 처리로 보이게 한다.
    const previousParty = [...this.state.party];
    this.state.party = [...relicIds];
    try {
      this.persistSharedSession();
    } catch (error) {
      this.state.party = previousParty;
      throw error;
    }
    return { ok: true };
  }

  /**
   * 모든 플레이 가능 렐릭을 즉시 보유 처리한다(임시 지급).
   *
   * 신규 스타터 렐릭 추가처럼 저장 마이그레이션이 옛 계정까지 소급하지 않는 변경을 QA가
   * 즉시 확인할 수 있게 하는 설정 화면 전용 디버그 진입점이다. 정식 획득 경로(연구소)만으로
   * 충분해지면 이 메서드를 지운다. 이미 보유한 렐릭은 건드리지 않는다.
   */
  grantAllForDebug(): number {
    const newlyOwned = PLAYABLE_RELICS.filter((relic) => !this.state.owned.has(relic.id));
    for (const relic of newlyOwned) {
      this.state.owned.add(relic.id);
      this.state.relicProgress[relic.id] ??= grantBondXp(createInitialRelicProgress(), BOND_XP_REWARD.firstAcquisition).progress;
    }
    if (newlyOwned.length > 0) this.persistSharedSession();
    return newlyOwned.length;
  }

  /** 테스트 주입 상태는 디스크에 쓰지 않고 앱 공유 상태의 확정 변경만 저장한다. */
  private persistSharedSession(): void {
    if (this.state === session) saveManager.save(this.state);
  }
}

/** 앱 전체에서 공유하는 기본 수집 매니저다. 테스트에서는 별도 Session을 주입할 수 있다. */
export const relicCollection = new RelicCollectionManager();
