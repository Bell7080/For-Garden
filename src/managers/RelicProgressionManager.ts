import { AWAKENING_CAP, calculateFinalStats } from "../core/relicProgression";
import type { RelicProgress, Stats } from "../core/types";
import { getRelic } from "../data/relics";
import { createStarterRunes } from "../data/runes";
import { createInitialRelicProgress, session, type Session } from "../state/session";
import { saveManager } from "../state/SaveManager";
import { gameApi } from "../api/FakeServer";
import type { GameApi, RuneInventoryDto } from "../api/contracts";

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
   * 가방이 비어 있을 때만 시작 룬을 넣어 준다(임시 지급).
   *
   * 세공 화면을 만져 볼 룬이 없으면 기능이 있는지조차 알 수 없다. 정식 획득 경로가 생기면
   * 이 메서드와 `createStarterRunes`를 함께 지운다. 이미 룬이 있으면 아무것도 하지 않으므로
   * 저장을 여러 번 열어도 가방이 불어나지 않는다.
   */
  grantStarterRunes(random: () => number = Math.random): number {
    if (this.state.runeInventory.length > 0) return 0;
    this.state.runeInventory = createStarterRunes(random);
    this.persistSharedSession();
    return this.state.runeInventory.length;
  }

  /** 서버가 검증한 장착 응답만 로컬 세션에 적용해 UI가 슬롯 불변식을 재구현하지 않게 한다. */
  async equipRune(relicId: string, slotIndex: number, runeInstanceId: string, api: GameApi = gameApi): Promise<void> {
    const response = await api.equipRune({ relicId, slotIndex, runeInstanceId });
    this.applyRuneInventory(response.inventory);
  }

  /** 빈 슬롯 결과 역시 서버 응답의 전체 장착표를 적용한다. */
  async unequipRune(relicId: string, slotIndex: number, api: GameApi = gameApi): Promise<void> {
    const response = await api.unequipRune({ relicId, slotIndex });
    this.applyRuneInventory(response.inventory);
  }

  /** 인벤토리 DTO를 기존 공유 객체에 복사해 씬 참조를 보존하고 응답 단위로 저장한다. */
  private applyRuneInventory(inventory: RuneInventoryDto): void {
    this.state.runeInventory = inventory.runes.map((rune) => ({
      ...rune,
      mainStats: [{ ...rune.mainStats[0] }, { ...rune.mainStats[1] }],
      subStats: rune.subStats.map((stat) => ({ ...stat })),
      enhancementHistory: Object.fromEntries(Object.entries(rune.enhancementHistory).map(([key, history]) => [key, history?.map((record) => ({ ...record }))])),
      engravings: rune.engravings.map((engraving) => ({ ...engraving })),
    }));
    for (const equipment of inventory.equipment) {
      const progress = this.ownedProgress(equipment.relicId);
      progress.heartGemSlots = [...equipment.slots];
    }
    this.persistSharedSession();
  }

  /** UI와 전투가 공유할 최종 능력치를 순수 코어 계산기로 구한다. */
  getFinalStats(relicId: string): Stats {
    const progress = this.getProgress(relicId);
    // 인스턴스 전체를 넘겨 성공 이력과 각인을 코어의 단일 계산기가 해석하게 한다.
    const gems = progress.heartGemSlots.flatMap((id) => {
      const rune = id === null ? undefined : this.state.runeInventory.find((candidate) => candidate.instanceId === id);
      if (!rune) return [];
      return [rune];
    });
    return calculateFinalStats(getRelic(relicId).stats, progress, gems);
  }

  /** 성장 트랜잭션이 끝난 뒤에만 저장해 중간 상태가 남지 않게 한다. */
  private persistSharedSession(): void {
    if (this.state === session) saveManager.save(this.state);
  }
}

/** 앱에서 공유하는 기본 성장 매니저다. */
export const relicProgression = new RelicProgressionManager();
