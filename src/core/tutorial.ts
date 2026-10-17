/**
 * 첫 플레이 튜토리얼 — 오프닝 1-1에서 곧장 시작해 한 칸씩 조작을 열어 주는 순서표.
 *
 * **순서가 곧 규칙이다.** 앞 칸을 마치기 전에는 뒤 칸을 마칠 수 없고(`canCompleteTutorialStep`), 전투 조작
 * (자동 궁극기·연출 스킵·배속·기여도 순)은 자기 칸을 마친 뒤에야 열린다(`battleFeatureOpen`). 한 칸에 걸리는
 * 보상은 `TUTORIAL_REWARDS` 한 표가 갖는다 — 지급은 서버 경계(`GameApi.completeTutorialStep`)만 한다.
 */
export const TUTORIAL_STEPS = [
  /** 오프닝 1-1: 빛나는 궁극기 카드를 눌러 쓴다. 이 판은 다른 조작을 모두 막는다. */
  "ultimate",
  /** 다음 스토리 전투: 자동 궁극기 칩이 열린다. */
  "auto",
  /** 그다음 전투: 궁극기 연출 스킵 칩이 열린다. */
  "presentation",
  /** 그다음 전투: 배속 칩이 열린다. */
  "speed",
  /** 그다음 전투: 기여도 판이 열린다. */
  "contribution",
  /** 로비 → 도감 → 급여: 치즈케이크로 렐릭을 키운다. */
  "feed",
  /** 로비에서 뽑기 재료를 선물로 받는다(`TUTORIAL_REWARDS.gift`). */
  "gift",
  /** 연구소에서 첫 복원 연구를 직접 돌린다. */
  "pull",
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEPS)[number];

/**
 * 콘텐츠 첫 방문 안내 — 처음 들어온 화면에서 한 번만 뜨는 짧은 쪽지. 순서가 없고(레벨이 열어 주는 순서가 사람마다
 * 다르다), 첫 플레이 튜토리얼을 모두 마친 뒤에만 뜬다(진행 중인 안내와 겹치지 않게).
 */
export const CONTENT_INTRO_IDS = [
  "stageMap", "party", "shop", "cakeOperation", "bounty", "interaction", "duel", "friends", "raid", "expedition", "archaeology", "premium",
] as const;

export type ContentIntroId = (typeof CONTENT_INTRO_IDS)[number];

export interface TutorialState {
  /** 마친 칸의 ID. 순서대로 쌓이며 앞 칸이 비면 뒤 칸이 들어올 수 없다. */
  completedStepIds: TutorialStepId[];
  /** 이미 본 첫 방문 안내. 비어 있으면 필드 자체를 두지 않는다(저장 모양을 늘리지 않는다). */
  seenIntroIds?: ContentIntroId[];
}

const INTRO_SET: ReadonlySet<string> = new Set(CONTENT_INTRO_IDS);

export function isContentIntroId(value: unknown): value is ContentIntroId { return typeof value === "string" && INTRO_SET.has(value); }

export function isContentIntroSeen(state: TutorialState, id: ContentIntroId): boolean { return state.seenIntroIds?.includes(id) ?? false; }

/** 첫 방문 안내를 띄울 차례인가: 첫 플레이 튜토리얼을 마쳤고 아직 안 본 것. */
export function shouldShowContentIntro(state: TutorialState, id: ContentIntroId): boolean {
  return isTutorialComplete(state) && !isContentIntroSeen(state, id);
}

/** 전투 화면의 조작 중 튜토리얼이 하나씩 여는 것. */
export type BattleTutorialFeature = "speed" | "auto" | "presentation" | "contribution";

/** 조작 → 그것을 여는 칸. 전투 화면은 이 표만 읽는다. */
export const BATTLE_FEATURE_STEP: Readonly<Record<BattleTutorialFeature, TutorialStepId>> = {
  speed: "speed",
  auto: "auto",
  presentation: "presentation",
  contribution: "contribution",
};

/** 칸을 마칠 때 서버가 한 번만 주는 것. 지금은 뽑기 재료 한 가지뿐이다. */
export const TUTORIAL_REWARDS: Readonly<Partial<Record<TutorialStepId, { fossil: number }>>> = {
  // 첫 복원 연구(배너 `welcome`)는 10연 전용이고 화석 8개가 든다 — 정확히 한 번 돌릴 몫이다.
  gift: { fossil: 8 },
};

export function createEmptyTutorialState(): TutorialState { return { completedStepIds: [] }; }

/** 모든 칸을 마친 상태 — 튜토리얼이 필요 없는 저장·E2E 시작점이 쓴다. */
export function createCompletedTutorialState(): TutorialState { return { completedStepIds: [...TUTORIAL_STEPS], seenIntroIds: [...CONTENT_INTRO_IDS] }; }

const STEP_SET: ReadonlySet<string> = new Set(TUTORIAL_STEPS);

export function isTutorialStepId(value: unknown): value is TutorialStepId { return typeof value === "string" && STEP_SET.has(value); }

/** 저장에서 읽은 값을 순서가 맞는 앞쪽 접두사만 남겨 바로잡는다. 모르는 ID·중복·건너뜀은 버린다. */
export function normalizeTutorialState(value: unknown): TutorialState {
  const raw = (value && typeof value === "object" ? (value as { completedStepIds?: unknown }).completedStepIds : undefined);
  const ids = Array.isArray(raw) ? raw : [];
  const done = new Set(ids.filter(isTutorialStepId));
  const completedStepIds: TutorialStepId[] = [];
  for (const step of TUTORIAL_STEPS) {
    if (!done.has(step)) break;
    completedStepIds.push(step);
  }
  const rawIntros = (value && typeof value === "object" ? (value as { seenIntroIds?: unknown }).seenIntroIds : undefined);
  const seen = new Set(Array.isArray(rawIntros) ? rawIntros.filter(isContentIntroId) : []);
  const seenIntroIds = CONTENT_INTRO_IDS.filter((id) => seen.has(id));
  return seenIntroIds.length > 0 ? { completedStepIds, seenIntroIds } : { completedStepIds };
}

export function isValidTutorialState(value: unknown): value is TutorialState {
  return !!value && typeof value === "object" && JSON.stringify(normalizeTutorialState(value)) === JSON.stringify(value);
}

/**
 * 튜토리얼 도입 전 저장의 시작점. 이미 오프닝 너머를 해 본 계정에게 조작 잠금을 새로 걸지 않는다 —
 * 1-1 말고 깬 관문이 있으면 모두 마친 것으로 본다. 1-1만 깬 계정은 궁극기 칸만 마친 채 이어서 받는다.
 */
export function legacyTutorialState(clearedStageIds: readonly string[]): TutorialState {
  if (clearedStageIds.some((id) => id !== "1-1")) return createCompletedTutorialState();
  return clearedStageIds.includes("1-1") ? { completedStepIds: ["ultimate"] } : createEmptyTutorialState();
}

export function isTutorialStepDone(state: TutorialState, step: TutorialStepId): boolean { return state.completedStepIds.includes(step); }

export function isTutorialComplete(state: TutorialState): boolean { return state.completedStepIds.length >= TUTORIAL_STEPS.length; }

/** 지금 차례인 칸. 모두 마쳤으면 `undefined`. */
export function nextTutorialStep(state: TutorialState): TutorialStepId | undefined { return TUTORIAL_STEPS[state.completedStepIds.length]; }

/** 앞 칸이 모두 끝났거나 이미 마친 칸만 마칠 수 있다. */
export function canCompleteTutorialStep(state: TutorialState, step: TutorialStepId): boolean {
  return isTutorialStepDone(state, step) || nextTutorialStep(state) === step;
}

/** 전투 조작이 열려 있나. 스토리 전투만 튜토리얼에 묶이고 다른 모드는 늘 열려 있다. */
export function battleFeatureOpen(state: TutorialState, feature: BattleTutorialFeature, storyBattle: boolean): boolean {
  return !storyBattle || isTutorialStepDone(state, BATTLE_FEATURE_STEP[feature]);
}

/** 이 전투에서 새로 열어 알려 줄 조작. 앞 칸이 모두 끝났고 자기 차례일 때만 있다. */
export function battleFeatureToTeach(state: TutorialState): BattleTutorialFeature | undefined {
  const next = nextTutorialStep(state);
  return (Object.keys(BATTLE_FEATURE_STEP) as BattleTutorialFeature[]).find((feature) => BATTLE_FEATURE_STEP[feature] === next);
}

/** 전투 튜토리얼을 모두 마치고 도감·연구소 안내만 남은 상태인가(로비가 안내를 시작할 때). */
export function lobbyTutorialStep(state: TutorialState): "feed" | "gift" | "pull" | undefined {
  const next = nextTutorialStep(state);
  return next === "feed" || next === "gift" || next === "pull" ? next : undefined;
}
