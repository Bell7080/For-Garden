/**
 * 소탕 연출의 자리와 박자 — Phaser를 모르는 순수 표.
 *
 * 소탕은 전투를 치르지 않지만 곧바로 영수증이 뜨면 「무엇을 했는지」가 사라진다. 그래서 영수증
 * 앞에 **지층 띠 한 장**이 스윽 올라와, 그 안에서 애착 렐릭이 그 단계의 적과 투다다닥 주고받고
 * 마지막 한 방에 적이 쓰러진 뒤 띠가 걷히며 보상으로 넘어간다. 한 판을 대신하는 몸짓이라
 * **짧다** — 2초 남짓이고, 화면을 누르면 곧바로 끝난다(서버 응답이 오기 전이면 그때까지만 기다린다).
 *
 * 좌표는 화면 가운데 기준이다. 박자는 난수 없이 늘 같은 순서를 돈다 — 같은 소탕이 늘 같은 그림을
 * 그린다(`tests/unit/sweepSkirmish.test.ts`).
 */
export const SWEEP_SKIRMISH = {
  /** 띠 — 발굴의 지층처럼 흙빛 층이 겹친 가로 판. */
  band: { width: 1000, height: 480, bevel: 34 },
  /** 띠 안의 지층. 위에서부터 차례로 쌓이며 비율의 합은 1이다. */
  strata: [
    { ratio: 0.64, color: 0x1a2330, alpha: 0.94 },
    { ratio: 0.14, color: 0x3a2c20, alpha: 0.96 },
    { ratio: 0.12, color: 0x2e241b, alpha: 0.97 },
    { ratio: 0.1, color: 0x221b15, alpha: 0.98 },
  ],
  /** 발이 서는 선(띠 가운데 기준) — 첫 지층의 밑변과 같다. */
  groundY: 0.64 * 480 - 240,
  hero: { x: -230 },
  enemy: { x: 230 },
  sdHeight: 250,
  /** 공격할 때 앞으로 내딛는 거리와 한 번의 왕복 시간. */
  lunge: { distance: 110, ms: 120 },
  /** 들어오는 시간과 들어온 뒤 첫 박자까지. */
  enterMs: 320,
  settleMs: 180,
  /** 주고받는 박자 사이. */
  beatMs: 270,
  /** 쓰러진 뒤 띠가 걷히기 전까지. */
  afterMs: 420,
  exitMs: 260,
  /** SD가 늦게 도착해도 이만큼만 기다리고 시작한다 — 연출이 영수증을 붙잡지 않는다. */
  spawnWaitMs: 700,
  /** 맞은 자리의 마름모 불꽃. */
  spark: { size: 70, ms: 240 },
  /** 배율 표식(×N). 띠 오른쪽 위. */
  count: { x: 440, y: -196, size: 40 },
} as const;

export type SweepSkirmishAttacker = "hero" | "enemy";

export interface SweepSkirmishBeat {
  /** 첫 박자로부터의 시각. */
  atMs: number;
  attacker: SweepSkirmishAttacker;
  /** 마지막 한 방 — 적이 쓰러진다. */
  finisher: boolean;
}

/**
 * 주고받는 박자. 애착 렐릭이 먼저 두 번 치고, 적이 한 번 받아친 뒤, 다시 연달아 몰아쳐 끝낸다 —
 * 「투다다닥」이 읽히도록 끝으로 갈수록 박자가 짧아진다.
 */
export function sweepSkirmishBeats(): SweepSkirmishBeat[] {
  const order: SweepSkirmishAttacker[] = ["hero", "hero", "enemy", "hero", "hero", "hero"];
  const beats: SweepSkirmishBeat[] = [];
  let at = 0;
  order.forEach((attacker, index) => {
    beats.push({ atMs: at, attacker, finisher: index === order.length - 1 });
    // 뒤 세 번은 몰아치는 박자라 간격이 줄어든다.
    at += index >= 3 ? Math.round(SWEEP_SKIRMISH.beatMs * 0.62) : SWEEP_SKIRMISH.beatMs;
  });
  return beats;
}

/** 첫 박자부터 띠가 다 걷히기까지. */
export function sweepSkirmishDurationMs(): number {
  const beats = sweepSkirmishBeats();
  const last = beats[beats.length - 1]?.atMs ?? 0;
  return SWEEP_SKIRMISH.enterMs + SWEEP_SKIRMISH.settleMs + last + SWEEP_SKIRMISH.afterMs + SWEEP_SKIRMISH.exitMs;
}

/**
 * 띠 한 층의 도형(평평한 좌표 배열). 띠는 왼쪽 위와 오른쪽 아래가 깎인 칩이라, 층을 네모로 칠하면
 * 깎인 모서리 밖으로 흙이 새어 나간다 — 층마다 띠의 빗변을 그대로 따라 자른다.
 */
export function sweepBandSlab(top: number, bottom: number): number[] {
  const { width, height, bevel } = SWEEP_SKIRMISH.band;
  const w = width / 2;
  const h = height / 2;
  const leftX = (y: number): number => (y < -h + bevel ? -w + (-h + bevel - y) : -w);
  const rightX = (y: number): number => (y > h - bevel ? w - (y - (h - bevel)) : w);
  const ys = (limit: number): number[] => [top, ...(limit > top && limit < bottom ? [limit] : []), bottom];
  const right = ys(h - bevel).map((y) => [rightX(y), y]);
  const left = ys(-h + bevel).reverse().map((y) => [leftX(y), y]);
  return [...right, ...left].flat();
}
