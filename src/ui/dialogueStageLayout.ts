import { BASE_WIDTH } from "../config/gameConfig";
import type { DialogueAct, DialogueBackdrop, DialogueCue, DialogueSign, DialogueStageSlot, DialogueStandingAsset } from "../core/dialogue";
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

/**
 * 화면 전체를 덮는 층이 화면 밖으로 더 뻗는 폭.
 *
 * 진동은 카메라를 흔들므로, 화면에 딱 맞춘 층은 흔들리는 순간 가장자리에 덮이지 않은 띠가
 * 드러난다 — 하단 대사판이 끝나는 자리에서 배경이 한 줄 새어 나와 "아래만 하얗게 번쩍"했다.
 * 진동의 최대 폭(화면 높이의 3%, 약 58px)보다 넉넉하게 둔다.
 */
export const DIALOGUE_OVERSCAN = 96;

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

/**
 * 날아가는 퇴장(`blastOff`). 한 번 움찔 눌렸다가 오른쪽 위로 빙글빙글 날아가며 작아지고,
 * 사라진 자리에서 작은 마름모 하나가 반짝인다 — 전투에서 쓰러진 SD가 "별이 되는" 것과 같다.
 * 셋이 함께 나갈 때는 조금씩 어긋나 떠나야 한 덩어리로 뭉쳐 보이지 않는다(`staggerMs`).
 */
/** 무대 자리의 왼쪽부터 순서. 여럿이 함께 떠날 때 이 순서로 차례를 센다. */
export const DIALOGUE_SLOT_ORDER: Readonly<Record<DialogueStageSlot, number>> = { left: 0, center: 1, right: 2 };

export const DIALOGUE_BLAST_OFF = {
  crouchMs: 110,
  crouchDy: 36,
  flyMs: 820,
  /** 함께 날아가는 사람들이 모이는 가로 자리(화면 가운데에서의 변위). 세로는 제 자리에서 `dy`만큼 오른다. */
  convergeX: 300,
  dy: -1100,
  spinTurns: 2.5,
  endScale: 0.18,
  /** 떠나는 차례의 어긋남. 크면 셋이 따로 날아가는 것으로 읽혀 함께 날아간 한 덩어리가 풀린다. */
  staggerMs: 70,
  twinkleMs: 520,
  twinkleSize: 64,
  twinkleY: 110,
} as const;

/** 스탠딩 연출 한 걸음 — 기준 자리에서의 변위와 그 자리까지 가는 시간. */
export interface DialogueActStep {
  dx: number;
  dy: number;
  ms: number;
  ease: "Quad.Out" | "Quad.In" | "Sine.InOut" | "Back.Out" | "Linear";
  /** 가로·세로 배율(제 크기의 몇 배). 적지 않으면 1 — 눌리고 늘어나는 몸짓이 쓴다. */
  sx?: number;
  sy?: number;
  /** 몸에 덮는 색의 진하기(0~1). 어떤 색인지는 `DIALOGUE_ACT_FILL`이 몸짓별로 갖는다. 적지 않으면 0. */
  fill?: number;
}

/**
 * 색이 덮이는 몸짓의 색. 푸르게 질린 겁먹음, 붉게 빠직한 분노, 하얗게 질린 멍함이다.
 * 전투의 폭주가 쓰는 같은 경로(`setBodyFill`)라 원화의 윤곽과 선은 그대로 남고 색만 덮인다.
 */
export const DIALOGUE_ACT_FILL: Readonly<Partial<Record<DialogueAct, number>>> = {
  fright: 0x5f8dff,
  rage: 0xff2f2f,
  faint: 0xe8eef8,
};

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
  // 퍽 맞은 듯 꾹 눌렸다가(가로로 퍼지고 세로로 낮아진다) 반동으로 늘어난 뒤 제 크기로 돌아온다.
  squash: [
    { dx: 0, dy: 40, sx: 1.2, sy: 0.7, ms: 80, ease: "Quad.Out" },
    { dx: 0, dy: 40, sx: 1.2, sy: 0.7, ms: 150, ease: "Linear" },
    { dx: 0, dy: -18, sx: 0.92, sy: 1.1, ms: 130, ease: "Quad.Out" },
    { dx: 0, dy: 0, sx: 1, sy: 1, ms: 220, ease: "Back.Out" },
  ],
  // 착지에서 납작해지고 뜰 때 늘어나는 말랑한 두 번 통통.
  bounce: [
    { dx: 0, dy: 14, sx: 1.1, sy: 0.88, ms: 80, ease: "Quad.Out" },
    { dx: 0, dy: -50, sx: 0.93, sy: 1.1, ms: 130, ease: "Quad.Out" },
    { dx: 0, dy: 12, sx: 1.1, sy: 0.88, ms: 120, ease: "Quad.In" },
    { dx: 0, dy: -30, sx: 0.95, sy: 1.07, ms: 100, ease: "Quad.Out" },
    { dx: 0, dy: 0, sx: 1, sy: 1, ms: 140, ease: "Back.Out" },
  ],
  // 푸르게 질려 움츠린 채 잘게 떨다가 서서히 색이 돌아온다.
  fright: [
    { dx: 0, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 110, ease: "Quad.Out" },
    { dx: -6, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: 6, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: -6, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: 6, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: -5, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: 5, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 38, ease: "Linear" },
    { dx: 0, dy: 18, sx: 0.97, sy: 0.96, fill: 0.6, ms: 220, ease: "Linear" },
    { dx: 0, dy: 0, sx: 1, sy: 1, fill: 0, ms: 460, ease: "Sine.InOut" },
  ],
  // 붉게 빠직하며 한 뼘 부풀어 부들부들 떤다. 색은 전투 폭주처럼 몸 위에만 얹힌다.
  rage: [
    { dx: 0, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 110, ease: "Quad.Out" },
    { dx: -7, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: 7, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: -7, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: 7, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: -5, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: 5, dy: -10, sx: 1.07, sy: 1.07, fill: 0.55, ms: 40, ease: "Linear" },
    { dx: 0, dy: -10, sx: 1.07, sy: 1.07, fill: 0.5, ms: 200, ease: "Linear" },
    { dx: 0, dy: 0, sx: 1, sy: 1, fill: 0, ms: 420, ease: "Sine.InOut" },
  ],
  // 하얗게 질려 좌우로 휘청이다 정신을 차린다.
  faint: [
    { dx: -20, dy: 8, sx: 0.98, sy: 0.98, fill: 0.45, ms: 170, ease: "Sine.InOut" },
    { dx: 20, dy: 8, sx: 0.98, sy: 0.98, fill: 0.45, ms: 240, ease: "Sine.InOut" },
    { dx: -12, dy: 4, sx: 0.99, sy: 0.99, fill: 0.3, ms: 200, ease: "Sine.InOut" },
    { dx: 0, dy: 0, sx: 1, sy: 1, fill: 0, ms: 300, ease: "Sine.InOut" },
  ],
  // 으쓱하며 가슴을 편 듯 한 뼘 커졌다가 돌아온다.
  puff: [
    { dx: 0, dy: -16, sx: 1.08, sy: 1.1, ms: 170, ease: "Quad.Out" },
    { dx: 0, dy: -16, sx: 1.08, sy: 1.1, ms: 240, ease: "Linear" },
    { dx: 0, dy: 0, sx: 1, sy: 1, ms: 280, ease: "Sine.InOut" },
  ],
};

/**
 * 무전 너머의 목소리(`remote`)의 겉모습.
 *
 * 마일리지 상점의 홀로그램 점원과 같은 결이다 — 푸른 단색 + 반투명으로 투영처럼 서고, 직접 만나지
 * 못하는 사람이라 **얼굴은 검은 실루엣으로 눌러 둔다.** 말하는 사람은 더 밝고, 나머지는 가라앉는다.
 * 얼굴을 덮는 어둠은 머리 관절 둘레의 번지는 타원이라 판때기처럼 보이지 않는다.
 */
export const DIALOGUE_REMOTE = {
  tint: 0x8fe9ff,
  dimTint: 0x4a7b88,
  alpha: 0.82,
  /** 투영이 일렁이는 폭. 알파만 아주 조금 오간다. */
  flickerAlpha: 0.1,
  flickerMs: 1500,
  /** 얼굴 어둠: 머리 관절 기준 반지름(배율 1 기준 px)과 겹의 수·겹당 진하기. */
  face: { radiusX: 118, radiusY: 138, layers: 4, alphaPerLayer: 0.2, color: 0x03070c, offsetY: -6 },
} as const;

/**
 * 사람이 아닌 목소리의 글자 딱지. 가운데 캐릭터 자리에 선다.
 *
 * 상점의 「매진」 딱지처럼 비스듬히 찍힌 한 장이다 — 종류마다 색만 다르고 모양은 하나다.
 * 글자는 `dialogue.sign.<종류>` 문구가 갖는다.
 */
export const DIALOGUE_SIGN: Readonly<Record<DialogueSign, { color: number; textColor: string }>> = {
  announce: { color: 0x7fd4ff, textColor: "#d8f4ff" },
  warning: { color: 0xff4a4a, textColor: "#ffd9d9" },
  system: { color: 0x7dffb8, textColor: "#dcffee" },
  broadcast: { color: 0xffc857, textColor: "#fff0cc" },
  tower: { color: 0x9aa8ff, textColor: "#e3e7ff" },
};

/** 딱지의 크기·자리. 머리 줄(`DIALOGUE_STANDING_FRAME.headY`) 아래 가슴께에 가로로 길게 찍힌다. */
export const DIALOGUE_SIGN_LAYOUT = {
  width: 640,
  height: 214,
  /** 딱지 가운데의 y. */
  y: 700,
  tiltDeg: -5,
  textSize: 110,
  /** 찍히는 연출: 크게 시작해 쾅 하고 제 크기로 내려앉는다. */
  stampFromScale: 1.55,
  stampMs: 210,
  depth: 560,
  dimAlpha: 0.9,
} as const;

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
 * 첫 순간은 **바닥에 눌린 마름모 충격파 한 겹과 흩어지는 잔해 몇 조각**이다. 같은 크기의
 * 파편 열두 개를 원 위에 고르게 세워 한꺼번에 밀어내던 때는 가운데에서 **가시 돋친 공**이
 * 부풀어 오르는 것으로 보였고, 조각마다 그래픽 한 장·tween 하나라 폭파 한 번이 열두 개를
 * 새로 만들었다. 지금은 충격파와 잔해를 **그래픽 한 장에 그려 한 tween으로 키운다** — 잔해는
 * 저마다 다른 거리(`reach`)에 놓여 있어 함께 커져도 반듯한 별이 되지 않는다. 난수를 쓰지 않아
 * 같은 폭파가 늘 같은 그림을 그린다.
 */
export const DIALOGUE_EXPLOSION = {
  whiteInMs: 110,
  holdMs: 280,
  whiteOutMs: 760,
  shardCount: 7,
  /** 충격파가 다 퍼졌을 때의 가로 반지름. 세로는 `waveSquash`만큼 눌려 바닥에 눕는다. */
  waveRadius: 620,
  waveSquash: 0.42,
  /** 잔해 조각의 기본 크기(다 퍼졌을 때). */
  shardSize: 26,
  burstMs: 640,
  /** 퍼지기 시작하는 배율. 0에서 키우면 첫 프레임에 아무것도 보이지 않는다. */
  startScale: 0.16,
} as const;

/**
 * 잔해 조각 하나의 방향(도)·거리 비율·크기 배율. 각도도 거리도 어긋나게 흩어 두어 한 tween으로
 * 함께 커져도 원 위에 늘어선 별 모양이 되지 않는다.
 */
export function explosionShards(count: number = DIALOGUE_EXPLOSION.shardCount): readonly { angle: number; reach: number; scale: number }[] {
  const reaches = [0.92, 0.58, 0.78, 0.46, 1, 0.66, 0.84];
  const scales = [1, 0.7, 0.86, 0.6, 0.94, 0.74];
  return Array.from({ length: count }, (_, index) => ({
    angle: (360 / count) * index + [11, -17, 23, -6, 14, -21, 4][index % 7],
    reach: reaches[index % reaches.length],
    scale: scales[index % scales.length],
  }));
}

/** 이야기가 부르는 배경 이름과 원화 키의 대응. 새 무대는 여기 한 줄을 더한다. */
export const DIALOGUE_BACKDROP: Readonly<Record<DialogueBackdrop, string>> = {
  train: BACKGROUND.storyTrain,
  // 폭파 뒤 전장은 1-1이 실제로 싸우는 스토리 전장이다 — 오프닝이 끝나는 자리가 곧 첫 관문이다.
  battlefield: BACKGROUND.combat,
  // 배경을 정하지 않은 이야기(애착·곁 이야기 등)의 기본 무대 — 렐릭 도감 탭과 같은 원화다.
  relics: BACKGROUND.relics,
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
