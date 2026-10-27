import { nextAutoRepeatStep, pickAutoDrink, type AutoRepeatDecision, type AutoRepeatDrink, type AutoRepeatOptions, type AutoRepeatStopReason } from "../core/autoRepeat";
import { nextExpiringLot } from "../core/itemLots";
import { findItem } from "../data/items";
import { session } from "../state/session";

/** 자동으로 딸 수 있는 병. 순서는 상관없다 — 고르는 일은 `pickAutoDrink`가 한다. */
const AUTO_DRINK_ITEMS = ["stamina-tonic", "stamina-tonic-large"] as const;

/** 진행 중인 자동 전투 한 벌. 판 사이에도 씬이 바뀌므로 씬 밖(메모리)에 둔다 — 새로고침하면 끝난다. */
export interface AutoRepeatRun {
  content: { content: "cake" | "bounty"; tierId: string };
  options: AutoRepeatOptions;
  /** 끝난 판 수(이긴 판 + 진 판). */
  completed: number;
  wins: number;
  drinksUsed: number;
  /** 사람이 중지를 눌렀다 — 지금 판이 끝나면 더 가지 않는다. */
  cancelled: boolean;
  /** 멈춘 이유. 멈춘 뒤 결과판이 한 번 말하고 비운다. */
  stopped?: AutoRepeatStopReason;
}

/**
 * 자동 전투의 상태를 붙드는 단 하나의 자리. 편성 화면이 시작하고, 전투 결과가 판을 세고, 결과판의
 * 카운트다운이 다음 판으로 넘긴다. 다음 걸음의 판단은 `nextAutoRepeatStep`이 한다.
 */
class AutoRepeatManager {
  private run: AutoRepeatRun | undefined;

  start(content: AutoRepeatRun["content"], options: AutoRepeatOptions): void {
    this.run = { content: { ...content }, options: { ...options }, completed: 0, wins: 0, drinksUsed: 0, cancelled: false };
  }

  /** 지금 이 콘텐츠·단계를 돌고 있는가. 다른 판에 들어가면 자동 전투는 남아 있어도 이 판의 것이 아니다. */
  activeFor(content: { content: string; tierId?: string }): AutoRepeatRun | undefined {
    const run = this.run;
    if (!run || run.stopped) return undefined;
    return run.content.content === content.content && run.content.tierId === content.tierId ? run : undefined;
  }

  get current(): AutoRepeatRun | undefined { return this.run && !this.run.stopped ? this.run : undefined; }

  /** 중지 — 지금 판은 끝까지 치르고, 결과판에서 더 넘기지 않는다. */
  cancel(): void { if (this.run) this.run.cancelled = true; }

  /** 중지 예약을 거둔다 — 아직 멈추지 않은 판에서만 뜻이 있다. */
  resume(): void { if (this.run && !this.run.stopped) this.run.cancelled = false; }

  /** 끝내고 비운다. */
  clear(): void { this.run = undefined; }

  /** 가방에서 자동으로 딸 수 있는 병 목록. */
  drinks(): AutoRepeatDrink[] {
    return AUTO_DRINK_ITEMS.flatMap((itemId): AutoRepeatDrink[] => {
      const stack = session.itemInventory.find((entry) => entry.itemId === itemId);
      const effect = findItem(itemId)?.useEffect;
      if (!stack || stack.quantity <= 0 || effect?.kind !== "restore_stamina") return [];
      const lot = nextExpiringLot(stack);
      const soonest = lot ? Date.parse(lot.expiresAt) : NaN;
      return [{ itemId, quantity: stack.quantity, amount: effect.amount, ...(Number.isFinite(soonest) ? { expiresAt: soonest } : {}) }];
    });
  }

  /**
   * 한 판을 세고 다음 걸음을 정한다. 멈추는 답이면 그 이유를 남긴다(결과판이 말한다).
   */
  record(won: boolean, staminaCost: number): AutoRepeatDecision {
    const run = this.run;
    if (!run || run.stopped) return { kind: "stop", reason: "cancelled" };
    run.completed += 1;
    if (won) run.wins += 1;
    return this.decide(won, staminaCost);
  }

  /** 병을 딴 뒤처럼 판을 세지 않고 다시 묻는다. */
  decide(won: boolean, staminaCost: number): AutoRepeatDecision {
    const run = this.run;
    if (!run || run.stopped) return { kind: "stop", reason: "cancelled" };
    const decision: AutoRepeatDecision = run.cancelled ? { kind: "stop", reason: "cancelled" }
      : nextAutoRepeatStep({ options: run.options, completed: run.completed, won, stamina: session.wallet.stamina, staminaCost, drinks: this.drinks() });
    if (decision.kind === "stop") run.stopped = decision.reason;
    return decision;
  }

  /** 병을 하나 땄다. */
  noteDrink(): void { if (this.run) this.run.drinksUsed += 1; }

  /** 병 따기가 실패하면 스테미나 부족으로 멈춘다. */
  stop(reason: AutoRepeatStopReason): void { if (this.run) this.run.stopped = reason; }

  /** 멈춘 판의 요약을 꺼내고 비운다. */
  takeStopped(): AutoRepeatRun | undefined {
    const run = this.run;
    if (!run?.stopped) return undefined;
    this.run = undefined;
    return run;
  }
}

export const autoRepeat = new AutoRepeatManager();

/** 화면이 병 고르기를 다시 짓지 않도록 다시 내보낸다. */
export { pickAutoDrink };
