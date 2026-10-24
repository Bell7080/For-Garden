import { BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL } from "./bond";
import type { Wallet } from "./gacha";
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from "./playerLevel";
import { BREAKTHROUGH_CAP, relicLevelCap, remainingBreakthroughCost, UNIVERSAL_FRAGMENT_ITEM } from "./relicProgression";
import type { RelicProgress } from "./types";

/**
 * QA 디버그 창이 서버(또는 임시 서버)에 시키는 일. 콜백이 아니라 판별 가능한 데이터 명령이라
 * 서버가 같은 규칙으로 다시 검증하고, 정식 서버 빌드는 이 경로 전체를 거절한다(`FakeServer.applyDebugCommand`).
 *
 * `relicId: "owned"`는 보유한 모든 렐릭, `"all"`(획득)은 플레이 가능한 모든 렐릭이다.
 */
export type DebugCommand =
  | { kind: "currency"; key: keyof Wallet; mode: "add" | "set"; amount: number }
  | { kind: "playerLevel"; level: number }
  | { kind: "clearChapters"; through: number }
  | { kind: "grantRelics"; relicIds: string[] | "all" }
  | { kind: "relicLevel"; relicId: string; level: number }
  | { kind: "relicBreakthrough"; relicId: string; breakthrough: number }
  | { kind: "relicBond"; relicId: string; level: number }
  | { kind: "relicFragments"; relicId: string; amount: number }
  | { kind: "breakthroughSet"; relicId: string }
  | { kind: "universalFragments"; amount: number }
  | { kind: "unlockStories" };

export interface DebugCommandResponse {
  ok: boolean;
  /** 실제로 바뀐 대상 수(렐릭 수·관문 수 등). 재화·플레이어 레벨은 바뀌었으면 1. */
  changed: number;
}

/** 명령이 건드리는 세션의 부분이다. 호출자가 복사본에 얹은 뒤 한 번에 저장한다. */
export interface DebugTarget {
  wallet: Wallet;
  owned: Set<string>;
  relicProgress: Record<string, RelicProgress>;
  relicFragments: Record<string, number>;
  relicStory: { metAt: Record<string, string> } & Record<string, unknown>;
  playerResearch: { level: number; experience: number };
  cleared: Set<string>;
  /** 가방에 넣을 아이템 수. 묶음·한도 규칙은 서버의 지급 경로(`grantItem`)가 맡으므로 여기서는 수만 모은다. */
  itemGrants: Record<string, number>;
}

export interface DebugRules {
  walletCaps: Readonly<Record<keyof Wallet, number>>;
  playable: readonly { id: string; rarity: "SSR" | "SR" | "R" }[];
  /** 장 번호 → 그 장의 관문 ID. */
  stageIdsThrough: (chapter: number) => string[];
  initialProgress: () => RelicProgress;
  bondXpFirstAcquisition: number;
}

/** 레벨 L을 담을 수 있는 가장 낮은 돌파 단계. */
export function breakthroughForLevel(level: number): number {
  for (let b = 0; b <= BREAKTHROUGH_CAP; b += 1) if (relicLevelCap(b) >= level) return b;
  return BREAKTHROUGH_CAP;
}

function ownedProgress(target: DebugTarget, relicId: string): RelicProgress {
  const progress = target.relicProgress[relicId];
  if (!target.owned.has(relicId) || !progress) throw new Error(`보유하지 않은 렐릭입니다: ${relicId}`);
  return progress;
}

function targets(target: DebugTarget, relicId: string): string[] {
  return relicId === "owned" ? [...target.owned].filter((id) => target.relicProgress[id]) : (ownedProgress(target, relicId), [relicId]);
}

function integer(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) throw new RangeError("숫자가 아닙니다.");
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** 명령을 `target`에 직접 적용하고 바뀐 수를 돌려준다. 호출자는 복사본을 넘기고 성공했을 때만 저장한다. */
export function applyDebugCommand(target: DebugTarget, command: DebugCommand, rules: DebugRules): number {
  switch (command.kind) {
    case "currency": {
      if (!(command.key in rules.walletCaps)) throw new Error("알 수 없는 재화입니다.");
      const cap = rules.walletCaps[command.key];
      const amount = integer(command.amount, 0, cap);
      const next = command.mode === "set" ? amount : Math.min(cap, target.wallet[command.key] + amount);
      const changed = next !== target.wallet[command.key];
      target.wallet[command.key] = next;
      return changed ? 1 : 0;
    }
    case "playerLevel": {
      const level = integer(command.level, 1, PLAYER_LEVEL_CAP);
      if (target.playerResearch.level === level) return 0;
      target.playerResearch = normalizePlayerLevel({ level, experience: 0 });
      return 1;
    }
    case "clearChapters": {
      let changed = 0;
      for (const id of rules.stageIdsThrough(integer(command.through, 1, 99))) if (!target.cleared.has(id)) { target.cleared.add(id); changed += 1; }
      return changed;
    }
    case "grantRelics": {
      const ids = command.relicIds === "all" ? rules.playable.map((relic) => relic.id) : command.relicIds;
      let changed = 0;
      for (const id of ids) {
        if (!rules.playable.some((relic) => relic.id === id)) throw new Error(`획득할 수 없는 렐릭입니다: ${id}`);
        if (target.owned.has(id)) continue;
        target.owned.add(id);
        const base = rules.initialProgress();
        target.relicProgress[id] ??= { ...base, bondXp: Math.min(BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_CAP], base.bondXp + rules.bondXpFirstAcquisition) };
        changed += 1;
      }
      return changed;
    }
    case "relicLevel": {
      const level = integer(command.level, 1, relicLevelCap(BREAKTHROUGH_CAP));
      let changed = 0;
      for (const id of targets(target, command.relicId)) {
        const p = target.relicProgress[id];
        // 레벨이 현재 돌파의 상한을 넘으면 그 레벨을 담을 만큼만 돌파를 함께 올린다(만들 수 없는 성장 상태를 만들지 않는다).
        const breakthrough = Math.max(p.breakthrough, breakthroughForLevel(level));
        if (p.level === level && p.breakthrough === breakthrough) continue;
        target.relicProgress[id] = { ...p, level, exp: 0, breakthrough };
        changed += 1;
      }
      return changed;
    }
    case "relicBreakthrough": {
      const breakthrough = integer(command.breakthrough, 0, BREAKTHROUGH_CAP);
      let changed = 0;
      for (const id of targets(target, command.relicId)) {
        const p = target.relicProgress[id];
        // 돌파 단계는 직전 단계의 상한 레벨 이상에서만 성립하므로 레벨을 그 선까지 끌어올린다. 낮추면 상한에 맞춘다.
        const floor = breakthrough === 0 ? 1 : relicLevelCap(breakthrough - 1);
        const level = Math.min(relicLevelCap(breakthrough), Math.max(p.level, floor));
        if (p.breakthrough === breakthrough && p.level === level) continue;
        target.relicProgress[id] = { ...p, breakthrough, level, exp: level === p.level ? p.exp : 0 };
        changed += 1;
      }
      return changed;
    }
    case "relicBond": {
      const level = integer(command.level, 0, BOND_LEVEL_CAP);
      let changed = 0;
      for (const id of targets(target, command.relicId)) {
        const p = target.relicProgress[id];
        if (p.bondLevel === level && p.bondXp === BOND_TOTAL_XP_BY_LEVEL[level]) continue;
        target.relicProgress[id] = { ...p, bondLevel: level, bondXp: BOND_TOTAL_XP_BY_LEVEL[level] };
        changed += 1;
      }
      return changed;
    }
    case "relicFragments": {
      ownedProgress(target, command.relicId);
      const amount = integer(command.amount, 0, 99_999);
      if (amount === 0) return 0;
      target.relicFragments[command.relicId] = (target.relicFragments[command.relicId] ?? 0) + amount;
      return 1;
    }
    case "breakthroughSet": {
      const progress = ownedProgress(target, command.relicId);
      const rarity = rules.playable.find((relic) => relic.id === command.relicId)?.rarity;
      if (!rarity) throw new Error("플레이 가능한 렐릭이 아닙니다.");
      const cost = remainingBreakthroughCost(rarity, progress);
      if (cost.fragments === 0 && cost.cheesecake === 0) return 0;
      target.relicFragments[command.relicId] = (target.relicFragments[command.relicId] ?? 0) + cost.fragments;
      target.wallet.cheesecake = Math.min(rules.walletCaps.cheesecake, target.wallet.cheesecake + cost.cheesecake);
      return 1;
    }
    case "universalFragments": {
      const amount = integer(command.amount, 0, 999);
      if (amount === 0) return 0;
      for (const itemId of Object.values(UNIVERSAL_FRAGMENT_ITEM)) target.itemGrants[itemId] = (target.itemGrants[itemId] ?? 0) + amount;
      return 1;
    }
    case "unlockStories": {
      let changed = 0;
      for (const id of target.owned) {
        const p = target.relicProgress[id];
        if (!p || p.bondLevel >= BOND_LEVEL_CAP) continue;
        target.relicProgress[id] = { ...p, bondLevel: BOND_LEVEL_CAP, bondXp: BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_CAP] };
        changed += 1;
      }
      // 처음 만난 날을 지우면 관찰 질문이 모두 열린 상태(기록 도입 전 개체와 같다)가 된다.
      target.relicStory = { ...target.relicStory, metAt: {} };
      return changed;
    }
  }
}
