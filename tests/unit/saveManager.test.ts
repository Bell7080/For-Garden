import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveDataError, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";

/** 저장 왕복과 손상 검증에 쓰는 결정적 신규 룬이다. */
function testRune(instanceId = "rune-save-1") {
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
  return createRuneInstance({ instanceId, baseName: "저장 테스트 룬", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
}

/** 브라우저 전역을 건드리지 않고 직렬화 경계를 검증하는 최소 Storage 대역이다. */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function validData(): SaveData {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);
  manager.save(createDefaultSession());
  return JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
}

describe("SaveManager", () => {
  it("v32 외형 없는 저장도 토리카 기본 해금을 보유하고 손상된 레거시 선택은 폐기한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 32;
    legacy.ownedRelicSkinIds = ["missing-skin"];
    legacy.equippedRelicSkinIds = { anky: "missing-skin" };
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.ownedRelicSkinIds).toEqual(["torika-skin-001"]);
    expect(migrated.equippedRelicSkinIds).toEqual({});
  });

  it("v33 기존 소유 목록과 기본 해금을 중복 없이 병합한다", () => {
    const legacy = validData();
    legacy.saveVersion = 33;
    legacy.ownedRelicSkinIds = ["torika-skin-001"];
    // 이미 지급된 계정도 버전 이관에서 같은 ID가 두 번 생기지 않아야 한다.
    expect(new SaveManager(new MemoryStorage()).migrate(legacy).ownedRelicSkinIds).toEqual(["torika-skin-001"]);
  });

  it("기본 해금이 빠진 현행 저장은 로드 정규화에서 보충한다", () => {
    const storage = new MemoryStorage();
    const incomplete = validData();
    incomplete.ownedRelicSkinIds = [];
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(incomplete));
    // 검증 전에 실행되는 migrate가 현행 버전에도 동일한 기본 해금 정책을 적용한다.
    expect([...new SaveManager(storage).load()!.ownedRelicSkinIds]).toEqual(["torika-skin-001"]);
  });

  it("스킨 소유·장착을 JSON으로 왕복하고 현행 손상 ID와 대상 불일치를 거부한다", () => {
    const storage = new MemoryStorage();
    const source = createDefaultSession();
    // 신규 세션의 정적 기본 해금이 별도 테스트 주입 없이 그대로 직렬화되어야 한다.
    source.equippedRelicSkinIds.anky = "torika-skin-001";
    const manager = new SaveManager(storage);
    manager.save(source);
    const json = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    expect(json.ownedRelicSkinIds).toEqual(["torika-skin-001"]);
    expect(manager.load()?.equippedRelicSkinIds).toEqual({ anky: "torika-skin-001" });

    const unknown = validData();
    unknown.ownedRelicSkinIds = ["missing-skin" as never];
    expect(() => manager.validate(unknown)).toThrow("스킨 소유");
    const wrongRelic = validData();
    wrongRelic.equippedRelicSkinIds = { rex: "torika-skin-001" };
    expect(() => manager.validate(wrongRelic)).toThrow("스킨 장착");
  });

  it("v31의 저장된 허스크 참조를 신규 렐릭 ID로 바꾸고 중복 없이 현행 버전으로 재저장한다", () => {
    const storage = new MemoryStorage();
    const source = createDefaultSession();
    // 실제 원정 런을 먼저 만들어 맵처럼 이번 변경과 무관한 계약은 그대로 유효하게 유지한다.
    new ExpeditionManager(source, new SaveManager(storage), () => new Date("2026-08-25T12:00:00Z")).start(["anky", "rex", "spino"]);
    const legacy = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as unknown as Record<string, any>;
    legacy.saveVersion = 31;
    const replacements = [["anky", "husk-shell"], ["rex", "husk-raptor"], ["spino", "husk-wing"]] as const;
    // 구형 저장에서 캐릭터 참조가 존재했던 모든 플레이어 진행 경로를 재현한다.
    for (const [currentId, oldId] of replacements) {
      legacy.ownedRelicIds = legacy.ownedRelicIds.map((id: string) => id === currentId ? oldId : id);
      legacy.party = legacy.party.map((id: string) => id === currentId ? oldId : id);
      legacy.relicProgress[oldId] = legacy.relicProgress[currentId]; delete legacy.relicProgress[currentId];
    }
    legacy.favorite = "husk-shell";
    legacy.bookmarkedRelicIds = ["husk-shell", "amo", "husk-raptor"];
    legacy.relicFragments = { "husk-shell": 7, "husk-raptor": 2 };
    legacy.idleExcavation.assignedRelicIds = ["husk-shell", null, "husk-wing"];
    legacy.interaction = { slots: [{ dispatchId: "legacy-dispatch", cityId: "cairo", startedAt: "2026-08-25T00:00:00Z", completesAt: "2026-08-25T01:00:00Z", party: ["husk-shell", "amo", "husk-raptor"], rewardSeed: "seed", reward: { currency: "gold", amount: 1 }, claimed: false }], claimedRequestIds: [] };
    legacy.observationRecords = [{ date: "2026-08-25", relicId: "husk-wing", storyId: "story", questionId: "question", question: "질문", choiceId: "choice", answer: "답", personalityTag: "tag", discoveredHabit: "habit" }];
    legacy.expedition.lastParty = ["husk-shell", "amo", "husk-raptor", "husk-wing"];
    legacy.expedition.run.relics.forEach((relic: { relicId: string }) => { relic.relicId = replacements.find(([id]) => id === relic.relicId)?.[1] ?? relic.relicId; });
    legacy.expedition.run.selectedAugments = [{ augmentId: "predator-instinct", targetRelicId: "husk-shell" }];
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacy));

    const manager = new SaveManager(storage);
    const loaded = manager.load()!;
    expect([...loaded.owned]).toEqual(expect.arrayContaining(["amo", "toby", "ripa"]));
    expect(loaded.party).toEqual(["amo", "toby", "ripa"]);
    expect(loaded.favorite).toBe("amo");
    expect([...loaded.bookmarked]).toEqual(["amo", "toby"]);
    expect(loaded.relicFragments).toMatchObject({ amo: 7, toby: 2 });
    expect(loaded.idleExcavation.assignedRelicIds).toEqual(["amo", null, "ripa"]);
    expect(loaded.interaction.slots[0]?.party).toEqual(["amo", "toby"]);
    expect(loaded.observationRecords[0].relicId).toBe("ripa");
    expect(loaded.expedition.lastParty).toEqual(["amo", "toby", "ripa"]);
    expect(loaded.expedition.run?.relics.map(({ relicId }) => relicId)).toEqual(["amo", "toby", "ripa"]);
    expect(loaded.expedition.run?.selectedAugments[0].targetRelicId).toBe("amo");

    // 로드 마이그레이션은 저장소를 몰래 쓰지 않으며, 다음 정상 저장이 신규 버전을 확정한다.
    manager.save(loaded);
    const resaved = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    expect(resaved.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(JSON.stringify(resaved)).not.toContain("husk-shell");
  });

  it("구형/신규 ID의 성장 키 충돌은 임의 병합하지 않고 거부하며 알 수 없는 ID도 거부한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const collision = validData() as unknown as Record<string, any>;
    collision.saveVersion = 31;
    collision.ownedRelicIds.push("husk-shell", "amo");
    collision.relicProgress["husk-shell"] = { ...collision.relicProgress.anky };
    collision.relicProgress.amo = { ...collision.relicProgress.anky, level: 2 };
    expect(() => manager.migrate(collision)).toThrow("구형/신규 렐릭 ID");

    const unknown = validData();
    unknown.ownedRelicIds.push("husk-unknown");
    expect(() => manager.validate(manager.migrate(unknown))).toThrow("존재하지 않는 렐릭");
  });

  it("v24 저장은 플레이어 연구 진행을 명시적인 레벨 1 기본값으로 마이그레이션한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 24;
    delete legacy.playerResearch;
    expect(new SaveManager(new MemoryStorage()).migrate(legacy).playerResearch).toEqual({ level: 1, experience: 0, experienceToNext: 100 });
  });

  it("플레이어 연구 진행을 왕복하고 완료되지 않은 레벨 구간만 허용한다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    source.playerResearch = { level: 4, experience: 80, experienceToNext: 150 };
    const manager = new SaveManager(storage); manager.save(source);
    expect(manager.load()?.playerResearch).toEqual(source.playerResearch);
    const invalid = validData(); invalid.playerResearch.experience = invalid.playerResearch.experienceToNext;
    expect(() => manager.validate(invalid)).toThrow("플레이어 연구 진행");
  });

  it("v22 원정 준비 저장은 완전한 런을 꾸며내지 않고 빈 런으로 마이그레이션한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 22;
    legacy.expedition = { weekKey: "2026-08-24", playsThisWeek: 2, bestScore: 400, active: { relicIds: ["anky", "rex", "spino"], startedAt: "2026-08-25T00:00:00Z", score: 30 } };
    // 소탕 도입 전 저장은 그때까지의 주간 최고점을 역대 최고점 초기값으로 이어받는다.
    expect(new SaveManager(new MemoryStorage()).migrate(legacy).expedition).toEqual({ weekKey: "2026-08-24", playsThisWeek: 2, bestScore: 400, allTimeBestScore: 400, lastParty: [], run: null });
  });

  it("마지막 원정 편성을 왕복하고 구버전·미보유 항목을 안전하게 정규화한다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    source.expedition.lastParty = ["spino", "anky", "rex"];
    const manager = new SaveManager(storage); manager.save(source);
    expect(manager.load()?.expedition.lastParty).toEqual(["spino", "anky", "rex"]);

    const legacy = validData() as unknown as Record<string, any>;
    legacy.saveVersion = 26;
    legacy.expedition.lastParty = ["anky", "tia", "anky"];
    // 미보유와 중복은 제거하되 스토리 파티나 독립 발굴 배치로 채우지 않는다.
    expect(manager.migrate(legacy).expedition.lastParty).toEqual(["anky"]);
  });

  it("진행 중 원정의 맵·생존·증강·보상·점수를 독립 객체로 왕복한다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    const manager = new ExpeditionManager(source, new SaveManager(storage), () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const firstNode = source.expedition.run!.nodes.find(({ floor }) => floor === 1)!;
    // 매니저 저장 왕복은 전투 상태만 다루며 재화는 서버 완료 API만 쓸 수 있다.
    expect(manager.completeNode(firstNode.id, { relicHp: [90, 0, 75], augmentId: "field-repair", bossDamage: 3 })).toBe(true);
    const loaded = new SaveManager(storage).load()!;
    expect(loaded.expedition.run).toEqual(source.expedition.run);
    expect(loaded.expedition.run).not.toBe(source.expedition.run);
    expect(loaded.expedition.run?.relics[1]).toMatchObject({ relicId: "rex", currentHp: 0, alive: false });
  });

  it("원정 증강 등급은 저장하지 않고 구버전 런도 증강 ID만으로 마이그레이션한다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    const manager = new ExpeditionManager(source, new SaveManager(storage), () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const normal = source.expedition.run!.nodes.find(({ type }) => type === "normal")!;
    manager.beginAugmentReward(normal.id, normal.type);

    const legacy = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    // 제안과 확정 결과는 ID만 저장하므로 common/advanced 문자열을 sr/ssr로 바꾸는 저장 버전은 필요 없다.
    expect(JSON.stringify(legacy.expedition.run)).not.toContain('"rarity"');
    legacy.saveVersion = 30;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.expedition.run?.pendingAugmentReward).toEqual(source.expedition.run?.pendingAugmentReward);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  it.each([
    ["잘못된 노드", (run: any) => { run.currentNodeId = "missing-node"; }],
    // 도디는 신규 계정 기본 보유가 되었으므로 여전히 미보유인 티아로 손상 상태를 만든다.
    ["미보유 렐릭", (run: any) => { run.relics[0].relicId = "tia"; }],
    ["중복 렐릭", (run: any) => { run.relics[1].relicId = run.relics[0].relicId; }],
    ["음수 HP", (run: any) => { run.relics[0].currentHp = -1; }],
    ["음수 점수", (run: any) => { run.bestScore = -1; }],
    ["음수 보상", (run: any) => { run.pendingRewards.gold = -1; }],
    ["없는 증강", (run: any) => { run.selectedAugmentIds = ["missing-augment"]; }],
  ])("손상된 원정(%s)은 주간 기록만 남기고 런을 복구하지 않는다", (_label, corrupt) => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    new ExpeditionManager(source, new SaveManager(storage), () => new Date("2026-08-25T12:00:00Z")).start(["anky", "rex", "spino"]);
    const data = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    corrupt(data.expedition.run);
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    expect(new SaveManager(storage).load()?.expedition.run).toBeNull();
  });

  it("v17 저장은 임의 현재 시각 없이 서버 첫 조회 초기화 상태로 마이그레이션한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 17; delete legacy.idleExcavation;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.idleExcavation).toMatchObject({ assignedRelicIds: [null, null, null], lastSettledAt: null, baseStorageSeconds: 14_400 });
  });

  it("v18 발굴을 보존하면서 화석·다이아 키와 미완료 소급 표식을 보충한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 18;
    const excavation = legacy.idleExcavation as { unclaimed: Record<string, number>; retroactiveExcavationGrantVersion?: number };
    excavation.unclaimed = { gold: 4.5, cheesecake: 2 };
    delete excavation.retroactiveExcavationGrantVersion;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.idleExcavation.unclaimed).toEqual({ gold: 4.5, cheesecake: 2, fossil: 0, gems: 0 });
    expect(migrated.idleExcavation.retroactiveExcavationGrantVersion).toBe(0);
  });

  it("발굴 도입 전 v17 저장은 네 미수확 키와 미완료 소급 표식으로 이관한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 17; delete legacy.idleExcavation;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.idleExcavation.unclaimed).toEqual({ gold: 0, cheesecake: 0, fossil: 0, gems: 0 });
    expect(migrated.idleExcavation.retroactiveExcavationGrantVersion).toBe(0);
  });

  it("발굴 편성과 미수확 소수 생산량을 저장 왕복한다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    source.idleExcavation.assignedRelicIds = ["anky", null, "rex"]; source.idleExcavation.unclaimed.gold = 0.75;
    new SaveManager(storage).save(source);
    expect(new SaveManager(storage).load()?.idleExcavation).toMatchObject({ assignedRelicIds: ["anky", null, "rex"], unclaimed: { gold: 0.75 } });
  });
  it("v14 진행을 유지하면서 누락 설정만 기본값으로 마이그레이션한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 14; delete legacy.settings;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.wallet.gold).toBe((legacy.wallet as { gold: number }).gold); expect(migrated.settings.game.battleSpeed).toBe(1);
  });
  it("Set을 배열로 저장하고 로드할 때 독립 Set으로 복원한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.cleared.add("1-1");
    manager.save(source);

    const json = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    const loaded = manager.load()!;
    expect(json.ownedRelicIds).toEqual([...source.owned]);
    expect(json.clearedStageIds).toEqual(["1-1"]);
    expect(loaded.owned).toBeInstanceOf(Set);
    expect(loaded.cleared).toEqual(new Set(["1-1"]));
    expect(loaded.completedStoryIds).toEqual(new Set());
  });

  it("완료 스토리 ID를 저장하고 v3 저장은 빈 완료 목록으로 마이그레이션한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.completedStoryIds.add("opening-train");
    manager.save(source);
    expect(manager.load()?.completedStoryIds).toEqual(new Set(["opening-train"]));

    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 3;
    delete legacy.completedStoryIds;
    expect(manager.migrate(legacy).completedStoryIds).toEqual([]);
  });

  it("서브 스토리 완료 ID를 독립 Set으로 저장하고 복원한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.completedStoryIds.add("stage-1-5-greenhouse-echo");
    manager.save(source);
    expect(manager.load()?.completedStoryIds).toEqual(new Set(["stage-1-5-greenhouse-echo"]));
  });

  it("즐겨찾기를 저장하고 v4 저장은 빈 즐겨찾기로 마이그레이션한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.bookmarked.add("rex");
    manager.save(source);
    expect(manager.load()?.bookmarked).toEqual(new Set(["rex"]));

    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 4;
    delete legacy.bookmarkedRelicIds;
    // 애착 렐릭은 즐겨찾기와 다른 값이라 옮겨 담지 않는다.
    expect(manager.migrate(legacy).bookmarkedRelicIds).toEqual([]);
  });

  it("v5 저장의 DNA 숙련도를 각성 단계로 옮기고 경험치를 0으로 채운다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 5;
    const progress = legacy.relicProgress as Record<string, Record<string, unknown>>;
    for (const value of Object.values(progress)) {
      delete value.exp;
      value.awakening = 3;
    }

    const migrated = manager.migrate(legacy);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relicProgress.anky).toMatchObject({ exp: 0 });
    // 예전 각성 횟수는 같은 수의 파편으로 돌아온다. 이미 치른 중복이 사라지지 않아야 한다.
    expect(migrated.relicFragments.anky).toBe(3);
  });

  it("신규 획득 성장 정보와 DNA 조각을 저장 후 그대로 복구한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.owned.add("dodo");
    source.relicProgress.dodo = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    source.wallet.dnaFragments = 3;

    manager.save(source);
    const loaded = manager.load()!;
    expect(loaded.owned.has("dodo")).toBe(true);
    expect(loaded.relicProgress.dodo).toMatchObject({ level: 1, breakthrough: 0 });
    expect(loaded.wallet.dnaFragments).toBe(3);
  });

  it("saveVersion 없는 저장을 현재 규격으로 마이그레이션한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy: Record<string, unknown> = { ...validData() };
    delete legacy.saveVersion;
    delete legacy.dailyContent;

    expect(manager.migrate(legacy)).toMatchObject({ saveVersion: CURRENT_SAVE_VERSION, dailyContent: { completedIds: [] } });
  });

  it("v11 wallet.weeds를 cheesecake로 손실 없이 옮기고 새 키가 함께 있으면 우선한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 11;
    legacy.wallet = { ...(legacy.wallet as object), weeds: 345 };
    delete (legacy.wallet as Record<string, unknown>).cheesecake;

    const migratedLegacyOnly = manager.migrate(legacy);
    expect(migratedLegacyOnly.wallet.cheesecake).toBe(345);
    expect(migratedLegacyOnly.wallet).not.toHaveProperty("weeds");

    // 부분 배포 저장처럼 두 키가 공존해도 합산하지 않고 새 계약의 값을 보존한다.
    legacy.wallet = { ...(legacy.wallet as object), weeds: 345, cheesecake: 27 };
    expect(manager.migrate(legacy).wallet.cheesecake).toBe(27);
  });

  it("v1 저장은 스탯 이름 변경과 함께 플레이어별 유대를 0으로 마이그레이션한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 1;
    const progress = legacy.relicProgress as Record<string, Record<string, unknown>>;
    for (const value of Object.values(progress)) {
      delete value.bondLevel; delete value.bondXp; delete value.lastLobbyInteractionDate;
    }

    const migrated = manager.migrate(legacy);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relicProgress.anky.bondLevel).toBe(0);
    expect(migrated.relicProgress.anky.bondXp).toBe(0);
    expect(migrated.relicProgress.anky.lastLobbyInteractionDate).toBe("");
  });

  it("v7 배너별 천장을 이월 그룹으로 옮기고 픽업 확정은 안전하게 끈다", () => {
    const storage = new MemoryStorage();
    const data = validData() as unknown as Record<string, unknown> & { pullCountSinceHighestRarity: Record<string, number> };
    data.saveVersion = 7;
    delete data.gachaPityByGroup;
    data.pullCountSinceHighestRarity = { fossil: 12, "retired-banner": 77 };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.gachaPityByGroup).toEqual({
      "standard-fossil": { pullsSinceSsr: 12, pickupGuaranteed: false },
      "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false },
    });
  });

  it("같은 그룹의 교체 배너는 저장된 천장과 픽업 확정을 함께 이어받는다", () => {
    const source = createDefaultSession();
    source.gachaPityByGroup["limited-pickup"] = { pullsSinceSsr: 41, pickupGuaranteed: true };
    const storage = new MemoryStorage();
    new SaveManager(storage).save(source);
    expect(new SaveManager(storage).load()?.gachaPityByGroup["limited-pickup"]).toEqual({ pullsSinceSsr: 41, pickupGuaranteed: true });
  });

  it("손상 JSON을 복구 가능한 저장 오류로 보고한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_STORAGE_KEY, "{broken");
    expect(() => new SaveManager(storage).load()).toThrow(SaveDataError);
  });

  it("존재하지 않는 렐릭 ID를 거부한다", () => {
    const data = validData();
    data.ownedRelicIds.push("missing-relic");
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("존재하지 않는 렐릭");
  });

  it("중복 파티원을 거부한다", () => {
    const data = validData();
    data.party = ["anky", "anky", "rex"];
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("서로 다른 보유 렐릭");
  });

  it("범위를 벗어난 한계 돌파 단계를 거부한다", () => {
    const data = validData();
    data.relicProgress.anky.breakthrough = 9;
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("성장 정보");
  });

  it("v12 정적 젬을 안정적인 룬 인스턴스로 바꾸고 장착 참조도 함께 보존한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 12;
    legacy.ownedHeartGemIds = ["vital-seed", "fang-core", "ancient-pulse"];
    delete legacy.runeInventory;
    const progress = legacy.relicProgress as Record<string, { heartGemSlots: [string | null, string | null, string | null] }>;
    progress.anky.heartGemSlots = ["vital-seed", null, "ancient-pulse"];

    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.runeInventory.map(({ instanceId }) => instanceId)).toEqual(["legacy-v12-vital-seed", "legacy-v12-fang-core", "legacy-v12-ancient-pulse"]);
    expect(migrated.relicProgress.anky.heartGemSlots).toEqual(["legacy-v12-vital-seed", null, "legacy-v12-ancient-pulse"]);
  });

  it("신규 룬 인벤토리와 인스턴스 장착 참조를 저장 후 독립 객체로 왕복한다", () => {
    const storage = new MemoryStorage();
    const source = createDefaultSession();
    source.runeInventory = [testRune()];
    source.relicProgress.anky.heartGemSlots = ["rune-save-1", null, null];
    new SaveManager(storage).save(source);
    const loaded = new SaveManager(storage).load()!;
    expect(loaded.runeInventory).toEqual(source.runeInventory);
    expect(loaded.runeInventory).not.toBe(source.runeInventory);
    expect(loaded.relicProgress.anky.heartGemSlots).toEqual(["rune-save-1", null, null]);
  });

  it("손상된 강화 이력과 존재하지 않는 장착 인스턴스 참조를 거부한다", () => {
    const historyData = validData();
    const rune = testRune();
    historyData.runeInventory = [rune];
    const key = rune.mainStats[0].key;
    historyData.runeInventory[0] = { ...rune, enhancementHistory: { [key]: [{ attempt: 1, successChance: 2, succeeded: true, valueAdded: 1 }] } };
    expect(() => new SaveManager(new MemoryStorage()).validate(historyData)).toThrow("손상된 인스턴스");

    const slotData = validData();
    slotData.relicProgress.anky.heartGemSlots = ["missing-instance", null, null];
    expect(() => new SaveManager(new MemoryStorage()).validate(slotData)).toThrow("장착 소유권");
  });
});

// 광고 일일 상태는 토큰 없이 직렬화되고 v15 저장은 빈 상태로 이관되어야 한다.
describe("SaveManager 광고 상태 마이그레이션", () => {
  it("수령 상태를 왕복하고 v15 누락 필드를 기본값으로 채운다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    source.dailyAdRewards = { date: "2026-08-22", claimsBySlot: { "daily-stamina": 2 }, requestIds: ["request-1"] };
    new SaveManager(storage).save(source);
    expect(new SaveManager(storage).load()?.dailyAdRewards).toEqual(source.dailyAdRewards);
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 15; delete legacy.dailyAdRewards;
    expect(new SaveManager(new MemoryStorage()).migrate(legacy).dailyAdRewards).toEqual({ date: "", claimsBySlot: {}, requestIds: [] });
  });
});
