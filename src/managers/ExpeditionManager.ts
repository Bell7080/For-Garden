import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type ActiveExpedition, type Session } from "../state/session";

/** 로비와 원정 화면이 공유하는 읽기 전용 요약이다. UI는 저장 모델을 직접 해석하지 않는다. */
export interface ExpeditionStatus {
  weekKey: string;
  playsThisWeek: number;
  bestScore: number;
  active: ActiveExpedition | null;
  quickAvailable: boolean;
}

/** 신규 원정 편성 검증이 실패한 이유다. 씬은 이 값만 플레이어 문구로 번역한다. */
export type StartExpeditionFailure = "exactlyThree" | "duplicate" | "notOwned" | "alreadyActive";

/** 시작 상태 전이 결과다. 성공한 경우 저장까지 확정된 진행 스냅샷을 돌려준다. */
export type StartExpeditionResult = { ok: true; active: ActiveExpedition } | { ok: false; reason: StartExpeditionFailure };

/** UTC 월요일을 기준으로 주간 기록을 묶는 안정적인 키를 만든다. */
export function expeditionWeekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

/**
 * 원정 편성·주간 기록의 단일 쓰기 경계다.
 *
 * 씬은 선택 표시만 소유한다. 보유 여부 검증, 진행 중 상태 전이, 저장은 이 매니저가 한 번에 맡는다.
 * 실제 전투 점수와 보상 확정은 향후 서버 API가 소유하며 이 준비 매니저에서 임의 지급하지 않는다.
 */
export class ExpeditionManager {
  constructor(
    private readonly state: Session = session,
    private readonly saves: Pick<SaveManager, "save"> = saveManager,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** 주차 변경을 정규화한 현재 상태의 독립 사본을 반환한다. */
  status(): ExpeditionStatus {
    this.normalizeWeek();
    const active = this.state.expedition.active;
    return {
      ...this.state.expedition,
      active: active ? { ...active, relicIds: [...active.relicIds] as [string, string, string] } : null,
      // 빠른 원정은 이번 주 정상 원정 점수가 있고 이어 할 진행이 없을 때만 열린다.
      quickAvailable: this.state.expedition.bestScore > 0 && active === null,
    };
  }

  /** 정확히 세 보유 렐릭을 검증한 뒤 신규→진행 중 상태 전이를 저장한다. */
  start(relicIds: readonly string[]): StartExpeditionResult {
    this.normalizeWeek();
    if (this.state.expedition.active) return { ok: false, reason: "alreadyActive" };
    if (relicIds.length !== 3) return { ok: false, reason: "exactlyThree" };
    if (new Set(relicIds).size !== 3) return { ok: false, reason: "duplicate" };
    if (relicIds.some((id) => !this.state.owned.has(id))) return { ok: false, reason: "notOwned" };

    const active: ActiveExpedition = {
      relicIds: [...relicIds] as [string, string, string],
      startedAt: this.now().toISOString(),
      score: 0,
    };
    // 상태 전이의 소유자는 이 지점이다. 검증을 모두 통과한 뒤 공유 Session과 저장을 함께 확정한다.
    this.state.expedition = { ...this.state.expedition, active };
    this.saves.save(this.state);
    return { ok: true, active: { ...active, relicIds: [...active.relicIds] as [string, string, string] } };
  }

  /** 주차가 바뀌면 주간 횟수·최고점만 초기화하고 진행 중 원정은 이어가게 보존한다. */
  private normalizeWeek(): void {
    const weekKey = expeditionWeekKey(this.now());
    if (this.state.expedition.weekKey === weekKey) return;
    // 주간 경계 전이는 매니저만 수행한다. 진행 중 스냅샷을 지우면 로비의 이어하기 계약이 깨진다.
    this.state.expedition = { ...this.state.expedition, weekKey, playsThisWeek: 0, bestScore: 0 };
    this.saves.save(this.state);
  }
}

/** 앱 전체가 공유하는 원정 준비 경계다. 테스트는 독립 Session과 시계를 주입한다. */
export const expeditionManager = new ExpeditionManager();
