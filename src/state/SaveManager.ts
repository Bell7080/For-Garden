import { HEART_GEMS } from "../data/heartGems";
import { PLAYABLE_RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import type { RelicProgress } from "../core/types";
import { createDefaultSession, type SaveData, type Session } from "./session";

/** 키는 계정 연동 저장소와 충돌하지 않도록 로컬 프로토타입임을 명시한다. */
export const SAVE_STORAGE_KEY = "eternal-city.local-save";
export const CURRENT_SAVE_VERSION = 1;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 손상 데이터와 지원하지 않는 미래 버전을 부트 복구 경로로 보내는 오류다. */
export class SaveDataError extends Error {}

function cloneProgress(progress: RelicProgress): RelicProgress {
  return { ...progress, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] };
}

/** 저장/로드/마이그레이션을 독점해 씬과 localStorage의 의존을 끊는다. */
export class SaveManager {
  constructor(private readonly storage: StorageLike | undefined = globalThis.localStorage) {}

  /** JSON 배열을 런타임 Set으로 되돌린 검증 완료 세션을 반환한다. */
  load(): Session | null {
    const raw = this.storage?.getItem(SAVE_STORAGE_KEY);
    if (raw === null || raw === undefined) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SaveDataError("저장 JSON이 손상되었습니다.");
    }
    const data = this.migrate(parsed);
    this.validate(data);
    return this.toSession(data);
  }

  /** 상태 확정 경계에서 Set을 배열로 바꾸고 한 번에 교체 저장한다. */
  save(state: Session): void {
    const data: SaveData = {
      saveVersion: CURRENT_SAVE_VERSION,
      selectedStageId: state.selectedStageId,
      party: [...state.party],
      clearedStageIds: [...state.cleared],
      ownedRelicIds: [...state.owned],
      favorite: state.favorite,
      wallet: { ...state.wallet },
      relicProgress: Object.fromEntries(Object.entries(state.relicProgress).map(([id, value]) => [id, cloneProgress(value)])),
      ownedHeartGemIds: [...state.ownedHeartGemIds],
      dailyContent: { ...state.dailyContent, completedIds: [...state.dailyContent.completedIds], claimedRewardIds: [...state.dailyContent.claimedRewardIds] },
    };
    this.validate(data);
    this.storage?.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  }

  /** 로그아웃/계정 전환에서 사용할 저장 제거다. 새게임 UI를 만들지는 않는다. */
  reset(): void {
    this.storage?.removeItem(SAVE_STORAGE_KEY);
  }

  /** 버전 없는 초기 프로토타입 저장을 명시적으로 v1 계약에 올린다. */
  migrate(input: unknown): SaveData {
    if (!input || typeof input !== "object") throw new SaveDataError("저장 데이터가 객체가 아닙니다.");
    const legacy = input as Record<string, unknown>;
    if (legacy.saveVersion === undefined) {
      return { ...legacy, saveVersion: CURRENT_SAVE_VERSION, dailyContent: legacy.dailyContent ?? { date: "", completedIds: [], claimedRewardIds: [] } } as unknown as SaveData;
    }
    if (legacy.saveVersion !== CURRENT_SAVE_VERSION) throw new SaveDataError(`지원하지 않는 저장 버전입니다: ${String(legacy.saveVersion)}`);
    return legacy as unknown as SaveData;
  }

  /** 콘텐츠 ID와 교차 필드 불변식까지 검사해 부분 손상을 조용히 전파하지 않는다. */
  validate(data: SaveData): void {
    const relicIds = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    const stageIds = new Set(STAGES.map(({ id }) => id));
    const gemIds = new Set(HEART_GEMS.map(({ id }) => id));
    const fail = (message: string): never => { throw new SaveDataError(message); };
    if (data.saveVersion !== CURRENT_SAVE_VERSION || !Array.isArray(data.ownedRelicIds) || data.ownedRelicIds.some((id) => !relicIds.has(id))) fail("존재하지 않는 렐릭 ID가 있습니다.");
    if (!Array.isArray(data.party) || data.party.length !== 3 || new Set(data.party).size !== 3 || data.party.some((id) => !data.ownedRelicIds.includes(id))) fail("파티는 서로 다른 보유 렐릭 3명이어야 합니다.");
    if (!relicIds.has(data.favorite) || !data.ownedRelicIds.includes(data.favorite)) fail("애착 렐릭이 올바르지 않습니다.");
    if (data.selectedStageId !== null && !stageIds.has(data.selectedStageId)) fail("스테이지 ID가 올바르지 않습니다.");
    if (!Array.isArray(data.clearedStageIds) || data.clearedStageIds.some((id) => !stageIds.has(id))) fail("클리어 진행이 올바르지 않습니다.");
    if (!data.wallet || !Number.isFinite(data.wallet.fossil) || data.wallet.fossil < 0 || !Number.isFinite(data.wallet.amber) || data.wallet.amber < 0) fail("재화가 올바르지 않습니다.");
    if (!data.relicProgress || typeof data.relicProgress !== "object") fail("성장 정보가 없습니다.");
    for (const [id, progress] of Object.entries(data.relicProgress)) {
      if (!relicIds.has(id) || !Number.isInteger(progress.dnaMastery) || progress.dnaMastery < 0 || progress.dnaMastery > 5 || !Number.isInteger(progress.level) || progress.level < 1 || !Array.isArray(progress.heartGemSlots) || progress.heartGemSlots.length !== 3) fail("렐릭 성장 정보가 올바르지 않습니다.");
      if (progress.heartGemSlots.some((id) => id !== null && !gemIds.has(id))) fail("Heart Gem 장착 정보가 올바르지 않습니다.");
    }
    if (!Array.isArray(data.ownedHeartGemIds) || data.ownedHeartGemIds.some((id) => !gemIds.has(id))) fail("Heart Gem 보유 정보가 올바르지 않습니다.");
    if (!data.dailyContent || typeof data.dailyContent.date !== "string" || !Array.isArray(data.dailyContent.completedIds) || !Array.isArray(data.dailyContent.claimedRewardIds)) fail("일일 콘텐츠 정보가 올바르지 않습니다.");
  }

  private toSession(data: SaveData): Session {
    return {
      selectedStageId: data.selectedStageId, party: [...data.party], cleared: new Set(data.clearedStageIds), owned: new Set(data.ownedRelicIds), favorite: data.favorite,
      wallet: { ...data.wallet }, relicProgress: Object.fromEntries(Object.entries(data.relicProgress).map(([id, value]) => [id, cloneProgress(value)])), ownedHeartGemIds: [...data.ownedHeartGemIds],
      dailyContent: { ...data.dailyContent, completedIds: [...data.dailyContent.completedIds], claimedRewardIds: [...data.dailyContent.claimedRewardIds] },
    };
  }
}

/** 브라우저 앱이 공유하는 유일한 로컬 저장 진입점이다. */
export const saveManager = new SaveManager();

/** 부트 복구 실패 시 호출자가 명시적으로 기본 상태를 선택할 수 있게 한다. */
export function defaultSessionAfterReset(): Session {
  return createDefaultSession();
}
