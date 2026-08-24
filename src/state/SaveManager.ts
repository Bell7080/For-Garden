import { PLAYABLE_RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import { BANNERS } from "../data/banners";
import { BREAKTHROUGH_CAP } from "../core/relicProgression";
import type { RelicProgress } from "../core/types";
import { createDefaultSession, type SaveData, type Session } from "./session";
import { assertValidRuneInstance, type RuneInstance } from "../core/runes";
import { normalizeSettings } from "../core/settings";
import { AD_REWARD_SLOTS } from "../data/adRewards";
import { createIdleExcavationState } from "../core/idleExcavation";

/** v12에서만 존재했던 정적 젬을 저장 마이그레이션용 인스턴스로 재현하는 폐쇄된 표다. */
const LEGACY_V12_RUNES: Readonly<Record<string, RuneInstance>> = {
  "vital-seed": { instanceId: "legacy-v12-vital-seed", baseName: "생명의 Heart Gem", customName: null, rarity: "uncommon", part: 0, mainStats: [{ key: "hp", value: 10 }, { key: "def", value: 0 }], subStats: [], enhancementHistory: {}, currentSuccessChance: 0.75, enhancementComplete: false, engravings: [] },
  "fang-core": { instanceId: "legacy-v12-fang-core", baseName: "송곳니 Heart Gem", customName: null, rarity: "rare", part: 1, mainStats: [{ key: "atk", value: 12 }, { key: "hp", value: 0 }], subStats: [{ key: "critChance", value: 5 }], enhancementHistory: {}, currentSuccessChance: 0.75, enhancementComplete: false, engravings: [] },
  "ancient-pulse": { instanceId: "legacy-v12-ancient-pulse", baseName: "고대의 Heart Gem", customName: null, rarity: "epic", part: 2, mainStats: [{ key: "hp", value: 8 }, { key: "def", value: 8 }], subStats: [{ key: "ferocityGain", value: 0 }, { key: "energyGain", value: 0 }], enhancementHistory: {}, currentSuccessChance: 0.75, enhancementComplete: false, engravings: [] },
};

/** 레거시 표의 객체가 여러 저장 로드 사이에서 공유되지 않도록 매번 완전 복사한다. */
function migrateV12Rune(definitionId: string): RuneInstance {
  const rune = LEGACY_V12_RUNES[definitionId];
  if (!rune) throw new Error(`알 수 없는 v12 Heart Gem id: ${definitionId}`);
  return cloneRune(rune);
}

/** 키는 계정 연동 저장소와 충돌하지 않도록 로컬 프로토타입임을 명시한다. */
export const SAVE_STORAGE_KEY = "eternal-city.local-save";
export const CURRENT_SAVE_VERSION = 18;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 손상 데이터와 지원하지 않는 미래 버전을 부트 복구 경로로 보내는 오류다. */
export class SaveDataError extends Error {}

function cloneProgress(progress: RelicProgress): RelicProgress {
  return { ...progress, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] };
}

/** 룬의 중첩 옵션과 이력을 모두 복사해 저장/응답 호출자의 참조 변경을 막는다. */
function cloneRune(rune: RuneInstance): RuneInstance {
  return {
    ...rune,
    mainStats: [{ ...rune.mainStats[0] }, { ...rune.mainStats[1] }],
    subStats: rune.subStats.map((stat) => ({ ...stat })),
    enhancementHistory: Object.fromEntries(Object.entries(rune.enhancementHistory).map(([key, history]) => [key, history?.map((record) => ({ ...record }))])),
    engravings: rune.engravings.map((engraving) => ({ ...engraving })),
  };
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
      idleExcavation: { ...state.idleExcavation, assignedRelicIds: [...state.idleExcavation.assignedRelicIds], unclaimed: { ...state.idleExcavation.unclaimed } },
      saveVersion: CURRENT_SAVE_VERSION,
      settings: normalizeSettings(state.settings),
      completedStoryIds: [...state.completedStoryIds],
      observationRecords: state.observationRecords.map((record) => ({ ...record })),
      selectedStageId: state.selectedStageId,
      party: [...state.party],
      clearedStageIds: [...state.cleared],
      ownedRelicIds: [...state.owned],
      favorite: state.favorite,
      bookmarkedRelicIds: [...state.bookmarked],
      wallet: { ...state.wallet },
      gachaPityByGroup: Object.fromEntries(Object.entries(state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity }])),
      relicProgress: Object.fromEntries(Object.entries(state.relicProgress).map(([id, value]) => [id, cloneProgress(value)])),
      relicFragments: { ...state.relicFragments },
      runeInventory: state.runeInventory.map(cloneRune),
      dailyContent: { ...state.dailyContent, completedIds: [...state.dailyContent.completedIds], claimedRewardIds: [...state.dailyContent.claimedRewardIds] },
      // 임무 진행 객체와 수령 배열도 호출자가 저장 후 바꾸지 못하도록 복사한다.
      missions: { ...state.missions, progress: { ...state.missions.progress }, claimedIds: [...state.missions.claimedIds] },
      // 구매 제한도 지급과 같은 저장 단위에 포함해 재실행으로 제한이 풀리지 않게 한다.
      productPurchases: Object.fromEntries(Object.entries(state.productPurchases).map(([id, value]) => [id, { ...value }])),
      // 광고 검증 토큰은 제외하고 UTC 일자·횟수·멱등 ID만 독립 복사한다.
      dailyAdRewards: { ...state.dailyAdRewards, claimsBySlot: { ...state.dailyAdRewards.claimsBySlot }, requestIds: [...state.dailyAdRewards.requestIds] },
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
    // v18 이전에는 기준 시각이 없으므로 현재 시각을 꾸며 넣지 않고 서버 첫 조회 초기화 표식을 둔다.
    const idleExcavation = Number(legacy.saveVersion) >= 18 && legacy.idleExcavation ? legacy.idleExcavation : createIdleExcavationState();
    // v15 이전 진행은 그대로 펼쳐 보존하고 새 설정 필드만 기본값/정규화 값으로 보충한다.
    const settings = normalizeSettings(legacy.settings);
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
    const savedWallet = legacy.wallet as (Partial<SaveData["wallet"]> & { weeds?: unknown }) | undefined;
    // v10에서 보석·골드·스테미나가 생겼다. 예전 저장은 0에서 시작한다.
    // v12는 weeds를 cheesecake로 옮긴다. 두 키가 함께 있으면 이미 변환된 cheesecake를 우선해
    // 중복 합산을 막고, 구조 분해로 구 키가 현재 저장 모델에 남지 않게 한다.
    const { weeds: _legacyWeeds, ...walletWithoutLegacyCurrency } = savedWallet ?? {};
    const legacyCheesecake = typeof _legacyWeeds === "number" ? _legacyWeeds : 0;
    const wallet = { ...walletWithoutLegacyCurrency, dnaFragments: savedWallet?.dnaFragments ?? 0, cheesecake: savedWallet?.cheesecake ?? legacyCheesecake, gems: savedWallet?.gems ?? 0, gold: savedWallet?.gold ?? 0, stamina: savedWallet?.stamina ?? 0 };
    // 일일 입장 횟수 도입 전 저장은 같은 UTC 키에서 0회로 시작하되 이후 재실행에는 저장값을 유지한다.
    const savedDaily = legacy.dailyContent as Partial<SaveData["dailyContent"]> | undefined;
    const dailyContent = { date: savedDaily?.date ?? "", restorationEntries: savedDaily?.restorationEntries ?? 0, completedIds: savedDaily?.completedIds ?? [], claimedRewardIds: savedDaily?.claimedRewardIds ?? [] };
    // 임무 도입 전 저장은 기간 키가 비어 있어 다음 서버 접근에서 현재 UTC 기간으로 정규화된다.
    const savedMissions = legacy.missions as Partial<SaveData["missions"]> | undefined;
    const missions = { dailyKey: savedMissions?.dailyKey ?? "", weeklyKey: savedMissions?.weeklyKey ?? "", progress: savedMissions?.progress ?? {}, claimedIds: savedMissions?.claimedIds ?? [] };
    // 상품 도입 전 저장에는 구매 이력이 없으므로 빈 기록으로 안전하게 시작한다.
    const productPurchases = legacy.productPurchases && typeof legacy.productPurchases === "object" ? legacy.productPurchases : {};
    // v16 이전 저장은 광고를 한 번도 받지 않은 상태에서 안전하게 시작한다.
    const savedAds = legacy.dailyAdRewards as Partial<SaveData["dailyAdRewards"]> | undefined;
    const dailyAdRewards = { date: savedAds?.date ?? "", claimsBySlot: savedAds?.claimsBySlot ?? {}, requestIds: savedAds?.requestIds ?? [] };
    // v12는 정적 정의 ID를 소유권과 슬롯에 함께 썼다. 결정적 ID로 인스턴스를 만들고 모든 슬롯을 같은 표로 치환한다.
    const isV12OrOlder = legacy.saveVersion === undefined || Number(legacy.saveVersion) <= 12;
    const legacyOwned = Array.isArray(legacy.ownedHeartGemIds) ? legacy.ownedHeartGemIds.filter((id): id is string => typeof id === "string") : [];
    let runeInventory: RuneInstance[];
    try { runeInventory = isV12OrOlder ? legacyOwned.map(migrateV12Rune) : (Array.isArray(legacy.runeInventory) ? legacy.runeInventory as unknown as RuneInstance[] : []); }
    catch { throw new SaveDataError("v12 Heart Gem 보유 정보가 올바르지 않습니다."); }
    // v17부터 룬은 들어갈 칸(파츠)을 갖는다. 자리가 없던 시절의 룬은 순서대로 세 자리에
    // 나눠 준다 — 전부 1번 자리로 몰면 나머지 두 칸이 영영 비어 있게 된다.
    runeInventory = runeInventory.map((rune, index) => (
      [0, 1, 2].includes((rune as { part?: number }).part as number) ? rune : { ...rune, part: (index % 3) as RuneInstance["part"] }
    ));
    const legacyIdMap = new Map(legacyOwned.map((id) => [id, `legacy-v12-${id}`]));
    // 스토리 저장 도입 전 계정은 미완료로 두어 다음 타이틀 진입에서 오프닝을 한 번 재생한다.
    const completedStoryIds = Array.isArray(legacy.completedStoryIds) ? legacy.completedStoryIds : [];
    // 관찰 인터뷰 도입 전 저장에는 일지가 없으며, 완료 스토리에서 내용을 추측해 만들지 않는다.
    const observationRecords = Array.isArray(legacy.observationRecords) ? legacy.observationRecords : [];
    // 즐겨찾기 도입 전 저장은 빈 목록으로 시작한다. 애착 렐릭과는 다른 값이라 옮겨 담지 않는다.
    const bookmarkedRelicIds = Array.isArray(legacy.bookmarkedRelicIds) ? legacy.bookmarkedRelicIds : [];
    // v1까지는 유대가 없었다. 정적 Stats.ferocity→energyGain 변경은 저장 대상이 아니므로,
    // 저장에서는 플레이어별 신규 유대 필드만 보강하고 옛 정의 캐시는 의도적으로 전파하지 않는다.
    const savedProgress = legacy.relicProgress && typeof legacy.relicProgress === "object"
      ? legacy.relicProgress as Record<string, RelicProgress> : {};
    const v13Slots = legacy.runeSlotsByRelicId && typeof legacy.runeSlotsByRelicId === "object" ? legacy.runeSlotsByRelicId as Record<string, RelicProgress["heartGemSlots"]> : {};
    const relicProgress = Object.fromEntries(Object.entries(savedProgress).map(([id, progress]) => [id, {
      ...progress,
      // 구버전 저장은 관계 진행과 일일 날짜를 모두 안전한 미진행 상태로 복구한다.
      bondLevel: progress.bondLevel ?? 0,
      bondXp: progress.bondXp ?? 0,
      lastLobbyInteractionDate: progress.lastLobbyInteractionDate ?? "",
      // 급여로 쌓는 경험치는 v5까지 없었다. 지금 레벨의 시작점에서 다시 시작한다.
      exp: progress.exp ?? 0,
      // 돌파는 v7에서 생겼다. 예전 저장은 아직 천장을 뚫지 않은 상태로 본다(별 하나).
      breakthrough: Math.min(BREAKTHROUGH_CAP, progress.breakthrough ?? 0),
      // v12 슬롯의 정적 ID와 임시 v13 장착표를 최종 단일 기준인 RelicProgress 슬롯으로 합친다.
      heartGemSlots: (v13Slots[id] ?? progress.heartGemSlots ?? [null, null, null]).map((slot) => slot === null ? null : (legacyIdMap.get(slot) ?? slot)) as RelicProgress["heartGemSlots"],
    }]));
    // 중복 발굴은 v16까지 "각성" 수치로 곧바로 쌓였다. 지금은 파편을 모아 스스로 돌파하는
    // 방식이라, 예전에 쌓인 각성 횟수를 같은 수의 파편으로 돌려준다 — 이미 치른 중복이
    // 사라지지 않아야 한다.
    // v17부터만 파편 표를 저장한다. 그 이전 저장에 같은 이름의 필드가 남아 있어도 각성
    // 횟수에서 다시 만든다 — 옛 저장이 스스로 채웠을 리 없는 값이라 신뢰할 수 없다.
    const savedFragments = Number(legacy.saveVersion) >= 17 && legacy.relicFragments && typeof legacy.relicFragments === "object"
      ? legacy.relicFragments as Record<string, number> : undefined;
    const relicFragments = savedFragments ?? Object.fromEntries(Object.entries(savedProgress)
      .map(([id, progress]) => [id, (progress as unknown as { awakening?: number }).awakening ?? 0])
      .filter(([, count]) => (count as number) > 0));
    // 반환 전 폐기 필드를 구조 분해해 현재 저장 JSON에 다시 섞이지 않게 한다.
    const { ownedHeartGemIds: _oldOwned, runeSlotsByRelicId: _oldSlots, ...current } = legacy;
    if (legacy.saveVersion === undefined) return { ...current, idleExcavation, settings, wallet, relicProgress, completedStoryIds, observationRecords, bookmarkedRelicIds, saveVersion: CURRENT_SAVE_VERSION, relicFragments, gachaPityByGroup: normalizedPity, dailyContent, dailyAdRewards, missions, productPurchases, runeInventory } as unknown as SaveData;
    const supported = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, CURRENT_SAVE_VERSION];
    if (!supported.includes(legacy.saveVersion as number)) throw new SaveDataError(`지원하지 않는 저장 버전입니다: ${String(legacy.saveVersion)}`);
    return { ...current, idleExcavation, settings, saveVersion: CURRENT_SAVE_VERSION, wallet, relicProgress, relicFragments, completedStoryIds, observationRecords, bookmarkedRelicIds, dailyContent, dailyAdRewards, missions, productPurchases, gachaPityByGroup: normalizedPity, runeInventory } as unknown as SaveData;
  }

  /** 콘텐츠 ID와 교차 필드 불변식까지 검사해 부분 손상을 조용히 전파하지 않는다. */
  validate(data: SaveData): void {
    const relicIds = new Set(PLAYABLE_RELICS.map(({ id }) => id));
    const stageIds = new Set(STAGES.map(({ id }) => id));
    const fail = (message: string): never => { throw new SaveDataError(message); };
    const excavation = data.idleExcavation;
    if (!excavation || !Array.isArray(excavation.assignedRelicIds) || excavation.assignedRelicIds.length !== 3 || excavation.assignedRelicIds.some((id) => id !== null && (!relicIds.has(id) || !data.ownedRelicIds.includes(id))) || excavation.assignedRelicIds.filter(Boolean).length !== new Set(excavation.assignedRelicIds.filter(Boolean)).size || (excavation.lastSettledAt !== null && !Number.isFinite(Date.parse(excavation.lastSettledAt))) || !excavation.unclaimed || Object.values(excavation.unclaimed).some((amount) => !Number.isFinite(amount) || amount < 0) || !Number.isFinite(excavation.baseStorageSeconds) || excavation.baseStorageSeconds <= 0 || !Number.isFinite(excavation.activeProductionMultiplier) || excavation.activeProductionMultiplier <= 0 || (excavation.storageExtensionExpiresAt !== null && !Number.isFinite(Date.parse(excavation.storageExtensionExpiresAt)))) fail("발굴 상태가 올바르지 않습니다.");
    if (data.saveVersion !== CURRENT_SAVE_VERSION || !Array.isArray(data.ownedRelicIds) || data.ownedRelicIds.some((id) => !relicIds.has(id))) fail("존재하지 않는 렐릭 ID가 있습니다.");
    // 설정은 저장 전에 정규화되므로 검증 시 값이 바뀐다면 현재 계약이 아닌 손상 데이터다.
    if (JSON.stringify(data.settings) !== JSON.stringify(normalizeSettings(data.settings))) fail("설정 정보가 올바르지 않습니다.");
    if (!Array.isArray(data.completedStoryIds) || data.completedStoryIds.some((id) => typeof id !== "string") || new Set(data.completedStoryIds).size !== data.completedStoryIds.length) fail("완료 스토리 정보가 올바르지 않습니다.");
    if (!Array.isArray(data.observationRecords) || data.observationRecords.some((record) => !record || typeof record.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !relicIds.has(record.relicId) || typeof record.storyId !== "string" || typeof record.questionId !== "string" || typeof record.question !== "string" || typeof record.choiceId !== "string" || typeof record.answer !== "string" || typeof record.personalityTag !== "string" || typeof record.discoveredHabit !== "string")) fail("관찰 인터뷰 기록이 올바르지 않습니다.");
    if (new Set(data.observationRecords.map(({ date }) => date)).size !== data.observationRecords.length) fail("하루에 관찰 인터뷰를 두 번 기록할 수 없습니다.");
    if (!Array.isArray(data.party) || data.party.length !== 3 || new Set(data.party).size !== 3 || data.party.some((id) => !data.ownedRelicIds.includes(id))) fail("파티는 서로 다른 보유 렐릭 3명이어야 합니다.");
    if (!relicIds.has(data.favorite) || !data.ownedRelicIds.includes(data.favorite)) fail("애착 렐릭이 올바르지 않습니다.");
    // 즐겨찾기는 여러 명이 될 수 있지만 보유하지 않은 렐릭이 섞이면 목록이 깨진다.
    if (!Array.isArray(data.bookmarkedRelicIds) || data.bookmarkedRelicIds.some((id) => !data.ownedRelicIds.includes(id)) || new Set(data.bookmarkedRelicIds).size !== data.bookmarkedRelicIds.length) fail("즐겨찾기 정보가 올바르지 않습니다.");
    if (data.selectedStageId !== null && !stageIds.has(data.selectedStageId)) fail("스테이지 ID가 올바르지 않습니다.");
    if (!Array.isArray(data.clearedStageIds) || data.clearedStageIds.some((id) => !stageIds.has(id))) fail("클리어 진행이 올바르지 않습니다.");
    if (!data.wallet || !Number.isFinite(data.wallet.fossil) || data.wallet.fossil < 0 || !Number.isFinite(data.wallet.amber) || data.wallet.amber < 0 || !Number.isInteger(data.wallet.dnaFragments) || data.wallet.dnaFragments < 0 || !Number.isInteger(data.wallet.cheesecake) || data.wallet.cheesecake < 0) fail("재화가 올바르지 않습니다.");
    if (!data.gachaPityByGroup || [...new Set(BANNERS.map(({ pityGroupId }) => pityGroupId))].some((id) => !Number.isInteger(data.gachaPityByGroup[id]?.pullsSinceSsr) || data.gachaPityByGroup[id].pullsSinceSsr < 0 || typeof data.gachaPityByGroup[id].pickupGuaranteed !== "boolean")) fail("배너 그룹 천장 정보가 올바르지 않습니다.");
    if (!data.relicProgress || typeof data.relicProgress !== "object") fail("성장 정보가 없습니다.");
    // 보유 목록과 성장 레코드는 항상 정확히 같은 렐릭 집합이어야 한다.
    if (data.ownedRelicIds.some((id) => !data.relicProgress[id]) || Object.keys(data.relicProgress).some((id) => !data.ownedRelicIds.includes(id))) fail("보유 렐릭과 성장 정보가 일치하지 않습니다.");
    for (const [id, progress] of Object.entries(data.relicProgress)) {
      if (!relicIds.has(id) || !Number.isInteger(progress.breakthrough) || progress.breakthrough < 0 || progress.breakthrough > BREAKTHROUGH_CAP || !Number.isInteger(progress.exp) || progress.exp < 0 || !Number.isInteger(progress.bondLevel) || progress.bondLevel < 0 || progress.bondLevel > 10 || !Number.isInteger(progress.bondXp) || progress.bondXp < 0 || progress.bondXp > 650 || typeof progress.lastLobbyInteractionDate !== "string" || !Number.isInteger(progress.level) || progress.level < 1 || !Array.isArray(progress.heartGemSlots) || progress.heartGemSlots.length !== 3) fail("렐릭 성장 정보가 올바르지 않습니다.");
    }
    // 파편은 보유 렐릭의 것만, 음이 아닌 정수로만 남는다. 보유하지 않은 개체의 파편이
    // 섞이면 어디에도 쓸 수 없는 값이 저장에 남는다.
    if (!data.relicFragments || typeof data.relicFragments !== "object"
      || Object.entries(data.relicFragments).some(([id, count]) => !data.ownedRelicIds.includes(id) || !Number.isInteger(count) || count < 0)) fail("렐릭 파편 정보가 올바르지 않습니다.");
    if (!Array.isArray(data.runeInventory)) fail("룬 인벤토리가 올바르지 않습니다.");
    try { data.runeInventory.forEach(assertValidRuneInstance); } catch { fail("룬 인벤토리에 손상된 인스턴스가 있습니다."); }
    const runeIds = data.runeInventory.map(({ instanceId }) => instanceId);
    if (new Set(runeIds).size !== runeIds.length) fail("룬 인스턴스 ID가 중복되었습니다.");
    // RelicProgress가 장착의 단일 기준이며 모든 값은 보유 RuneInstance.instanceId여야 한다.
    const equipped = Object.values(data.relicProgress).flatMap(({ heartGemSlots }) => heartGemSlots.filter((id): id is string => id !== null));
    if (equipped.some((id) => !runeIds.includes(id)) || new Set(equipped).size !== equipped.length) fail("룬 장착 소유권 또는 중복이 올바르지 않습니다.");
    if (!data.dailyContent || typeof data.dailyContent.date !== "string" || !Number.isInteger(data.dailyContent.restorationEntries) || data.dailyContent.restorationEntries < 0 || data.dailyContent.restorationEntries > 3 || !Array.isArray(data.dailyContent.completedIds) || !Array.isArray(data.dailyContent.claimedRewardIds)) fail("일일 콘텐츠 정보가 올바르지 않습니다.");
    if (!data.missions || typeof data.missions.dailyKey !== "string" || typeof data.missions.weeklyKey !== "string" || !data.missions.progress || typeof data.missions.progress !== "object" || Object.values(data.missions.progress).some((value) => !Number.isInteger(value) || value < 0) || !Array.isArray(data.missions.claimedIds) || new Set(data.missions.claimedIds).size !== data.missions.claimedIds.length) fail("임무 진행 정보가 올바르지 않습니다.");
    if (!data.productPurchases || typeof data.productPurchases !== "object" || Object.values(data.productPurchases).some((value) => typeof value.periodKey !== "string" || !Number.isInteger(value.count) || value.count < 0)) fail("상품 구매 제한 정보가 올바르지 않습니다.");
    const adLimits = Object.fromEntries(AD_REWARD_SLOTS.map(({ id, dailyLimitUtc }) => [id, dailyLimitUtc]));
    // 삭제/변조된 슬롯과 정적 UTC 제한을 넘긴 저장은 서버 지급 이력으로 신뢰하지 않는다.
    if (!data.dailyAdRewards || typeof data.dailyAdRewards.date !== "string" || !data.dailyAdRewards.claimsBySlot || Object.entries(data.dailyAdRewards.claimsBySlot).some(([id, count]) => !(id in adLimits) || !Number.isInteger(count) || count < 0 || count > adLimits[id]) || !Array.isArray(data.dailyAdRewards.requestIds) || data.dailyAdRewards.requestIds.some((id) => typeof id !== "string" || id.length === 0) || new Set(data.dailyAdRewards.requestIds).size !== data.dailyAdRewards.requestIds.length) fail("일일 광고 수령 정보가 올바르지 않습니다.");
  }

  private toSession(data: SaveData): Session {
    return {
      idleExcavation: { ...data.idleExcavation, assignedRelicIds: [...data.idleExcavation.assignedRelicIds], unclaimed: { ...data.idleExcavation.unclaimed } },
      settings: normalizeSettings(data.settings),
      completedStoryIds: new Set(data.completedStoryIds),
      observationRecords: data.observationRecords.map((record) => ({ ...record })),
      selectedStageId: data.selectedStageId, party: [...data.party], cleared: new Set(data.clearedStageIds), owned: new Set(data.ownedRelicIds), favorite: data.favorite, bookmarked: new Set(data.bookmarkedRelicIds),
      wallet: { ...data.wallet }, relicProgress: Object.fromEntries(Object.entries(data.relicProgress).map(([id, value]) => [id, cloneProgress(value)])),
      relicFragments: { ...data.relicFragments },
      runeInventory: data.runeInventory.map(cloneRune),
      gachaPityByGroup: Object.fromEntries(Object.entries(data.gachaPityByGroup).map(([id, pity]) => [id, { ...pity }])),
      dailyContent: { ...data.dailyContent, completedIds: [...data.dailyContent.completedIds], claimedRewardIds: [...data.dailyContent.claimedRewardIds] },
      missions: { ...data.missions, progress: { ...data.missions.progress }, claimedIds: [...data.missions.claimedIds] },
      productPurchases: Object.fromEntries(Object.entries(data.productPurchases).map(([id, value]) => [id, { ...value }])),
      dailyAdRewards: { ...data.dailyAdRewards, claimsBySlot: { ...data.dailyAdRewards.claimsBySlot }, requestIds: [...data.dailyAdRewards.requestIds] },
    };
  }
}

/** 브라우저 앱이 공유하는 유일한 로컬 저장 진입점이다. */
export const saveManager = new SaveManager();

/** 부트 복구 실패 시 호출자가 명시적으로 기본 상태를 선택할 수 있게 한다. */
export function defaultSessionAfterReset(): Session {
  return createDefaultSession();
}
