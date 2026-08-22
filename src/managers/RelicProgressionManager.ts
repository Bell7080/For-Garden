import { AWAKENING_CAP, calculateFinalStats } from "../core/relicProgression";
import type { RelicProgress, Stats } from "../core/types";
import { getHeartGem } from "../data/heartGems";
import { getRelic } from "../data/relics";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";

/** 성장 상태 변경과 Heart Gem 검증을 독점하는 공개 진입점이다. */
export class RelicProgressionManager {
  constructor(private readonly state: Session = session) {}

  /** 읽기는 상태를 변경하지 않는다. 미보유 도감 미리보기에는 저장되지 않는 기본값만 돌려준다. */
  getProgress(relicId: string): RelicProgress {
    getRelic(relicId);
    return this.state.relicProgress[relicId] ?? createInitialRelicProgress();
  }

  /** 성장 변경은 보유 렐릭에만 허용해 보유 목록과 성장 레코드의 저장 불변식을 지킨다. */
  private ownedProgress(relicId: string): RelicProgress {
    getRelic(relicId);
    const progress = this.state.relicProgress[relicId];
    if (!this.state.owned.has(relicId) || !progress) throw new Error(`보유하지 않은 렐릭입니다: ${relicId}`);
    return progress;
  }

  /** 레벨은 정수만 저장한다. 경험치는 레벨이 바뀌면 그 레벨의 시작점으로 되돌린다. */
  setLevel(relicId: string, level: number): void {
    if (!Number.isInteger(level) || level < 1) throw new RangeError("레벨은 1 이상의 정수여야 합니다.");
    Object.assign(this.ownedProgress(relicId), { level, exp: 0 });
    this.persistSharedSession();
  }

  /** 각성 단계는 정수 0~5일 때만 저장한다. */
  setAwakening(relicId: string, awakening: number): void {
    if (!Number.isInteger(awakening) || awakening < 0 || awakening > AWAKENING_CAP) throw new RangeError("각성 단계는 0~5의 정수여야 합니다.");
    this.ownedProgress(relicId).awakening = awakening;
    this.persistSharedSession();
  }

  /**
   * 슬롯 하나만 갈아 끼운다.
   *
   * 정보창은 조각 하나를 눌러 고르므로, 세 자리를 통째로 넘기는 API를 화면이 다시 조립하게
   * 두면 그 조립 규칙이 화면마다 갈라진다. 같은 젬이 다른 자리에 있으면 그 자리를 비운다.
   */
  equipHeartGem(relicId: string, index: number, gemId: string | null): void {
    if (!Number.isInteger(index) || index < 0 || index > 2) throw new RangeError("Heart Gem 슬롯 번호가 올바르지 않습니다.");
    const slots = [...this.ownedProgress(relicId).heartGemSlots] as (string | null)[];
    if (gemId !== null) {
      const duplicate = slots.indexOf(gemId);
      if (duplicate !== -1) slots[duplicate] = null;
    }
    slots[index] = gemId;
    this.setHeartGemSlots(relicId, slots);
  }

  /** 정확히 세 슬롯, 빈 슬롯, 중복, 미보유 Heart Gem을 모두 한곳에서 검증한다. */
  setHeartGemSlots(relicId: string, slots: readonly (string | null)[]): void {
    if (slots.length !== 3) throw new RangeError("Heart Gem 슬롯은 정확히 3개여야 합니다.");
    const equipped = slots.filter((id): id is string => id !== null);
    if (new Set(equipped).size !== equipped.length) throw new Error("같은 Heart Gem을 중복 장착할 수 없습니다.");
    for (const id of equipped) {
      getHeartGem(id);
      if (!this.state.ownedHeartGemIds.includes(id)) throw new Error(`보유하지 않은 Heart Gem입니다: ${id}`);
    }
    this.ownedProgress(relicId).heartGemSlots = [...slots] as RelicProgress["heartGemSlots"];
    this.persistSharedSession();
  }

  /** UI와 전투가 공유할 최종 능력치를 순수 코어 계산기로 구한다. */
  getFinalStats(relicId: string): Stats {
    const progress = this.getProgress(relicId);
    const gems = progress.heartGemSlots.flatMap((id) => (id === null ? [] : [getHeartGem(id)]));
    return calculateFinalStats(getRelic(relicId).stats, progress, gems);
  }

  /** 성장 트랜잭션이 끝난 뒤에만 저장해 중간 상태가 남지 않게 한다. */
  private persistSharedSession(): void {
    if (this.state === session) saveManager.save(this.state);
  }
}

/** 앱에서 공유하는 기본 성장 매니저다. */
export const relicProgression = new RelicProgressionManager();
