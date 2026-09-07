import type { RelicSkinId } from "../core/types";
import { getRelicSkin } from "../data/relicSkins";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type Session } from "../state/session";

/** 외형 변경을 소비하는 화면들이 저장 구현을 알지 않도록 manager가 발행하는 공개 사건이다. */
export interface RelicSkinChange { relicId: string; equippedSkinId?: RelicSkinId }

/** 렐릭 추가 외형의 소유·장착 검증과 저장을 독점하는 공개 경계다. */
export class RelicSkinManager {
  /** 씬 수명과 무관한 작은 구독 목록으로 도감·로비·정보창에 같은 변경을 전달한다. */
  private readonly listeners = new Set<(change: RelicSkinChange) => void>();
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}

  /** 콘텐츠 표에 존재하는 스킨을 현재 계정이 획득했는지 반환한다. */
  owns(skinId: RelicSkinId): boolean { return this.state.ownedRelicSkinIds.has(skinId); }

  /** 장착 ID가 없으면 기본 외형이라는 뜻이므로 undefined를 그대로 반환한다. */
  equippedFor(relicId: string): RelicSkinId | undefined { return this.state.equippedRelicSkinIds[relicId]; }

  /** 구독 해제 함수를 돌려줘 씬 종료 시 죽은 화면 참조를 남기지 않는다. */
  subscribe(listener: (change: RelicSkinChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  /** 저장이 끝난 상태만 알린다. 실패한 조작은 어떤 화면도 다시 그리지 않는다. */
  private publish(relicId: string): void {
    const change = { relicId, equippedSkinId: this.equippedFor(relicId) };
    for (const listener of this.listeners) listener(change);
  }

  /** 렐릭·스킨 소유권과 대상 일치를 모두 통과한 경우에만 장착하고 저장한다. */
  equip(relicId: string, skinId: RelicSkinId): boolean {
    const skin = getRelicSkin(skinId);
    if (!this.state.owned.has(relicId) || !this.owns(skinId) || skin?.relicId !== relicId) return false;
    // 같은 선택은 쓰기와 이벤트성 저장 호출을 만들지 않는 멱등 성공으로 취급한다.
    if (this.state.equippedRelicSkinIds[relicId] === skinId) return true;
    this.state.equippedRelicSkinIds[relicId] = skinId;
    this.saves.save(this.state);
    this.publish(relicId);
    return true;
  }

  /** 추가 외형 선택을 제거해 기본 외형으로 되돌리고, 실제 변경이 있을 때만 저장한다. */
  unequip(relicId: string): boolean {
    if (!this.state.owned.has(relicId) || this.state.equippedRelicSkinIds[relicId] === undefined) return false;
    delete this.state.equippedRelicSkinIds[relicId];
    this.saves.save(this.state);
    this.publish(relicId);
    return true;
  }

}

/** 앱 전역 세션을 사용하는 기본 외형 관리자다. */
export const relicSkinManager = new RelicSkinManager();
