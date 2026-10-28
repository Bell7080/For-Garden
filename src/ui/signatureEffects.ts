/**
 * 개체를 그 개체답게 만드는 **한 순간**의 전용 연출.
 *
 * 공용 파편·파문은 "무언가 맞았다"까지만 말한다. 렉시아의 물어뜯기, 파치의 뇌진탕처럼 그
 * 개체를 설명하는 메커니즘은 같은 파편으로 터지면 옆 개체의 평타와 구별되지 않는다. 그래서
 * **어느 개체의 어느 순간에 무엇이 붙는지**를 이 표 하나가 갖고, 씬은 사건의 성격만 넘긴다.
 *
 * Phaser를 들여오지 않는다 — 도형과 색이 실제로 규칙을 지키는지 테스트가 그대로 재야 한다.
 */

import type { Element, Role } from "../core/types";
import { ELEMENT_TINT, ROLE_TINT, skillArtTint } from "./skillArt";

/** 섬광 감소 선택을 공용 효과 경계가 소비할 밝기·반복 상한으로 바꾼다. */
export function flashPolicy(reduceFlashes: boolean) {
  return reduceFlashes ? { alphaRatio: 0.32, maxRepeats: 0, fadeFromTransparent: false } as const
    : { alphaRatio: 1, maxRepeats: 2, fadeFromTransparent: true } as const;
}

export interface StrokePoint { x: number; y: number }

/**
 * 한 개체가 전장에서 쓰는 **두 색**.
 *
 * 스킬 아이콘은 둘을 섞은 파스텔 한 색을 쓰지만(`skillArtTint`), 전장에서는 섞으면 같은
 * 속성끼리 전부 한 덩어리로 보인다. 큰 면은 속성이, 얇은 선은 직군이 맡아야 "무슨 속성이
 * 때렸나"가 먼저 읽히고 "어떤 역할인가"가 그다음에 읽힌다.
 */
export interface CombatPalette {
  /** 채움·파편·섬광. 멀리서도 먼저 읽히는 큰 면이라 **속성**이 갖는다. */
  main: number;
  /** 윤곽·꼬리·잔상. 가까이서 갈리는 얇은 선이라 **직군**이 갖는다. */
  sub: number;
  /** 아이콘·배경 워시가 쓰는 섞인 색. 기존 표시와 같은 값이라야 한 개체로 읽힌다. */
  mixed: number;
}

export function combatPalette(element: Element, role: Role): CombatPalette {
  return { main: ELEMENT_TINT[element], sub: ROLE_TINT[role], mixed: skillArtTint(element, role) };
}

/**
 * 전용 연출이 붙는 순간.
 *
 * 코어의 사건 성격에서 그대로 나오는 이름만 쓴다 — 씬이 개체 이름으로 분기하면 개체가 늘
 * 때마다 씬이 길어지고, 같은 순간에 두 곳이 서로 다른 연출을 열게 된다.
 */
export type SignatureMoment =
  /** 궁극기의 결정타 한 방. */
  | "ultimate"
  /** 연격의 둘째 타(`followUp`). 한 행동 안에서 두 번 때린 것이 보여야 한다. */
  | "combo"
  /** 주기 타격이 터진 순간(파치의 뇌진탕). */
  | "concussion"
  /** 앞에 선 개체가 아군의 피해를 대신 받은 순간. */
  | "damageShared"
  /** 순환 평타의 한 걸음. 걸음 번호는 씬이 함께 넘긴다. */
  | "basicStep"
  /**
   * 순환·연격이 없는 **일반 공격 한 방**. 보스·불사처럼 판 하나를 혼자 짊어지는 개체만 이 순간을
   * 갖는다 — 모든 개체가 평타마다 전용 연출을 열면 난전이 연출로 뒤덮인다.
   */
  | "basic";

export type SignatureId =
  | "rexMaw"
  | "spinoDoubleTap"
  | "pachiSlam"
  | "nodoniaShare"
  | "ellaInkStroke"
  /** 폰토스 평타 — 발밑에서 두 겹 해일 파문이 밀려 나가고 물방울이 튄다. */
  | "pontosShockwave"
  /** 폰토스 궁극기 — 거대한 물마루가 말려 내려와 부서지고 바닥이 두 번 울린다. */
  | "pontosTidalCrash"
  /** 수쿠스이노 평타 — 물고 비튼다(죽음의 물레). 작은 턱 + 감기는 초승달 둘. */
  | "sukuDeathRoll"
  /** 수쿠스이노 궁극기 — 크게 벌어진 아가리가 닫히고 물보라가 솟는다. */
  | "sukuDrowningMaw"
  /** 타보아 평타 — 고리 셋이 표적을 조여 든다. */
  | "taboaConstrict"
  /** 타보아 궁극기 — 몸 둘레의 큰 고리가 감기며 열기가 솟는다. */
  | "taboaEmbrace"
  /** 코아틀 평타 — 부리 창이 표적을 꿰뚫고 뒤까지 뻗는다. */
  | "coatlBeakLance"
  /** 코아틀 궁극기 — 급강하의 속도선이 지나간 길에 깃털이 흩어지고 바닥이 울린다. */
  | "coatlStormDive";

/**
 * 개체 × 순간 → 연출.
 *
 * 여기 없는 조합은 공용 파편 그대로다. **모든 슬롯을 채우지 않는다** — 셋 이상이 같은
 * 무게로 터지면 어느 것이 그 개체의 기술인지 읽히지 않는다.
 */
const SIGNATURE_TABLE: Readonly<Record<string, Partial<Record<SignatureMoment, SignatureId>>>> = {
  rex: { ultimate: "rexMaw" },
  spino: { combo: "spinoDoubleTap" },
  pachi: { concussion: "pachiSlam" },
  nodonia: { damageShared: "nodoniaShare" },
  ella: { basicStep: "ellaInkStroke" },
  // 보스·불사 — 판 하나를 혼자 맡는 자리라 평타와 궁극기 둘 다 제 연출을 갖는다.
  pontos: { basic: "pontosShockwave", ultimate: "pontosTidalCrash" },
  sukusuino: { basic: "sukuDeathRoll", ultimate: "sukuDrowningMaw" },
  taboa: { basic: "taboaConstrict", ultimate: "taboaEmbrace" },
  quetzalcoatlus: { basic: "coatlBeakLance", ultimate: "coatlStormDive" },
};

/** 평타와 궁극기 모두 전용 연출을 갖는 개체 — 보스·불사 자리에 서는 개체다. */
export const SIGNATURE_BOSS_IDS = ["pontos", "sukusuino", "taboa", "quetzalcoatlus"] as const;

export function signatureFor(relicId: string, moment: SignatureMoment): SignatureId | undefined {
  return SIGNATURE_TABLE[relicId]?.[moment];
}

/**
 * 연출마다의 값.
 *
 * 씬은 "누가 누구를 어떤 순간에 쳤는지"만 넘기고 크기·시간·진하기를 고르지 않는다.
 * 알파가 낮은 이유는 밝은 배경 원화 위에서 조금만 진해도 SD와 피해 숫자가 그 속에 묻히기
 * 때문이다 — **예쁜 캐릭터를 가리는 순간 이펙트는 타격감이 아니라 방해다.**
 */
/**
 * 전용 연출의 먹선 두께(px). 전장의 다른 잉크 조각과 같은 결로 — 색면 위에 먹선이 경계를 쥔다.
 * 겹쳐 밝아지는 합성은 쓰지 않는다(밝은 원화 위에서 하얗게 뭉갰다).
 */
export const SIGNATURE_INK_WIDTH = 5;

export const SIGNATURE_SPECS = {
  /**
   * 렉시아 — 위아래 턱이 맞물린다.
   *
   * 렉시아는 숨은 메커니즘이 없는 대신 궁극기 한 방이 유별나게 세다. 그 한 방을 파편으로
   * 터뜨리면 다른 개체의 궁극기와 같은 무게로 읽히므로, **무는 동작 자체**를 그린다.
   */
  rexMaw: {
    /** 벌어진 턱의 반폭(px). 대상 몸 너비보다 넉넉해야 물었다는 그림이 된다. */
    halfWidth: 96,
    /** 이빨 한 줄의 깊이(px). */
    depth: 34,
    /** 한 줄의 이빨 수. 늘리면 톱니가 되고 줄이면 집게가 된다. */
    teeth: 5,
    /** 처음 벌어진 간격(px). 여기서 0까지 닫힌다. */
    gap: 104,
    /** 닫히기까지(ms). 궁극기 컷인 뒤라 짧아야 기다림이 되지 않는다. */
    ms: 190,
    /** 맞물린 뒤 서는 잉크 별의 크기(px) — 120이 일반 공격의 별 한 배다. */
    flash: 150,
    fillAlpha: 0.72,
    edgeWidth: 4,
  },
  /**
   * 스피나 — 따-닥.
   *
   * 연격은 한 행동에 두 번 때리는데 파편이 두 번 터지는 것만으로는 "한 번 세게"와 갈리지
   * 않았다. 베인 자국 두 장을 **박자를 두고** 그려 두 번이 눈에 남게 한다.
   */
  spinoDoubleTap: {
    /** 첫 베임의 길이(px). 둘째는 `growth`배로 커진다. */
    length: 78,
    growth: 1.34,
    /** 두 베임 사이의 박자(ms). 이 값이 곧 "따-닥"의 사이다. */
    beatMs: 90,
    /** 한 베임이 지나가는 시간(ms). 박자보다 길면 둘이 겹쳐 X 한 장으로 보인다. */
    ms: 84,
    /** 두 베임이 벌어진 각도 차(도). 같은 각이면 한 번 그은 것으로 보인다. */
    angleGap: 52,
    rootWidth: 13,
    tipWidth: 2,
    alpha: 0.8,
  },
  /**
   * 파치 — 깡.
   *
   * 뇌진탕은 4타마다 한 번 터지는 확정 치명타라 노란 숫자만으로는 왜 이번만 큰지 안 읽힌다.
   * 바닥을 때린 것처럼 **납작한 충격파 한 겹과 갈라진 금**을 남긴다.
   */
  pachiSlam: {
    /** 충격파 반지름(px)과 세로 눌림. 눌러야 바닥을 친 것으로 보인다. */
    radius: 132,
    squash: 0.34,
    ms: 230,
    ringWidth: 9,
    /** 갈라진 금의 수와 길이(px). 넷을 넘기면 금이 아니라 별이 된다. */
    cracks: 4,
    crackLength: 96,
    crackWidth: 5,
    alpha: 0.85,
  },
  /**
   * 노도니아 — 옮겨 간 피해.
   *
   * 아군이 맞았는데 노도니아가 깎이면, 선이 없으면 두 사건으로 읽힌다. 아군에게서 노도니아
   * 쪽으로 **한 줄기가 흘러가고** 도착한 자리에서 파문이 한 겹 인다.
   */
  nodoniaShare: {
    /** 흐르는 줄기의 두께(px)와 길이 비율(전체 길에서 차지하는 몫). */
    thickness: 16,
    span: 0.42,
    /** 아군에서 노도니아까지 흐르는 시간(ms). 피해 숫자가 뜬 직후에 닿아야 한다. */
    ms: 210,
    /** 도착한 자리의 파문. */
    ringRadius: 84,
    ringMs: 260,
    ringWidth: 6,
    alpha: 0.72,
  },
  /**
   * 엘라 — 수묵 세 획.
   *
   * 발경은 세 걸음이 저마다 다른 일을 하는데(막고·흔들고·끌어당기고) 파편은 셋 다 같아
   * 순환이 눈에 보이지 않았다. 걸음마다 **획의 성질을 바꾼다** — 번지고, 갈라지고, 끌린다.
   *
   * 먹은 빛이 아니라 얼룩이라 겹쳐 밝아지는 합성을 쓰지 않는다. 검은 획 위에 속성색을
   * 얇게 얹어 "누가 그었나"만 남긴다.
   */
  ellaInkStroke: {
    /** 먹의 색 — 전장의 잉크선과 같은 먹이다. 개체 색으로 칠하면 획이 아니라 발광이 된다. */
    ink: 0x2e2836,
    inkAlpha: 0.62,
    /** 획 둘레에 얹는 속성색의 진하기. 진해지면 먹이 아니라 색칠이 된다. */
    edgeAlpha: 0.34,
    edgeWidth: 3,
    /** 걸음마다의 길이(px)·두께(px)·시간(ms). 순서는 점(粘)·화(化)·발(發)이다. */
    steps: [
      { length: 46, rootWidth: 40, tipWidth: 30, ms: 260 },
      { length: 104, rootWidth: 22, tipWidth: 5, ms: 190 },
      { length: 132, rootWidth: 26, tipWidth: 4, ms: 230 },
    ],
    /** 「화」가 갈라지는 각(도). 두 획이 한 뿌리에서 벌어진다. */
    splitAngle: 26,
  },
  /**
   * 폰토스 — 심해 충격파.
   *
   * 주위를 한꺼번에 치는 평타라 맞은 쪽이 아니라 **폰토스의 발밑**에서 벌어진다. 공용 파문은 맞은
   * 자리마다 하나씩 서서 누가 밀어낸 것인지 흐렸다. 바닥에 누운 두 겹이 박자를 두고 밀려 나가고
   * 물방울 몇이 위로 튄다.
   */
  pontosShockwave: { radius: 230, squash: 0.36, ms: 360, waveGapMs: 110, width: 10, drops: 5, dropTravel: 96, alpha: 0.8 },
  /**
   * 폰토스 — 리바이어던 해일.
   *
   * 전장 전체를 치는 궁극기라 가장자리 워시가 이미 "모두 맞았다"를 말한다. 여기서는 **해일이 덮친
   * 한 자리**를 그린다 — 위에서 말려 내려오는 물마루가 부서지며 바닥이 두 번 울린다.
   */
  pontosTidalCrash: { width: 360, height: 150, curl: 70, dropMs: 260, ringRadius: 300, ringMs: 420, drops: 8, dropTravel: 150, alpha: 0.78 },
  /**
   * 수쿠스이노 — 죽음의 물레. 물고 비튼다.
   *
   * 렉시아의 턱보다 한참 작은 턱이 닫히고, 그 둘레를 초승달 둘이 감긴다 — 비트는 것이 곧 물레다.
   */
  sukuDeathRoll: { maw: 0.46, ms: 220, rollRadius: 58, rollTurns: 0.75, bladeScale: 0.42 },
  /**
   * 수쿠스이노 — 수장의 아가리.
   *
   * 렉시아의 무는 그림과 같은 문법이지만 훨씬 크게 벌어졌다 닫히고, 닫힌 자리에서 물보라가 솟아
   * 물속으로 끌어들인다는 것이 남는다.
   */
  sukuDrowningMaw: { maw: 1.55, ms: 280, ringRadius: 210, ringMs: 380, drops: 6, dropTravel: 130 },
  /**
   * 타보아 — 옥죄기. 고리 셋이 바깥에서 조여 든다.
   *
   * 공용 파문은 벌어지기만 해 "조인다"가 반대로 읽혔다. 같은 마름모를 **줄여 가며** 그린다.
   */
  taboaConstrict: { radius: 120, squash: 0.5, coils: 3, ms: 300, gapMs: 55, width: 8, alpha: 0.8 },
  /**
   * 타보아 — 질식의 포옹. 몸 둘레를 큰 고리가 감기며 조이고 열기가 솟는다.
   */
  taboaEmbrace: { radius: 400, squash: 0.42, coils: 3, ms: 460, gapMs: 90, width: 12, sparks: 6, sparkTravel: 120, alpha: 0.78 },
  /**
   * 코아틀 — 창날 부리. 꿰뚫는 평타라 맞은 자리를 지나 뒤까지 뻗는다.
   *
   * 판정이 표적 뒤의 적까지 나눠 맞히므로(관통) 창 끝이 표적 너머로 나가야 그 규칙이 보인다.
   */
  coatlBeakLance: { length: 260, beyond: 0.55, rootWidth: 20, tipWidth: 2, ms: 170, alpha: 0.85 },
  /**
   * 코아틀 — 폭풍 강하. 내리꽂은 길에 속도선이 남고 깃털이 흩어지며 바닥이 울린다.
   *
   * 3배속에서는 강하가 순간이동처럼 보이므로 **길을 선으로 남긴다**(돌진 잔상과 같은 이유다).
   */
  coatlStormDive: { lines: 5, length: 300, spread: 34, ms: 300, feathers: 6, featherTravel: 140, ringRadius: 220, ringMs: 360, alpha: 0.8 },
} as const;

/**
 * 말려 내려오는 물마루의 외곽선. 앞쪽 끝이 안으로 말려 들어간 갈고리 꼴이다.
 *
 * 반원으로 그리면 둥근 지붕이라 파도가 아니라 언덕으로 보인다. 위쪽 능선이 앞으로 쏠리고 끝이
 * 아래로 꺾여야 덮치는 물로 읽힌다.
 */
export function waveCrestPoints(width: number, height: number, curl: number): StrokePoint[] {
  const half = width / 2;
  return [
    { x: -half, y: 0 },
    { x: -half * 0.55, y: -height * 0.55 },
    { x: -half * 0.05, y: -height * 0.92 },
    { x: half * 0.45, y: -height },
    { x: half * 0.82, y: -height * 0.78 },
    { x: half, y: -height * 0.42 },
    // 앞 끝이 안으로 말린다.
    { x: half - curl * 0.35, y: -height * 0.18 },
    { x: half - curl, y: -height * 0.34 },
    { x: half - curl * 1.4, y: -height * 0.12 },
    { x: half * 0.35, y: 0 },
  ];
}

/** 바닥에 누운 마름모 한 겹. 정원을 그리면 캐릭터 앞에 세운 고리로 보인다. */
export function flatDiamondPoints(radius: number, squash: number): StrokePoint[] {
  return [{ x: 0, y: -radius * squash }, { x: radius, y: 0 }, { x: 0, y: radius * squash }, { x: -radius, y: 0 }];
}

/**
 * 맞물리는 턱 한 줄의 외곽선.
 *
 * `side`가 -1이면 위턱(아래로 내려오는 이빨), 1이면 아래턱이다. 톱니의 뿌리는 붙어 있고
 * 끝만 갈라져야 이빨이지, 삼각형을 늘어놓으면 톱날이 된다.
 */
export function mawTeeth(halfWidth: number, depth: number, teeth: number, side: -1 | 1): StrokePoint[] {
  const points: StrokePoint[] = [{ x: -halfWidth, y: 0 }];
  const stride = (halfWidth * 2) / teeth;
  for (let index = 0; index < teeth; index += 1) {
    const left = -halfWidth + stride * index;
    points.push({ x: left + stride / 2, y: depth * side });
    points.push({ x: left + stride, y: 0 });
  }
  return points;
}

/** 뿌리에서 끝으로 갈수록 가늘어지는 곧은 획. 채찍과 달리 휘지 않아 벤 자국으로 읽힌다. */
export function slashPoints(
  origin: StrokePoint,
  angleDeg: number,
  length: number,
  rootWidth: number,
  tipWidth: number,
): StrokePoint[] {
  const angle = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const root = { x: origin.x - dx * length / 2, y: origin.y - dy * length / 2 };
  const tip = { x: origin.x + dx * length / 2, y: origin.y + dy * length / 2 };
  return [
    { x: root.x + nx * rootWidth / 2, y: root.y + ny * rootWidth / 2 },
    { x: tip.x + nx * tipWidth / 2, y: tip.y + ny * tipWidth / 2 },
    { x: tip.x - nx * tipWidth / 2, y: tip.y - ny * tipWidth / 2 },
    { x: root.x - nx * rootWidth / 2, y: root.y - ny * rootWidth / 2 },
  ];
}

/**
 * 먹이 번진 자국.
 *
 * 정원으로 그리면 물방울이라 획이 되지 않는다. 반지름을 마디마다 흔들어 가장자리를 일부러
 * 고르지 않게 만든다. 흔들림은 각도에서만 나오므로 같은 인자면 같은 모양이다 — 매 프레임
 * 다시 흔들리면 얼룩이 끓어 보인다.
 */
export function inkBlotPoints(origin: StrokePoint, radius: number, segments = 12): StrokePoint[] {
  const points: StrokePoint[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    // 두 배수의 사인을 겹쳐 주기가 서로 어긋나게 만든다. 한 겹이면 규칙적인 꽃 모양이 된다.
    const wobble = 1 + Math.sin(angle * 3) * 0.14 + Math.sin(angle * 5 + 1.2) * 0.08;
    points.push({ x: origin.x + Math.cos(angle) * radius * wobble, y: origin.y + Math.sin(angle) * radius * wobble * 0.82 });
  }
  return points;
}
