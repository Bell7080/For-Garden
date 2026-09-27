/**
 * 소탕 연출의 자리와 박자 — Phaser를 모르는 순수 표.
 *
 * 소탕은 전투를 치르지 않지만 곧바로 영수증이 뜨면 「무엇을 했는지」가 사라진다. 그래서 영수증
 * 앞에 **그 콘텐츠의 전장을 깐 가로 띠 한 장**이 스윽 올라와 한 판을 짧은 만화처럼 대신한다:
 *
 * 1. 애착 렐릭과 대표 적이 몇 번 주고받는다(맞을 때마다 **보상 아이콘이 곡사로 튀어나온다**).
 * 2. 둘이 한데 엉겨 **먼지구름 속에서 투닥투닥** — 구름 둘레로 불꽃이 톡톡 튄다.
 * 3. 구름에서 튕겨 나와 몰아치고, 마지막 한 방에 적이 **날아가 별이 된다**.
 * 4. 애착 렐릭이 **뿅뿅 뛰며** 이긴 것을 알리고,
 * 5. 바닥에 떨어진 보상이 **스르륵 한가운데로 모여** 띠가 걷히며 영수증으로 넘어간다.
 *
 * 화면을 누르면 곧바로 끝난다(서버 응답이 오기 전이면 그때까지만 기다린다). 좌표는 화면 가운데
 * 기준이다. 박자와 전리품의 궤적은 **난수 없이** 늘 같다 — 같은 소탕이 늘 같은 그림을 그린다
 * (`tests/unit/sweepSkirmish.test.ts`).
 */
export const SWEEP_SKIRMISH = {
  /** 띠 — 전장 원화 위에 흙빛 층을 옅게 겹친 가로 판. */
  band: { width: 1000, height: 480, bevel: 34 },
  /**
   * 띠 안의 지층. 위에서부터 차례로 쌓이며 비율의 합은 1이다. **전장 원화가 비치도록** 옅게 깐다 —
   * 하늘 층은 거의 투명하고, 발밑 흙만 조금 짙게 눌러 SD가 선 자리를 받친다.
   */
  strata: [
    { ratio: 0.64, color: 0x1a2330, alpha: 0.04 },
    { ratio: 0.14, color: 0x3a2c20, alpha: 0.2 },
    { ratio: 0.12, color: 0x2e241b, alpha: 0.28 },
    { ratio: 0.1, color: 0x221b15, alpha: 0.36 },
  ],
  /**
   * 어둠의 세기 — **전장이 밝게 비쳐야 한다.** 뒤 화면 암전·원화 위 청흑색 누름·띠 가장자리 누르기를
   * 한 표에 모은다. 셋을 모두 진하게 두었을 때는 띠 안의 전장까지 거의 검게 가라앉아, 배경을 깐
   * 뜻이 사라졌다.
   */
  dimAlpha: 0.5,
  fieldOverlay: 0.1,
  vignette: 0.22,
  /** 발이 서는 선(띠 가운데 기준) — 첫 지층의 밑변과 같다. */
  groundY: 0.64 * 480 - 240,
  hero: { x: -230 },
  enemy: { x: 230 },
  sdHeight: 250,
  /** 공격할 때 앞으로 내딛는 거리와 한 번의 왕복 시간. 내딛는 순간 폴짝 뜬다. */
  lunge: { distance: 110, ms: 130, hop: 26 },
  /** 들어오는 시간과 들어온 뒤 첫 박자까지. */
  enterMs: 360,
  settleMs: 220,
  /** 주고받는 박자 사이. */
  beatMs: 280,
  /** 몰아칠 때의 박자 사이. */
  rushMs: 190,
  /** 먼지구름 속 투닥투닥 — 두 몸이 가운데로 모여 이만큼 엉긴다. */
  scuffle: { ms: 1100, gap: 46, popEveryMs: 120, puffs: 8, cloudWidth: 330, cloudHeight: 170, jitter: 12 },
  /** 마지막 한 방에 날아가 별이 된다. 끝점은 띠 가운데 기준(띠 위 하늘로 나간다). */
  blastOff: { flyMs: 720, toX: 420, toY: -470, spins: 2.5, endScale: 0.12, twinkleSize: 46, twinkleMs: 460 },
  /** 이기고 뿅뿅. */
  victory: { hops: 3, hopMs: 300, height: 64, delayMs: 160 },
  /** 바닥에 떨어진 보상이 모이는 시간과, 한 조각씩 어긋나는 간격. 모이는 자리는 띠 가운데 위쪽이다. */
  settle: { ms: 560, staggerMs: 28, toY: -60 },
  exitMs: 300,
  /** SD가 늦게 도착해도 이만큼만 기다리고 시작한다 — 연출이 영수증을 붙잡지 않는다. */
  spawnWaitMs: 700,
  /** 맞은 자리의 마름모 불꽃. */
  spark: { size: 70, ms: 240 },
  /** 먼지 한 뭉치. 흙빛으로 물들인 부드러운 덩어리를 옆으로 눌러 쓴다. */
  dust: { color: 0xd8c3a0, alpha: 0.5, size: 120, ms: 520, rise: 36 },
  /**
   * 튀어나오는 보상 아이콘. 크고 작은 둘을 섞고(`big`·`small`), 곡사의 꼭짓점 높이와 떨어지는 자리는
   * 조각 번호에서 정해진다. 너무 많이 흩뿌리지 않도록 한 판의 상한을 둔다.
   */
  loot: { big: 74, small: 46, flightMs: 620, peak: 190, spread: 300, maxPieces: 26, perHit: 2, perPop: 1, finisher: 7, bounce: 16 },
  /** 배율 표식(×N). 띠 오른쪽 위. */
  count: { x: 440, y: -196, size: 40 },
} as const;

export type SweepSkirmishAttacker = "hero" | "enemy";

export interface SweepSkirmishBeat {
  /** 싸움이 시작한 순간(첫 박자)으로부터의 시각. */
  atMs: number;
  attacker: SweepSkirmishAttacker;
  /** 마지막 한 방 — 적이 날아가 별이 된다. */
  finisher: boolean;
}

/** 한 판의 시간표. 모든 시각은 첫 박자로부터다. */
export interface SweepSkirmishTimeline {
  beats: SweepSkirmishBeat[];
  scuffle: { startMs: number; endMs: number; pops: number[] };
  blastOff: { startMs: number; twinkleAtMs: number };
  victory: { startMs: number; endMs: number };
  settle: { startMs: number; endMs: number };
  /** 띠가 걷히기 시작하는 시각. */
  endMs: number;
}

/**
 * 한 판의 시간표. 주고받기(적도 한 번은 받아친다) → 먼지구름 → 몰아치기 → 날려 보내기 → 뿅뿅 → 정산.
 * 「투다다닥」이 읽히도록 구름 뒤의 박자는 앞보다 짧다.
 */
export function sweepSkirmishTimeline(): SweepSkirmishTimeline {
  const L = SWEEP_SKIRMISH;
  const beats: SweepSkirmishBeat[] = [];
  let at = 0;
  for (const attacker of ["hero", "hero", "enemy", "hero"] as const) {
    beats.push({ atMs: at, attacker, finisher: false });
    at += L.beatMs;
  }
  const scuffleStart = at;
  const scuffleEnd = scuffleStart + L.scuffle.ms;
  const pops: number[] = [];
  for (let pop = scuffleStart + L.scuffle.popEveryMs; pop < scuffleEnd - L.scuffle.popEveryMs / 2; pop += L.scuffle.popEveryMs) pops.push(pop);
  at = scuffleEnd + L.beatMs;
  const rush = ["hero", "enemy", "hero", "hero"] as const;
  rush.forEach((attacker, index) => {
    beats.push({ atMs: at, attacker, finisher: index === rush.length - 1 });
    if (index < rush.length - 1) at += L.rushMs;
  });
  // 마지막 한 방이 닿는 순간(내딛는 왕복의 끝 무렵)에 날아간다.
  const blastStart = at + Math.round(L.lunge.ms * 0.8);
  const twinkleAt = blastStart + L.blastOff.flyMs;
  const victoryStart = twinkleAt + L.victory.delayMs;
  const victoryEnd = victoryStart + L.victory.hops * L.victory.hopMs;
  const settleStart = victoryEnd;
  const settleEnd = settleStart + L.settle.ms + L.loot.maxPieces * L.settle.staggerMs / 2;
  return {
    beats,
    scuffle: { startMs: scuffleStart, endMs: scuffleEnd, pops },
    blastOff: { startMs: blastStart, twinkleAtMs: twinkleAt },
    victory: { startMs: victoryStart, endMs: victoryEnd },
    settle: { startMs: settleStart, endMs: settleEnd },
    endMs: settleEnd,
  };
}

/** 주고받는 박자만 — 시간표의 `beats`와 같다. */
export function sweepSkirmishBeats(): SweepSkirmishBeat[] {
  return sweepSkirmishTimeline().beats;
}

/** 띠가 올라오기 시작해 다 걷히기까지. */
export function sweepSkirmishDurationMs(): number {
  const L = SWEEP_SKIRMISH;
  return L.enterMs + L.settleMs + sweepSkirmishTimeline().endMs + L.exitMs;
}

/** 전리품 한 조각의 궤적. 좌표는 띠 가운데 기준, 튀어나오는 자리에서의 상대가 아니라 떨어질 자리다. */
export interface SweepLootArc {
  /** 떨어지는 자리(띠 가운데 기준). */
  landX: number;
  landY: number;
  /** 곡사의 꼭짓점이 출발점보다 얼마나 높은가. */
  peak: number;
  big: boolean;
  /** 날아가는 동안 도는 양(라디안). */
  spin: number;
  /** 같은 순간 튀어나온 조각끼리 어긋나는 시간. */
  delayMs: number;
}

/** 황금비 분수 — 난수 없이 번호마다 고르게 흩어지는 0~1 값. */
function spread(index: number, salt: number): number {
  const value = (index + 1) * 0.618033988749895 + salt * 0.414213562;
  return value - Math.floor(value);
}

/**
 * `index`번째 전리품의 궤적. 적 쪽에서 튀어나와 **주로 애착 렐릭 쪽(왼쪽)으로** 흩어져 떨어진다 —
 * 이긴 쪽이 줍는 것으로 읽혀야 한다. 떨어지는 자리는 발이 서는 선 언저리이고 띠 밖으로 나가지 않는다.
 */
export function sweepLootArc(index: number, originX: number): SweepLootArc {
  const L = SWEEP_SKIRMISH;
  const half = L.band.width / 2 - L.band.bevel - L.loot.big / 2;
  const reach = L.loot.spread * (0.35 + 0.65 * spread(index, 1));
  // 네 조각 중 셋은 왼쪽(렐릭 쪽), 하나는 오른쪽으로 짧게 튄다.
  const direction = index % 4 === 3 ? 0.45 : -1;
  const landX = Math.max(-half, Math.min(half, originX + direction * reach));
  const landY = L.groundY + 8 + Math.round(spread(index, 2) * 46);
  return {
    landX,
    landY,
    peak: L.loot.peak * (0.7 + 0.5 * spread(index, 3)),
    big: index % 3 === 0,
    spin: (index % 2 === 0 ? 1 : -1) * Math.PI * (1 + spread(index, 4)),
    delayMs: (index % 3) * 45,
  };
}

/** 곡사 위의 한 점. `t`는 0~1, 출발점에서 떨어지는 자리까지 포물선을 그린다. */
export function sweepLootPoint(fromX: number, fromY: number, arc: SweepLootArc, t: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    x: fromX + (arc.landX - fromX) * clamped,
    y: fromY + (arc.landY - fromY) * clamped - 4 * arc.peak * clamped * (1 - clamped),
  };
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
