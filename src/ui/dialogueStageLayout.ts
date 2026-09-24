import { BASE_WIDTH } from "../config/gameConfig";
import type { DialogueAct, DialogueBackdrop, DialogueCue, DialogueStageSlot, DialogueStandingAsset } from "../core/dialogue";
import { BACKGROUND } from "./backgroundAssets";

/**
 * 이야기 무대의 자리표.
 *
 * **위는 스탠딩이 선 무대, 아래는 대사판이다.** 스탠딩은 머리 관절을 무대에 고정해 **상반신이
 * 주로 보이게** 세우고, 남는 몸은 대사판 쪽으로 짙어지는 어둠(`DIALOGUE_STAGE_FADE`)에 잠긴다.
 *
 * Phaser 없는 모듈에 두는 이유는 화면과 회귀 테스트가 같은 값을 읽어야 하기 때문이다
 * (`tests/unit/dialogueStage.test.ts`).
 */

/** 대사판의 윗변. 판 자체의 모양은 `DialogueLayer`가 그린다. */
export const DIALOGUE_PANEL_TOP = 1270;

/**
 * 스탠딩의 몸이 **잠겨 드는** 어둠.
 *
 * 대사판 윗선에서 몸을 칼같이 자르던 때는 반투명 판 위로 허리·허벅지가 수평으로 잘린 단면이
 * 그대로 보여 인위적이었다. 지금은 판보다 한참 위에서 어둠이 옅게 시작해 판 윗선 언저리에서
 * 짙어지고, 판 안쪽에서 거의 불투명해진다 — 몸은 그 속으로 스르륵 가라앉아 어디서 끝나는지
 * 보이지 않는다. 두 구간으로 나눠 **아래로 갈수록 빨리 짙어지게** 한다(한 줄 직선이면 시작선이
 * 띠처럼 보인다). 배경도 같은 어둠에 함께 잠겨, 인물만 오려 붙인 것처럼 보이지 않는다.
 */
export const DIALOGUE_STAGE_FADE = {
  color: 0x07080c,
  /** 어둠이 시작하는 줄. 여기서는 완전히 투명하다. */
  start: DIALOGUE_PANEL_TOP - 400,
  /** 꺾이는 줄과 그 자리의 진하기. */
  knee: DIALOGUE_PANEL_TOP - 40,
  kneeAlpha: 0.5,
  /** 거의 불투명해지는 줄. 그 아래로는 화면 밑동까지 같은 진하기로 깔린다. */
  end: DIALOGUE_PANEL_TOP + 230,
  endAlpha: 0.97,
} as const;

/**
 * 스탠딩을 실제로 잘라 내는 선 — 어둠이 거의 불투명해진 자리다.
 *
 * 여기보다 위에서 자르면 잘린 단면이 어둠 사이로 비치고, 자르지 않으면 발끝이 판 밑동의 글
 * 뒤로 흐릿하게 남는다.
 */
export const DIALOGUE_STAGE_CUT = DIALOGUE_STAGE_FADE.end;

/** 자리마다 가운데에서 어느 쪽으로 비켜 서는가. */
const SLOT_SIDE: Readonly<Record<DialogueStageSlot, -1 | 0 | 1>> = { left: -1, center: 0, right: 1 };

/**
 * 몇 명이 함께 서는가에 따른 벌림과 크기.
 *
 * 혼자 서면 크게, 셋이 서면 조금 작게 벌려 선다. 한 크기로 셋을 세우면 어깨가 절반 넘게 겹쳐
 * 양옆이 가운데 사람의 그림자처럼 보이고, 벌리기만 하면 화면 밖으로 밀려난다. 셋이 함께
 * 서도 조금씩 겹치는 것은 그대로 둔다 — 그 겹침이 곧 "한 무리"로 읽히는 몫이다.
 */
export const DIALOGUE_STAGE_CROWD: Readonly<Record<1 | 2 | 3, { spread: number; zoom: number }>> = {
  1: { spread: 250, zoom: 1 },
  2: { spread: 235, zoom: 0.92 },
  3: { spread: 300, zoom: 0.8 },
};

/** 그 자리의 머리 x와 크기 배율. 무대에 선 사람 수가 바뀌면 이미 선 사람도 이 값으로 옮겨 선다. */
export function dialogueStageSpot(slot: DialogueStageSlot, castSize: number): { x: number; zoom: number } {
  const crowd = DIALOGUE_STAGE_CROWD[Math.min(3, Math.max(1, castSize)) as 1 | 2 | 3];
  return { x: BASE_WIDTH / 2 + SLOT_SIDE[slot] * crowd.spread, zoom: crowd.zoom };
}

/**
 * 스탠딩 한 명의 기준 틀. 머리 관절이 `headY`에 오고 그림 전체 높이가 `height`다.
 *
 * `headY`는 상단 여백이 머리끝을 자르지 않는 자리, `height`는 허리께가 대사판 윗선에 걸리는
 * 크기다. 원화마다 캔버스 여백과 등신이 달라 한 값으로는 얼굴 크기가 갈리므로 아래
 * `DIALOGUE_STANDING_ZOOM`이 원화 쪽 보정을 갖는다 — 화면이 개체마다 좌표를 적지 않는다.
 */
export const DIALOGUE_STANDING_FRAME = { headY: 540, height: 1880 } as const;

/**
 * 원화별 배율 보정. 1이 기준이다.
 *
 * 값은 1080×1920 캡처에서 **얼굴 크기가 서로 맞도록** 눈으로 맞췄다. 등신이 낮은(머리가 큰)
 * 원화는 줄이고, 캔버스에 여백이 많은 적 원화는 키운다.
 */
export const DIALOGUE_STANDING_ZOOM: Readonly<Partial<Record<DialogueStandingAsset, number>>> = {};

/** 말하는 사람과 나머지를 가르는 값. 나머지는 한 톤 가라앉고 한 층 뒤로 선다. */
export const DIALOGUE_FOCUS = {
  /** 말하지 않는 사람의 색. 검게 누르면 실루엣과 구별되지 않으므로 옅은 잿빛으로만 누른다. */
  dimTint: 0x767b88,
  /** 정체를 밝히지 않은 인물(`veiled`)의 실루엣 색. */
  veilTint: 0x06060a,
  speakerDepth: 102,
  listenerDepth: 100,
  /** 색이 바뀌는 시간. 뚝 끊으면 말하는 사람이 바뀔 때마다 화면이 깜빡인다. */
  tintMs: 160,
} as const;

/** 무대에 들어오고 나가는 움직임. 들어올 때는 자기 자리 바깥쪽에서 미끄러져 들어온다. */
export const DIALOGUE_ENTRANCE = {
  slide: 90,
  enterMs: 260,
  exitMs: 180,
  /** 이미 선 사람이 다른 자리로 옮겨 갈 때. */
  moveMs: 280,
} as const;

/** 스탠딩 연출 한 걸음 — 기준 자리에서의 변위와 그 자리까지 가는 시간. */
export interface DialogueActStep {
  dx: number;
  dy: number;
  ms: number;
  ease: "Quad.Out" | "Quad.In" | "Sine.InOut" | "Back.Out" | "Linear";
}

/**
 * 스탠딩 연출. **모든 줄은 제자리(0, 0)로 끝난다** — 끝나지 않으면 다음 연출이 어긋난
 * 자리에서 시작해 대사가 쌓일수록 인물이 조금씩 흘러내린다.
 *
 * 튀는 높이는 SD가 아니라 상반신 기준이다. 화면의 삼분의 일을 차지하는 몸이 60px만 떠도
 * "통" 소리가 난다 — 더 높이 띄우면 머리끝이 화면 위로 나간다.
 */
export const DIALOGUE_ACTS: Readonly<Record<DialogueAct, readonly DialogueActStep[]>> = {
  hop: [
    { dx: 0, dy: -52, ms: 130, ease: "Quad.Out" },
    { dx: 0, dy: 0, ms: 150, ease: "Quad.In" },
  ],
  hopTwice: [
    { dx: 0, dy: -44, ms: 110, ease: "Quad.Out" },
    { dx: 0, dy: 0, ms: 120, ease: "Quad.In" },
    { dx: 0, dy: -34, ms: 100, ease: "Quad.Out" },
    { dx: 0, dy: 0, ms: 110, ease: "Quad.In" },
  ],
  shake: [
    { dx: -22, dy: 0, ms: 50, ease: "Sine.InOut" },
    { dx: 20, dy: 0, ms: 60, ease: "Sine.InOut" },
    { dx: -16, dy: 0, ms: 60, ease: "Sine.InOut" },
    { dx: 12, dy: 0, ms: 60, ease: "Sine.InOut" },
    { dx: 0, dy: 0, ms: 50, ease: "Sine.InOut" },
  ],
  tremble: [
    { dx: -5, dy: 0, ms: 34, ease: "Linear" },
    { dx: 5, dy: 0, ms: 34, ease: "Linear" },
    { dx: -5, dy: 0, ms: 34, ease: "Linear" },
    { dx: 5, dy: 0, ms: 34, ease: "Linear" },
    { dx: -4, dy: 0, ms: 34, ease: "Linear" },
    { dx: 4, dy: 0, ms: 34, ease: "Linear" },
    { dx: -3, dy: 0, ms: 34, ease: "Linear" },
    { dx: 3, dy: 0, ms: 34, ease: "Linear" },
    { dx: 0, dy: 0, ms: 34, ease: "Linear" },
  ],
  nod: [
    { dx: 0, dy: 26, ms: 150, ease: "Quad.Out" },
    { dx: 0, dy: 0, ms: 220, ease: "Back.Out" },
  ],
  lean: [
    { dx: 0, dy: 34, ms: 220, ease: "Quad.Out" },
    { dx: 0, dy: 34, ms: 260, ease: "Linear" },
    { dx: 0, dy: 0, ms: 280, ease: "Sine.InOut" },
  ],
  recoil: [
    { dx: 0, dy: -30, ms: 90, ease: "Quad.Out" },
    { dx: 0, dy: 10, ms: 140, ease: "Quad.In" },
    { dx: 0, dy: 0, ms: 160, ease: "Back.Out" },
  ],
  shrink: [
    { dx: 0, dy: 46, ms: 240, ease: "Quad.Out" },
    { dx: 0, dy: 46, ms: 380, ease: "Linear" },
    { dx: 0, dy: 0, ms: 420, ease: "Sine.InOut" },
  ],
};

/**
 * 화면 연출의 세기.
 *
 * 흔들림은 환경설정의 화면 흔들림·움직임 줄이기를 지난 배율(`cameraShakeFactor`)을 곱해 쓰고,
 * 섬광은 번쩍임 줄이기를 켜면 그 몫만큼 옅어진다. 경보의 붉은 맥박은 화면 가장자리에만 서서
 * 가운데의 인물과 글을 덮지 않는다.
 */
export const DIALOGUE_CUES: Readonly<Record<DialogueCue, {
  shakeMs: number;
  shakeIntensity: number;
  flashAlpha: number;
}>> = {
  rumble: { shakeMs: 620, shakeIntensity: 0.014, flashAlpha: 0 },
  alarm: { shakeMs: 380, shakeIntensity: 0.008, flashAlpha: 0 },
  explosion: { shakeMs: 900, shakeIntensity: 0.03, flashAlpha: 1 },
  impact: { shakeMs: 180, shakeIntensity: 0.01, flashAlpha: 0.22 },
};

/** 경보의 붉은 맥박. 한 번 켜지면 폭파나 배경 전환이 끌 때까지 되풀이된다. */
export const DIALOGUE_ALARM = {
  color: 0xff2238,
  /** 가장자리 띠의 가장 진한 알파. 가운데는 비워 둔다. */
  peakAlpha: 0.42,
  /** 가장자리에서 안쪽으로 번지는 띠의 폭. */
  thickness: 120,
  pulseMs: 480,
} as const;

/**
 * 폭파. 하얗게 덮는 사이에 배경과 무대를 갈아 끼우고, 걷히면서 전장이 드러난다.
 *
 * 파편은 동그라미가 아니라 **납작한 마름모**이고 발밑으로 쏟아지지 않고 사방으로 튄다 —
 * 전장 이펙트와 같은 문법이다. 난수를 쓰지 않아 같은 폭파가 늘 같은 그림을 그린다.
 */
export const DIALOGUE_EXPLOSION = {
  whiteInMs: 110,
  holdMs: 280,
  whiteOutMs: 760,
  shardCount: 12,
  shardDistance: 760,
  shardMs: 620,
} as const;

/** 파편 하나의 방향(도)·크기 배율. 원 위에 고르게 놓되 크기를 어긋나게 해 반듯한 별이 되지 않게 한다. */
export function explosionShards(count: number = DIALOGUE_EXPLOSION.shardCount): readonly { angle: number; scale: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (360 / count) * index + (index % 2 === 0 ? 7 : -9),
    scale: [1, 0.62, 0.86, 0.5][index % 4],
  }));
}

/** 이야기가 부르는 배경 이름과 원화 키의 대응. 새 무대는 여기 한 줄을 더한다. */
export const DIALOGUE_BACKDROP: Readonly<Record<DialogueBackdrop, string>> = {
  train: BACKGROUND.storyTrain,
  // 폭파 뒤 전장은 1-1이 실제로 싸우는 스토리 전장이다 — 오프닝이 끝나는 자리가 곧 첫 관문이다.
  battlefield: BACKGROUND.combat,
};

/**
 * 이야기를 여는 제목표.
 *
 * 검은 화면 **위쪽**에서 가운데로부터 좌우로 열리고, 잠시 머문 뒤 걷히며 무대가 드러난다.
 * 타이틀 로고와 같은 문법이다 — 글자를 늘였다 줄이면 획이 찌그러지므로 잘라 내는 창을 넓혀 연다.
 */
export const STORY_TITLE_CARD = {
  titleY: 560,
  titleSize: 92,
  /** 제목 아래로 부제가 서는 거리. 둘 사이에 강조색 선이 한 줄 흐른다. */
  subtitleGap: 110,
  subtitleSize: 38,
  ruleWidth: 520,
  openMs: 720,
  holdMs: 1500,
  closeMs: 520,
  /** 검은 막이 걷히는 시간. 글자가 사라지는 것과 겹쳐 두 박자로 갈리지 않게 한다. */
  revealMs: 700,
} as const;

/** 제목표가 처음부터 끝까지 머무는 시간. 미리 읽기가 이 안에 끝나면 기다림이 없다. */
export function storyTitleCardDuration(): number {
  return STORY_TITLE_CARD.openMs + STORY_TITLE_CARD.holdMs + STORY_TITLE_CARD.closeMs;
}
