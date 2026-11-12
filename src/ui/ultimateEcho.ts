/**
 * 장판형 궁극기가 지나간 자리에 남는 **잔향**의 순수 규칙.
 *
 * 범위 표시(`groundArea`)는 벌어졌다 0.5초 남짓에 꺼진다 — 1배속에서도 짧은데, 배속을 올려 두고
 * 보는 난전에서는 그 사이 다른 타격·숫자가 겹쳐 **궁극기를 썼다는 사실 자체가 지나간다.** 그래서
 * 궁극기 범위만 꺼진 자리에 그 개체의 색으로 한동안 자국을 남긴다. 판정과 무관한 그림이며,
 * 코어의 `areaImpact` 사건(`ultimate: true`)이 싣고 온 모양을 그대로 따른다.
 *
 * 결은 전장의 잉크 결 그대로다 — 먹선으로 쥔 마름모 경계, 그 개체의 **속성 색 면**과 **직군 색 선**
 * (`combatPalette`), 안쪽으로 가라앉는 마름모 두 겹, 바닥에 스민 잉크 자국 몇 점. 동그라미를 쓰지
 * 않고 밝아지는 합성도 쓰지 않는다.
 *
 * **시간은 실제 시간이다**(트윈은 전투 배속을 받지 않는다). 배속을 올려도 자국이 머무는 시간은
 * 같아야 2·3배속에서 "방금 저기 큰 기술이 떨어졌다"가 남는다.
 *
 * Phaser를 들여오지 않는다 — 시간표와 자국 자리를 테스트가 그대로 잰다.
 */

export const ULTIMATE_ECHO = {
  /** 본 범위가 빠지기 시작할 때(`INK_AREA.holdUntil`)부터 잔향이 머무는 실제 시간(ms). */
  ms: 1700,
  /** 본 범위 아래에서 녹아드는 몫(시간표 비율). 톡 나타나면 그 자체가 깜빡임이 된다. */
  fadeInUntil: 0.12,
  /** 이때까지 온전히 머물고 그 뒤로 빠진다. */
  holdUntil: 0.4,
  /** 면의 진하기. 본 범위(0.24)보다 옅다 — 자국이지 다시 터진 범위가 아니다. */
  fillAlpha: 0.13,
  /** 색면 아래 검은 겹. 밝은 바닥 위에서 옅은 색면이 묻히지 않게 한다. */
  backdropAlpha: 0.1,
  /** 경계 먹선. */
  inkWidth: 5,
  inkAlpha: 0.55,
  /** 먹선 위의 직군 색 선. */
  lineWidth: 2.5,
  lineAlpha: 0.85,
  lineLighten: 0.3,
  /** 경계가 끝까지 조금 더 번진다 — 울림이 퍼지는 것처럼. 움직임 줄이기에서는 0이다. */
  edgeDrift: 0.08,
  /** 안쪽으로 가라앉는 마름모 두 겹. 바깥에서 시작해 안으로 줄어들며 사라진다. */
  settle: { rings: 2, from: 0.86, to: 0.3, stagger: 0.22, span: 0.6, width: 3, alpha: 0.7, lighten: 0.45 },
  /** 바닥에 스민 잉크 자국. 난수 없이 번호에서 자리를 정한다. */
  marks: { count: 7, spread: 0.7, size: 0.075, minSize: 9, maxSize: 26, inkWidth: 2.5, alpha: 0.75, lighten: 0.15 },
  /** 전장 전체 기술의 가장자리 워시가 남는 진하기. */
  washAlpha: 0.55,
  /** 동시에 남는 잔향의 상한. 넘치면 가장 오래된 것을 걷는다. 한 개체는 한 자리만 갖는다. */
  max: 6,
} as const;

/** 시간표 한 순간(0~1)의 진하기와 경계 배율. */
export interface UltimateEchoFrame {
  /** 면·선·자국에 곱하는 진하기(0~1). */
  alpha: number;
  /** 경계가 번진 배율(1 이상). */
  edgeScale: number;
  /** 가라앉는 마름모들의 배율과 진하기. 아직 시작하지 않았거나 끝난 겹은 진하기 0이다. */
  settle: { scale: number; alpha: number }[];
}

/**
 * 잔향 한 순간.
 *
 * 녹아들고(`fadeInUntil`) → 머물고(`holdUntil`) → 끝을 향해 서서히 빠진다. 빠지는 쪽은 제곱으로
 * 굽혀 처음엔 천천히, 끝에서 급히 사라진다 — 선형이면 머무는 동안에도 계속 옅어져 눈에 남지 않는다.
 */
export function ultimateEchoFrame(t: number, distanceFactor = 1): UltimateEchoFrame {
  const time = Math.min(1, Math.max(0, t));
  const rise = Math.min(1, time / ULTIMATE_ECHO.fadeInUntil);
  const fall = time <= ULTIMATE_ECHO.holdUntil ? 1 : 1 - ((time - ULTIMATE_ECHO.holdUntil) / (1 - ULTIMATE_ECHO.holdUntil)) ** 2;
  const alpha = Math.max(0, rise * fall);
  const spec = ULTIMATE_ECHO.settle;
  const settle = Array.from({ length: spec.rings }, (_, index) => {
    const local = (time - index * spec.stagger) / spec.span;
    if (local <= 0 || local >= 1) return { scale: spec.from, alpha: 0 };
    // 줄어드는 거리만 움직임 줄이기를 받는다 — 진하기는 그대로라 겹 자체는 남는다.
    const shrink = (spec.from - spec.to) * (1 - (1 - local) ** 2) * distanceFactor;
    return { scale: spec.from - shrink, alpha: spec.alpha * Math.sin(local * Math.PI) * fall };
  });
  return { alpha, edgeScale: 1 + ULTIMATE_ECHO.edgeDrift * distanceFactor * time, settle };
}

export interface EchoPoint { x: number; y: number }

/** 잉크 자국 하나. 크기는 픽셀이다. */
export interface EchoMark extends EchoPoint { size: number; angle: number }

/** 황금각. 번호만으로 고르게 흩어 놓는다(난수 없이 같은 기술은 늘 같은 자국을 남긴다). */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * 원 범위 안의 잉크 자국 자리(중심 기준 국소 좌표). 세로는 바닥 원근(`squash`)만큼 누른다.
 */
export function radialEchoMarks(radius: number, squash: number): EchoMark[] {
  const spec = ULTIMATE_ECHO.marks;
  const size = Math.min(spec.maxSize, Math.max(spec.minSize, radius * spec.size));
  return Array.from({ length: spec.count }, (_, index) => {
    // 가운데를 비우지 않도록 반지름은 제곱근으로 고르게 편다.
    const reach = radius * spec.spread * Math.sqrt((index + 0.5) / spec.count);
    const angle = index * GOLDEN_ANGLE;
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * squash, size: size * (0.7 + 0.3 * ((index * 7) % 5) / 4), angle };
  });
}

/**
 * 통로 위의 잉크 자국 자리(월드 좌표). 길을 따라 고르게 놓고 좌우로 번갈아 비킨다.
 */
export function laneEchoMarks(from: EchoPoint, to: EchoPoint, halfWidth: number, squash: number): EchoMark[] {
  const spec = ULTIMATE_ECHO.marks;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-3) return radialEchoMarks(halfWidth, squash).map((mark) => ({ ...mark, x: from.x + mark.x, y: from.y + mark.y }));
  const ux = dx / length;
  const uy = dy / length;
  const size = Math.min(spec.maxSize, Math.max(spec.minSize, halfWidth * spec.size * 2));
  return Array.from({ length: spec.count }, (_, index) => {
    const along = (index + 0.5) / spec.count;
    const side = (index % 2 === 0 ? 1 : -1) * halfWidth * spec.spread * (0.35 + 0.65 * ((index * 3) % 4) / 3);
    return {
      x: from.x + dx * along - uy * side,
      y: from.y + dy * along + ux * side * squash,
      size: size * (0.7 + 0.3 * ((index * 7) % 5) / 4),
      angle: Math.atan2(dy, dx) + index * 0.9,
    };
  });
}

/**
 * 잉크 자국 하나의 윤곽 — 좌우 꼭짓점 높이를 어긋나게 깎은 마름모(정확한 대칭은 보석처럼 보인다).
 * 바닥에 누운 자국이라 세로를 누른다.
 */
export function echoMarkPoints(mark: EchoMark, squash: number): EchoPoint[] {
  const cos = Math.cos(mark.angle);
  const sin = Math.sin(mark.angle);
  const local: EchoPoint[] = [
    { x: 0, y: -mark.size * 0.55 },
    { x: mark.size, y: -mark.size * 0.12 },
    { x: 0, y: mark.size * 0.5 },
    { x: -mark.size * 0.82, y: mark.size * 0.08 },
  ];
  return local.map((point) => ({
    x: mark.x + point.x * cos - point.y * sin,
    y: mark.y + (point.x * sin + point.y * cos) * squash,
  }));
}
