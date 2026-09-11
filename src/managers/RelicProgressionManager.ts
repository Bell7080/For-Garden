import { calculateFinalStats, relicStars, remainingBreakthroughCost } from "../core/relicProgression";
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

  /** 지금 별(1~5). 화면은 돌파 단계가 아니라 이 값을 읽는다. */
  getStars(relicId: string): number {
    return relicStars(this.getProgress(relicId).breakthrough);
  }

  /** 그 개체의 파편 보유량. 없으면 0이다 — 없는 개체를 위해 표를 만들지 않는다. */
  getFragments(relicId: string): number {
    return this.state.relicFragments[relicId] ?? 0;
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
    const def = getRelic(relicId);
    return calculateFinalStats(def.stats, progress, gems, def.rarity);
  }

  /**
   * 그 개체를 별 다섯까지 키우는 데 필요한 재료를 한 번에 지급한다 — **테스트 전용 진입점**이다.
   *
   * 돌파는 레벨 상한 → 파편 → 치즈케이크 셋이 동시에 맞아야 되는 조작이라, 지급 없이 확인하려면
   * 연구소에서 같은 개체를 여러 번 뽑고 수십 번 급여해야 한다. 여기서는 **재료만** 주고 돌파
   * 자체는 사람이 누른다 — 자동으로 뚫어 버리면 확인하려는 그 화면을 지나쳐 버린다.
   *
   * 수치는 화면이 아니라 순수 규칙(`remainingBreakthroughCost`)에서 나오므로, 단계표나 등급별
   * 파편 수를 고치면 지급량도 함께 따라간다. 정식 획득 경로가 충분해지면 이 메서드를 지운다.
   */
  grantBreakthroughSetForDebug(relicId: string): { fragments: number; cheesecake: number } {
    const def = getRelic(relicId);
    const progress = this.ownedProgress(relicId);
    const cost = remainingBreakthroughCost(def.rarity, progress);
    this.state.relicFragments[relicId] = (this.state.relicFragments[relicId] ?? 0) + cost.fragments;
    this.state.wallet.cheesecake += cost.cheesecake;
    this.persistSharedSession();
    return cost;
  }

  /** 성장 트랜잭션이 끝난 뒤에만 저장해 중간 상태가 남지 않게 한다. */
  private persistSharedSession(): void {
    if (this.state === session) saveManager.save(this.state);
  }
}

/** 앱에서 공유하는 기본 성장 매니저다. */
export const relicProgression = new RelicProgressionManager();
