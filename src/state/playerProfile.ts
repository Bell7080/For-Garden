import { PLAYABLE_RELICS, RELICS } from "../data/relics";
import { STAGES } from "../data/stages";
import { highestClearedStage } from "../core/stageProgress";
import { breakthroughGrade, calculateFinalStats } from "../core/relicProgression";
import { combatPower } from "../core/combatPower";
import { nextContentUnlock, type ContentId } from "../core/contentUnlock";
import { researchDays } from "../core/playerCard";
import { PLAYER_LEVEL_CAP } from "../core/playerLevel";
import type { Element, PortraitAssetId, RelicRarity, Role } from "../core/types";
import { profileFrameOrDefault } from "../data/profileFrames";
import type { Session } from "./session";
import { t } from "../i18n";

/**
 * 플레이어 카드 한 장을 그리는 데 필요한 공개 값 — **인증·계정 내부 키는 의도적으로 없다.**
 *
 * 수집형 RPG의 프로필 카드는 대개 같은 것을 말한다: 누구인가(닉네임·UID·한 줄 소개·테두리·
 * 수식어), 얼마나 했는가(레벨·경험치·연구 일수), 무엇을 이뤘나(스토리 진행·원정 최고·도감),
 * 그리고 **누구를 아끼는가**(애착 렐릭). 화면은 이 모델만 읽고 세션을 다시 뒤지지 않는다.
 */
export interface PlayerProfileDisplay {
  displayName: string;
  level: number;
  experience: number;
  experienceToNext: number;
  /** 최대 레벨이면 경험치 줄 대신 MAX가 선다. */
  levelCapped: boolean;
  /** 공개 UID. 없으면 계정 표시 ID, 그것도 없으면 게스트. */
  displayId: string;
  /** 한 줄 소개. 비어 있으면 그 줄을 세우지 않는다. */
  bio: string;
  frameId: string;
  /** 프로필 사진 — 고른 렐릭, 없으면 애착 렐릭. 둘 다 없으면 머리글자가 선다. */
  avatar: { relicId: string; portraitAssetId: PortraitAssetId } | null;
  avatarAssetKey?: string;
  representativeRelic: string;
  /** 연구 개시일부터 며칠째인가. 친구 카드는 공개하지 않아 비어 있다. */
  researchDays?: number;
  competitiveStats: PlayerCompetitiveStats;
  /** 도감 수집. 친구 카드는 공개하지 않아 비어 있다(그 칸이 서지 않는다). */
  collection?: { owned: number; total: number };
  /**
   * **친구 카드에만 온다** — 마지막 접속. 경험치는 본인만 보는 값이라 친구 카드에서는 경험치 줄
   * 자리에 이 한 줄이 선다.
   */
  lastActive?: string;
  /** 레벨 잠금을 켰을 때만 서는 다음 개방 콘텐츠. */
  nextUnlock?: { contentId: ContentId; level: number };
  equippedModifiers: PublicProfileModifier[];
}

export interface FavoriteRelicShowcase {
  relicId: string;
  displayName: string;
  portraitAssetId: PortraitAssetId;
  level: number;
  breakthroughGrade: number;
  /** 유대는 본인만 보는 값이라 친구 카드에서는 비어 있다(그 줄이 서지 않는다). */
  bondLevel?: number;
  /** 입고 있는 외형. 친구 카드는 서버가 공개한 외형을, 자기 카드는 비워 두고 제 장착을 읽는다. */
  skinId?: string | null;
  rarity: RelicRarity;
  element: Element;
  role: Role;
  power: number;
}

export interface PlayerCompetitiveStats {
  favoriteRelic: FavoriteRelicShowcase | null;
  arenaTier?: { tierId: string; displayName: string };
  highestStage: { stageId: string; displayValue: string } | null;
  /** 스토리 진행 — 깬 관문 수와 전체 관문 수. 친구 카드는 최고 관문만 공개해 비어 있다. */
  storyProgress?: { cleared: number; total: number };
  /** 원정 최고. 공개하지 않은 친구는 비어 있다(그 칸이 서지 않는다). */
  expedition?: { label: string; score: number };
}

export interface PublicProfileModifier {
  id: string;
  displayName: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

/** 애착 렐릭의 지금 모습. 친구 창이 공개 스냅샷을 쓰듯 여기서 한 번 굳혀 넘긴다. */
function favoriteShowcase(state: Session): FavoriteRelicShowcase | null {
  const relic = RELICS.find(({ id }) => id === state.favorite);
  if (!relic) return null;
  const progress = state.relicProgress[relic.id];
  const gems = (progress?.heartGemSlots ?? []).flatMap((id) => {
    const rune = id === null ? undefined : state.runeInventory.find((candidate) => candidate.instanceId === id);
    return rune ? [rune] : [];
  });
  const stats = progress ? calculateFinalStats(relic.stats, progress, gems, relic.rarity) : relic.stats;
  return {
    relicId: relic.id, displayName: relic.name, portraitAssetId: relic.portraitAssetId,
    level: progress?.level ?? 1, breakthroughGrade: breakthroughGrade(progress?.breakthrough ?? 0), bondLevel: progress?.bondLevel ?? 0,
    rarity: relic.rarity, element: relic.element, role: relic.role, power: combatPower(stats),
  };
}

/** 고른 프로필 사진이 보유 중이면 그것, 아니면 애착 렐릭의 얼굴. */
function profileAvatarRelic(state: Session): { relicId: string; portraitAssetId: PortraitAssetId } | null {
  const chosen = state.playerCard.avatarRelicId && state.owned.has(state.playerCard.avatarRelicId) ? state.playerCard.avatarRelicId : state.favorite;
  const relic = RELICS.find(({ id }) => id === chosen);
  return relic ? { relicId: relic.id, portraitAssetId: relic.portraitAssetId } : null;
}

/** 저장 가능한 공개 설정·애착 렐릭과 서버 확정 진행만 읽어 안전한 표시 모델을 만든다. */
export function playerProfileDisplay(state: Session, equippedModifiers: readonly PublicProfileModifier[] = [], arenaTier?: { tierId: string; displayName: string }, now: Date = new Date()): PlayerProfileDisplay {
  const favorite = favoriteShowcase(state);
  const stage = highestClearedStage(STAGES, state.cleared);
  const card = state.playerCard;
  const research = state.playerResearch;
  const next = nextContentUnlock(research.level);
  return {
    // 기본 이름은 표가 아니라 부를 때 고른다 — 표는 모듈을 읽는 순간 굳어 언어를 따라오지 않는다.
    displayName: card.nickname || t("profile.defaultName"),
    level: research.level,
    experience: research.experience,
    experienceToNext: research.experienceToNext,
    levelCapped: research.level >= PLAYER_LEVEL_CAP,
    displayId: card.uid || state.settings.account.displayId.trim() || t("profile.guest"),
    bio: card.bio,
    frameId: profileFrameOrDefault(card.frameId).id,
    avatar: profileAvatarRelic(state),
    representativeRelic: favorite?.displayName ?? t("profile.noFavorite"),
    researchDays: researchDays(card.createdAt, now),
    competitiveStats: {
      favoriteRelic: favorite,
      ...(arenaTier ? { arenaTier: { ...arenaTier } } : {}),
      highestStage: stage ? { stageId: stage.id, displayValue: `${stage.id} ${stage.name}` } : null,
      storyProgress: { cleared: STAGES.filter(({ id }) => state.cleared.has(id)).length, total: STAGES.length },
      // 장기 성취 프로필이므로 주간 초기화 값이 아닌 명시적인 역대 최고만 표시한다.
      expedition: { label: t("profile.expeditionBest"), score: Math.max(0, state.expedition.allTimeBestScore) },
    },
    collection: { owned: PLAYABLE_RELICS.filter(({ id }) => state.owned.has(id)).length, total: PLAYABLE_RELICS.length },
    ...(next ? { nextUnlock: { contentId: next.id, level: next.level } } : {}),
    equippedModifiers: equippedModifiers.map((modifier) => ({ ...modifier })),
  };
}

/** 실제 아바타 텍스처가 있을 때만 키를 쓰고, 없으면 표시 이름의 첫 글자로 되돌아간다. */
export function profileAvatarContent(profile: PlayerProfileDisplay, hasTexture: (key: string) => boolean): { assetKey?: string; fallback: string } {
  const fallback = Array.from(profile.displayName.trim())[0] ?? "?";
  return profile.avatarAssetKey && hasTexture(profile.avatarAssetKey)
    ? { assetKey: profile.avatarAssetKey, fallback }
    : { fallback };
}

/**
 * 친구의 공개 헤더를 **같은 플레이어 카드**로 그리는 표시 모델.
 *
 * 친구 창이 제 나름의 프로필을 따로 그리던 때는 같은 "한 사람의 카드"가 자기와 친구에서 다른
 * 양식이었다. 공개하지 않은 값(경험치·유대·도감·연구 일수)은 **0으로 채우지 않고 비운다** —
 * 카드가 그 칸을 세우지 않으므로 없는 기록을 "0"이라 말하지 않는다.
 */
export function friendProfileDisplay(friend: {
  displayName: string; level: number; uid: string; frameId: string; status: string; lastActive: string; avatarRelicId?: string;
  equippedModifiers: readonly PublicProfileModifier[];
  favoriteRelic: { relicId: string; equippedSkinId?: string | null; level: number; breakthroughGrade: number; stats: Parameters<typeof combatPower>[0] };
  competitiveStats: { highestStage?: { stageId: string; displayValue: string }; arenaTier?: { tierId: string; displayName: string }; expeditionScore?: number };
}): PlayerProfileDisplay {
  const relic = RELICS.find(({ id }) => id === friend.favoriteRelic.relicId);
  const favorite: FavoriteRelicShowcase | null = relic ? {
    relicId: relic.id, displayName: relic.name, portraitAssetId: relic.portraitAssetId,
    level: friend.favoriteRelic.level, breakthroughGrade: friend.favoriteRelic.breakthroughGrade,
    skinId: friend.favoriteRelic.equippedSkinId ?? null,
    rarity: relic.rarity, element: relic.element, role: relic.role, power: combatPower(friend.favoriteRelic.stats),
  } : null;
  const avatarRelic = RELICS.find(({ id }) => id === (friend.avatarRelicId ?? friend.favoriteRelic.relicId));
  const stats = friend.competitiveStats;
  return {
    displayName: friend.displayName,
    level: friend.level,
    experience: 0,
    experienceToNext: 0,
    levelCapped: friend.level >= PLAYER_LEVEL_CAP,
    displayId: friend.uid,
    bio: friend.status,
    frameId: profileFrameOrDefault(friend.frameId).id,
    avatar: avatarRelic ? { relicId: avatarRelic.id, portraitAssetId: avatarRelic.portraitAssetId } : null,
    representativeRelic: favorite?.displayName ?? t("profile.noFavorite"),
    lastActive: friend.lastActive,
    competitiveStats: {
      favoriteRelic: favorite,
      ...(stats.arenaTier ? { arenaTier: { ...stats.arenaTier } } : {}),
      highestStage: stats.highestStage ? { ...stats.highestStage } : null,
      ...(stats.expeditionScore !== undefined ? { expedition: { label: t("profile.expeditionBest"), score: stats.expeditionScore } } : {}),
    },
    equippedModifiers: friend.equippedModifiers.map((modifier) => ({ ...modifier })),
  };
}
