import { calculateFinalStats } from "../core/relicProgression";
import type { RelicProgress, Stats } from "../core/types";
import { getHeartGem } from "../data/heartGems";
import { getRelic } from "../data/relics";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";

/** 성장 상태 변경과 Heart Gem 검증을 독점하는 공개 진입점이다. */
export class RelicProgressionManager {
  constructor(private readonly state: Session = session) {}

  /** 누락된 옛 저장 데이터도 안전한 기본 상태로 승격한다. */
  getProgress(relicId: string): RelicProgress {
    getRelic(relicId);
    return (this.state.relicProgress[relicId] ??= createInitialRelicProgress());
  }

  /** 레벨을 검증하고 칭호도 같은 트랜잭션에서 갱신한다. */
  setLevel(relicId: string, level: number, levelTitle: string): void {
    if (!Number.isInteger(level) || level < 1) throw new RangeError("레벨은 1 이상의 정수여야 합니다.");
    if (!levelTitle.trim()) throw new Error("레벨 칭호는 비워 둘 수 없습니다.");
    Object.assign(this.getProgress(relicId), { level, levelTitle });
    this.persistSharedSession();
  }

  /** DNA 숙련도는 정수 0~5일 때만 저장한다. */
  setDnaMastery(relicId: string, mastery: number): void {
    if (!Number.isInteger(mastery) || mastery < 0 || mastery > 5) throw new RangeError("DNA 숙련도는 0~5의 정수여야 합니다.");
    this.getProgress(relicId).dnaMastery = mastery;
    this.persistSharedSession();
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
    this.getProgress(relicId).heartGemSlots = [...slots] as RelicProgress["heartGemSlots"];
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
