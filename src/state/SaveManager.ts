import { HEART_GEMS } from "../data/heartGems";
import { PLAYABLE_RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import { BANNERS } from "../data/banners";
import { BREAKTHROUGH_CAP } from "../core/relicProgression";
import type { RelicProgress } from "../core/types";
import { createDefaultSession, type SaveData, type Session } from "./session";

/** 키는 계정 연동 저장소와 충돌하지 않도록 로컬 프로토타입임을 명시한다. */
export const SAVE_STORAGE_KEY = "eternal-city.local-save";
export const CURRENT_SAVE_VERSION = 10;

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
      completedStoryIds: [...state.completedStoryIds],
      selectedStageId: state.selectedStageId,
      party: [...state.party],
      clearedStageIds: [...state.cleared],
      ownedRelicIds: [...state.owned],
      favorite: state.favorite,
      bookmarkedRelicIds: [...state.bookmarked],
      wallet: { ...state.wallet },
      gachaPityByGroup: Object.fromEntries(Object.entries(state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity }])),
      relicProgress: Object.fromEntries(Object.entries(state.relicProgress).map(([id, value]) => [id, cloneProgress(value)])),
      ownedHeartGemIds: [...state.ownedHeartGemIds],
      dailyContent: { ...state.dailyContent, completedIds: [...state.dailyContent.completedIds], claimedRewardIds: [...state.dailyContent.claimedRewardIds] },
      // 임무 진행 객체와 수령 배열도 호출자가 저장 후 바꾸지 못하도록 복사한다.
      missions: { ...state.missions, progress: { ...state.missions.progress }, claimedIds: [...state.missions.claimedIds] },
      // 구매 제한도 지급과 같은 저장 단위에 포함해 재실행으로 제한이 풀리지 않게 한다.
      productPurchases: Object.fromEntries(Object.entries(state.productPurchases).map(([id, value]) => [id, { ...value }])),
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
    // 현재 이월 그룹만 정규화하며 삭제된 그룹 키는 버리고 새 그룹은 기본 상태로 만든다.
    const savedGroups = legacy.gachaPityByGroup && typeof legacy.gachaPityByGroup === "object"
      ? legacy.gachaPityByGroup as Record<string, { pullsSinceSsr?: unknown; pickupGuaranteed?: unknown }> : {};
    const legacyBannerPity = legacy.pullCountSinceHighestRarity && typeof legacy.pullCountSinceHighestRarity === "object"
      ? legacy.pullCountSinceHighestRarity as Record<string, unknown> : {};
    // v7까지의 배너별 카운터는 현재 배너가 속한 그룹으로 옮긴다. 같은 그룹이면 가장 큰 진행을 보존한다.
    const groupIds = [...new Set(BANNERS.map(({ pityGroupId }) => pityGroupId))];
    const normalizedPity = Object.fromEntries(groupIds.map((groupId) => {
      const saved = savedGroups[groupId];
      const legacyCount = Math.max(0, ...BANNERS.filter((banner) => banner.pityGroupId === groupId).map((banner) => Number(legacyBannerPity[banner.id]) || 0));
      return [groupId, { pullsSinceSsr: saved?.pullsSinceSsr ?? legacyCount, pickupGuaranteed: saved?.pickupGuaranteed ?? false }];
    }));
    // DNA 조각 도입 전 저장도 별도 초기화 없이 0개로 복구한다.
    const savedWallet = legacy.wallet as Partial<SaveData["wallet"]> | undefined;
    // v10에서 보석·골드·스테미나가 생겼다. 예전 저장은 0에서 시작한다.
    const wallet = { ...(legacy.wallet as object), dnaFragments: savedWallet?.dnaFragments ?? 0, weeds: savedWallet?.weeds ?? 0, gems: savedWallet?.gems ?? 0, gold: savedWallet?.gold ?? 0, stamina: savedWallet?.stamina ?? 0 };
    // 일일 입장 횟수 도입 전 저장은 같은 UTC 키에서 0회로 시작하되 이후 재실행에는 저장값을 유지한다.
    const savedDaily = legacy.dailyContent as Partial<SaveData["dailyContent"]> | undefined;
    const dailyContent = { date: savedDaily?.date ?? "", restorationEntries: savedDaily?.restorationEntries ?? 0, completedIds: savedDaily?.completedIds ?? [], claimedRewardIds: savedDaily?.claimedRewardIds ?? [] };
    // 임무 도입 전 저장은 기간 키가 비어 있어 다음 서버 접근에서 현재 UTC 기간으로 정규화된다.
    const savedMissions = legacy.missions as Partial<SaveData["missions"]> | undefined;
    const missions = { dailyKey: savedMissions?.dailyKey ?? "", weeklyKey: savedMissions?.weeklyKey ?? "", progress: savedMissions?.progress ?? {}, claimedIds: savedMissions?.claimedIds ?? [] };
    // 상품 도입 전 저장에는 구매 이력이 없으므로 빈 기록으로 안전하게 시작한다.
    const productPurchases = legacy.productPurchases && typeof legacy.productPurchases === "object" ? legacy.productPurchases : {};
    // 스토리 저장 도입 전 계정은 미완료로 두어 다음 타이틀 진입에서 오프닝을 한 번 재생한다.
    const completedStoryIds = Array.isArray(legacy.completedStoryIds) ? legacy.completedStoryIds : [];
    // 즐겨찾기 도입 전 저장은 빈 목록으로 시작한다. 애착 렐릭과는 다른 값이라 옮겨 담지 않는다.
    const bookmarkedRelicIds = Array.isArray(legacy.bookmarkedRelicIds) ? legacy.bookmarkedRelicIds : [];
    // v1까지는 유대가 없었다. 정적 Stats.ferocity→energyGain 변경은 저장 대상이 아니므로,
    // 저장에서는 플레이어별 신규 유대 필드만 보강하고 옛 정의 캐시는 의도적으로 전파하지 않는다.
    const savedProgress = legacy.relicProgress && typeof legacy.relicProgress === "object"
      ? legacy.relicProgress as Record<string, RelicProgress> : {};
    const relicProgress = Object.fromEntries(Object.entries(savedProgress).map(([id, progress]) => [id, {
      ...progress,
      // 구버전 저장은 관계 진행과 일일 날짜를 모두 안전한 미진행 상태로 복구한다.
      bondLevel: progress.bondLevel ?? 0,
      bondXp: progress.bondXp ?? 0,
      lastLobbyInteractionDate: progress.lastLobbyInteractionDate ?? "",
      // DNA 숙련도는 이름만 각성으로 바뀌었다. 같은 렐릭을 다시 만난 횟수라는 뜻이 그대로다.
      awakening: progress.awakening ?? (progress as unknown as { dnaMastery?: number }).dnaMastery ?? 0,
      // 급여로 쌓는 경험치는 v5까지 없었다. 지금 레벨의 시작점에서 다시 시작한다.
      exp: progress.exp ?? 0,
      // 돌파는 v7에서 생겼다. 예전 저장은 아직 천장을 뚫지 않은 상태로 본다.
      breakthrough: progress.breakthrough ?? 0,
    }]));
    if (legacy.saveVersion === undefined) {
      return { ...legacy, wallet, relicProgress, completedStoryIds, bookmarkedRelicIds, saveVersion: CURRENT_SAVE_VERSION, gachaPityByGroup: normalizedPity, dailyContent, missions, productPurchases } as unknown as SaveData;
    }
    const supported = [1, 2, 3, 4, 5, 6, 7, 8, 9, CURRENT_SAVE_VERSION];
    if (!supported.includes(legacy.saveVersion as number)) throw new SaveDataError(`지원하지 않는 저장 버전입니다: ${String(legacy.saveVersion)}`);
    return { ...legacy, saveVersion: CURRENT_SAVE_VERSION, wallet, relicProgress, completedStoryIds, bookmarkedRelicIds, dailyContent, missions, productPurchases, gachaPityByGroup: normalizedPity } as unknown as SaveData;
  }

  /** 콘텐츠 ID와 교차 필드 불변식까지 검사해 부분 손상을 조용히 전파하지 않는다. */
  validate(data: SaveData): void {
    const relicIds = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    const stageIds = new Set(STAGES.map(({ id }) => id));
    const gemIds = new Set(HEART_GEMS.map(({ id }) => id));
    const fail = (message: string): never => { throw new SaveDataError(message); };
    if (data.saveVersion !== CURRENT_SAVE_VERSION || !Array.isArray(data.ownedRelicIds) || data.ownedRelicIds.some((id) => !relicIds.has(id))) fail("존재하지 않는 렐릭 ID가 있습니다.");
    if (!Array.isArray(data.completedStoryIds) || data.completedStoryIds.some((id) => typeof id !== "string") || new Set(data.completedStoryIds).size !== data.completedStoryIds.length) fail("완료 스토리 정보가 올바르지 않습니다.");
    if (!Array.isArray(data.party) || data.party.length !== 3 || new Set(data.party).size !== 3 || data.party.some((id) => !data.ownedRelicIds.includes(id))) fail("파티는 서로 다른 보유 렐릭 3명이어야 합니다.");
    if (!relicIds.has(data.favorite) || !data.ownedRelicIds.includes(data.favorite)) fail("애착 렐릭이 올바르지 않습니다.");
    // 즐겨찾기는 여러 명이 될 수 있지만 보유하지 않은 렐릭이 섞이면 목록이 깨진다.
    if (!Array.isArray(data.bookmarkedRelicIds) || data.bookmarkedRelicIds.some((id) => !data.ownedRelicIds.includes(id)) || new Set(data.bookmarkedRelicIds).size !== data.bookmarkedRelicIds.length) fail("즐겨찾기 정보가 올바르지 않습니다.");
    if (data.selectedStageId !== null && !stageIds.has(data.selectedStageId)) fail("스테이지 ID가 올바르지 않습니다.");
    if (!Array.isArray(data.clearedStageIds) || data.clearedStageIds.some((id) => !stageIds.has(id))) fail("클리어 진행이 올바르지 않습니다.");
    if (!data.wallet || !Number.isFinite(data.wallet.fossil) || data.wallet.fossil < 0 || !Number.isFinite(data.wallet.amber) || data.wallet.amber < 0 || !Number.isInteger(data.wallet.dnaFragments) || data.wallet.dnaFragments < 0 || !Number.isInteger(data.wallet.weeds) || data.wallet.weeds < 0) fail("재화가 올바르지 않습니다.");
    if (!data.gachaPityByGroup || [...new Set(BANNERS.map(({ pityGroupId }) => pityGroupId))].some((id) => !Number.isInteger(data.gachaPityByGroup[id]?.pullsSinceSsr) || data.gachaPityByGroup[id].pullsSinceSsr < 0 || typeof data.gachaPityByGroup[id].pickupGuaranteed !== "boolean")) fail("배너 그룹 천장 정보가 올바르지 않습니다.");
    if (!data.relicProgress || typeof data.relicProgress !== "object") fail("성장 정보가 없습니다.");
    // 보유 목록과 성장 레코드는 항상 정확히 같은 렐릭 집합이어야 한다.
    if (data.ownedRelicIds.some((id) => !data.relicProgress[id]) || Object.keys(data.relicProgress).some((id) => !data.ownedRelicIds.includes(id))) fail("보유 렐릭과 성장 정보가 일치하지 않습니다.");
    for (const [id, progress] of Object.entries(data.relicProgress)) {
      if (!relicIds.has(id) || !Number.isInteger(progress.awakening) || progress.awakening < 0 || progress.awakening > 5 || !Number.isInteger(progress.breakthrough) || progress.breakthrough < 0 || progress.breakthrough > BREAKTHROUGH_CAP || !Number.isInteger(progress.exp) || progress.exp < 0 || !Number.isInteger(progress.bondLevel) || progress.bondLevel < 0 || progress.bondLevel > 10 || !Number.isInteger(progress.bondXp) || progress.bondXp < 0 || progress.bondXp > 650 || typeof progress.lastLobbyInteractionDate !== "string" || !Number.isInteger(progress.level) || progress.level < 1 || !Array.isArray(progress.heartGemSlots) || progress.heartGemSlots.length !== 3) fail("렐릭 성장 정보가 올바르지 않습니다.");
      if (progress.heartGemSlots.some((id) => id !== null && !gemIds.has(id))) fail("Heart Gem 장착 정보가 올바르지 않습니다.");
    }
    if (!Array.isArray(data.ownedHeartGemIds) || data.ownedHeartGemIds.some((id) => !gemIds.has(id))) fail("Heart Gem 보유 정보가 올바르지 않습니다.");
    if (!data.dailyContent || typeof data.dailyContent.date !== "string" || !Number.isInteger(data.dailyContent.restorationEntries) || data.dailyContent.restorationEntries < 0 || data.dailyContent.restorationEntries > 3 || !Array.isArray(data.dailyContent.completedIds) || !Array.isArray(data.dailyContent.claimedRewardIds)) fail("일일 콘텐츠 정보가 올바르지 않습니다.");
    if (!data.missions || typeof data.missions.dailyKey !== "string" || typeof data.missions.weeklyKey !== "string" || !data.missions.progress || typeof data.missions.progress !== "object" || Object.values(data.missions.progress).some((value) => !Number.isInteger(value) || value < 0) || !Array.isArray(data.missions.claimedIds) || new Set(data.missions.claimedIds).size !== data.missions.claimedIds.length) fail("임무 진행 정보가 올바르지 않습니다.");
    if (!data.productPurchases || typeof data.productPurchases !== "object" || Object.values(data.productPurchases).some((value) => typeof value.periodKey !== "string" || !Number.isInteger(value.count) || value.count < 0)) fail("상품 구매 제한 정보가 올바르지 않습니다.");
  }

  private toSession(data: SaveData): Session {
    return {
      completedStoryIds: new Set(data.completedStoryIds),
      selectedStageId: data.selectedStageId, party: [...data.party], cleared: new Set(data.clearedStageIds), owned: new Set(data.ownedRelicIds), favorite: data.favorite, bookmarked: new Set(data.bookmarkedRelicIds),
      wallet: { ...data.wallet }, relicProgress: Object.fromEntries(Object.entries(data.relicProgress).map(([id, value]) => [id, cloneProgress(value)])), ownedHeartGemIds: [...data.ownedHeartGemIds],
      gachaPityByGroup: Object.fromEntries(Object.entries(data.gachaPityByGroup).map(([id, pity]) => [id, { ...pity }])),
      dailyContent: { ...data.dailyContent, completedIds: [...data.dailyContent.completedIds], claimedRewardIds: [...data.dailyContent.claimedRewardIds] },
      missions: { ...data.missions, progress: { ...data.missions.progress }, claimedIds: [...data.missions.claimedIds] },
      productPurchases: Object.fromEntries(Object.entries(data.productPurchases).map(([id, value]) => [id, { ...value }])),
    };
  }
}

/** 브라우저 앱이 공유하는 유일한 로컬 저장 진입점이다. */
export const saveManager = new SaveManager();

/** 부트 복구 실패 시 호출자가 명시적으로 기본 상태를 선택할 수 있게 한다. */
export function defaultSessionAfterReset(): Session {
  return createDefaultSession();
}
