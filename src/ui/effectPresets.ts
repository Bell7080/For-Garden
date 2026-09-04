/**
 * 이펙트 한 방의 **순수 배치표**.
 *
 * 파편 수·속도·수명·파문 크기를 전부 여기서만 정한다. 씬이나 매니저가 값을 눈대중으로 고치면
 * 같은 종류의 타격이 화면마다 다른 무게로 터진다.
 *
 * 두 가지 결을 나눈다.
 * - **전장(`basic`~`death`)**: 단순한 SD가 뚜따시하는 화면이라, 잔뜩 흩뿌리지 않고 **몇 조각이
 *   크게 팡 터졌다가 곧 사라진다.** 파편은 원이 아니라 **마름모**이고 중력은 거의 없다 —
 *   위에서 아래로 떨어지는 불꽃놀이는 위에서 내려다보는 난전과 방향이 맞지 않는다.
 * - **화면 조작(`tap`)**: 근미래 홀로그램 장비를 누른 손맛이다. 파편을 뿌리지 않고 **얇은
 *   마름모 파문 한 겹**만 빠르게 벌어졌다 꺼진다.
 */

/** 매니저가 여는 이펙트의 종류. 캐릭터 슬롯 넷과 전투 사건, 화면 조작이 전부다. */
export type EffectKind =
  | "basic"
  | "ultimate"
  | "passive"
  | "fever"
  | "heal"
  | "shield"
  | "death"
  /** 메뉴에서 화면을 누른 자리. 근미래 홀로그램 장비의 결이다. */
  | "tap"
  /** 전장에서 화면을 누른 자리. 같은 조작이라도 전장에서는 작게 튀는 결로 답한다. */
  | "tapBattle";

export interface BurstSpec {
  /** 튀어 나가는 마름모 파편 수. 한 자리 수를 넘기지 않는다. */
  shards: number;
  /** 파편의 초당 이동 속도 범위(px). */
  speed: readonly [number, number];
  /**
   * 아래로 끌어당기는 힘.
   *
   * 0에 가깝게 둔다. 중력이 세면 파편이 발밑으로 쏟아져 "터졌다"가 아니라 "흘렸다"로 보인다.
   */
  gravity: number;
  /** 파편 수명 범위(ms). */
  life: readonly [number, number];
  /** 파편의 시작 배율. 수명 동안 0까지 줄어들며 사라지므로 잔해가 남지 않는다. */
  shardScale: number;
  /** 마름모 파문 겹 수. 0이면 파문 없이 파편만 튄다. */
  rings: number;
  /** 파문이 벌어지는 최대 반지름(px). */
  ringRadius: number;
  /** 파문이 벌어져 꺼지기까지의 시간(ms). */
  ringMs: number;
  /** 파문 선 두께. */
  ringWidth: number;
  /** 가운데 섬광의 지름(px). 0이면 섬광 없이 파문만 남는다. */
  flash: number;
  /**
   * 섬광의 진하기.
   *
   * 낮게 잡는다. 겹쳐 밝아지는 합성이라 진하게 두면 밝은 배경 원화 위에서 하얗게 뭉개져
   * 정작 봐야 할 SD와 피해 숫자가 그 속에 묻힌다. **예쁜 캐릭터를 가리는 순간 이펙트는
   * 타격감이 아니라 방해다** — 잦은 일반 공격일수록 더 옅게 둔다.
   */
  flashAlpha: number;
  /** 섬광이 꺼지는 시간(ms). */
  flashMs: number;
  /** 파편이 회전하는 초당 각도. 마름모라 돌면 반짝이는 것처럼 보인다. */
  spin: number;
}

/**
 * 종류별 한 방.
 *
 * 일반 공격은 작고 잦으므로 가장 얇고, 궁극기만 파문 두 겹에 큰 섬광을 쓴다. 셋 이상이
 * 같은 무게로 터지면 어느 것이 큰 기술인지 읽히지 않는다.
 */
export const EFFECT_PRESETS: Record<EffectKind, BurstSpec> = {
  basic: {
    shards: 5, speed: [260, 460], gravity: 90, life: [220, 340], shardScale: 0.85,
    rings: 1, ringRadius: 74, ringMs: 240, ringWidth: 5, flash: 38, flashAlpha: 0.3, flashMs: 150, spin: 260,
  },
  ultimate: {
    shards: 9, speed: [420, 780], gravity: 40, life: [360, 560], shardScale: 1.5,
    rings: 2, ringRadius: 216, ringMs: 420, ringWidth: 11, flash: 140, flashAlpha: 0.55, flashMs: 300, spin: 200,
  },
  passive: {
    // 패시브는 스스로 발동하는 조용한 효과라 파문 없이 위로 떠오르는 파편 몇 조각뿐이다.
    shards: 4, speed: [120, 220], gravity: -150, life: [420, 620], shardScale: 0.7,
    rings: 0, ringRadius: 0, ringMs: 0, ringWidth: 0, flash: 36, flashAlpha: 0.42, flashMs: 260, spin: 140,
  },
  fever: {
    // 폭주는 몸에서 바깥으로 밀려나는 한 겹이다. 파편은 크고 느리게 벌어진다.
    shards: 7, speed: [300, 520], gravity: -60, life: [400, 620], shardScale: 1.2,
    rings: 1, ringRadius: 168, ringMs: 380, ringWidth: 9, flash: 96, flashAlpha: 0.42, flashMs: 320, spin: 180,
  },
  heal: {
    shards: 5, speed: [90, 190], gravity: -260, life: [520, 760], shardScale: 0.72,
    rings: 0, ringRadius: 0, ringMs: 0, ringWidth: 0, flash: 44, flashAlpha: 0.45, flashMs: 280, spin: 120,
  },
  shield: {
    // 보호막은 흩어지지 않는다. 파편 없이 파문 한 겹만 몸을 감싸듯 벌어졌다 닫힌다.
    shards: 0, speed: [0, 0], gravity: 0, life: [0, 0], shardScale: 0,
    rings: 1, ringRadius: 116, ringMs: 340, ringWidth: 8, flash: 60, flashAlpha: 0.5, flashMs: 240, spin: 0,
  },
  death: {
    shards: 8, speed: [220, 480], gravity: -110, life: [420, 700], shardScale: 1.05,
    rings: 1, ringRadius: 138, ringMs: 340, ringWidth: 7, flash: 80, flashAlpha: 0.42, flashMs: 260, spin: 300,
  },
  tap: {
    // 홀로그램 장비를 누른 자리. 파편을 뿌리지 않고 얇은 파문 한 겹만 빠르게 지나간다.
    shards: 0, speed: [0, 0], gravity: 0, life: [0, 0], shardScale: 0,
    rings: 1, ringRadius: 92, ringMs: 320, ringWidth: 6, flash: 40, flashAlpha: 0.6, flashMs: 190, spin: 0,
  },
  tapBattle: {
    // 전장은 단순한 SD가 뚜따시하는 화면이라 조작도 작게 톡 튄다. 파문 없이 조각 셋뿐이다.
    shards: 3, speed: [140, 260], gravity: -80, life: [200, 300], shardScale: 0.42,
    rings: 0, ringRadius: 0, ringMs: 0, ringWidth: 0, flash: 30, flashAlpha: 0.45, flashMs: 150, spin: 320,
  },
};

/**
 * 화면을 누른 자리의 색.
 *
 * 홀로그램 장비를 누른 손맛이라 **푸른빛**이다. 금색은 이 게임에서 재화·보상·강조를 뜻하므로,
 * 아무 데나 눌러도 뜨는 조작 반응에 같은 색을 쓰면 "눌렀다"와 "받았다"가 섞여 읽힌다.
 */
export const EFFECT_TAP_COLOR = 0x59d9ff;

/**
 * 한 프레임·한 자리에 이펙트가 몰리지 않게 하는 예산.
 *
 * 난전은 여섯이 동시에 때리므로, 막지 않으면 한 프레임에 열 번 넘게 터져 프레임이 떨어지고
 * 화면도 하얗게 뭉갠다. **정한 수만 터뜨리고 나머지는 조용히 버린다** — 놓친 한 방보다
 * 끊긴 프레임이 훨씬 크게 보인다.
 */
export const EFFECT_BUDGET = {
  /** 한 프레임에 여는 최대 이펙트 수. */
  perFrame: 3,
  /** 같은 종류를 다시 여는 최소 간격(ms). 궁극기·폭주처럼 드문 것은 막지 않는다. */
  minGapMs: { basic: 45, heal: 90, shield: 90, passive: 120, tap: 40, tapBattle: 40, ultimate: 0, fever: 0, death: 0 } as Record<EffectKind, number>,
  /** 살아 있는 파문의 상한. 넘으면 가장 오래된 것을 즉시 회수한다. */
  maxRings: 14,
  /** 살아 있는 수치 글자의 상한. */
  maxNumbers: 26,
} as const;

/** 이번 프레임에 이 이펙트를 실제로 열지 정한다. 순수 판정이라 테스트가 그대로 고정한다. */
export function allowBurst(
  kind: EffectKind,
  now: number,
  lastAt: number | undefined,
  openedThisFrame: number,
): boolean {
  if (openedThisFrame >= EFFECT_BUDGET.perFrame) return false;
  const gap = EFFECT_BUDGET.minGapMs[kind];
  if (gap <= 0 || lastAt === undefined) return true;
  return now - lastAt >= gap;
}

/**
 * 광역 공격이 터진 자리의 **바닥 표시**.
 *
 * 위에서 비스듬히 내려다보는 전장이라 범위는 정원이 아니라 **납작하게 눌린 마름모**다.
 * 원을 그대로 그리면 바닥에 누운 것이 아니라 캐릭터 앞에 세워 둔 고리처럼 보인다.
 *
 * 발밑에 깔리므로 SD보다 뒤에 그리고, 진하기는 배경 원화가 그대로 비칠 만큼만 둔다 —
 * 여기서 진해지면 정작 봐야 할 SD와 수치가 색판 위에 뜬 것처럼 읽힌다.
 */
export const AREA_IMPACT = {
  /** 세로를 가로의 몇 배로 누를지. 바닥에 누운 원의 원근이다. */
  squash: 0.42,
  /** 처음 벌어지기 시작하는 배율. 0에서 자라면 점이 커지는 것처럼 보인다. */
  growFrom: 0.55,
  /** 벌어져 꺼지기까지의 시간(ms). */
  ms: 380,
  /** 궁극기 범위는 조금 더 오래 남아 무엇이 컸는지 알린다. */
  ultimateMs: 520,
  /** 안쪽을 채우는 진하기. */
  fillAlpha: 0.16,
  /** 테두리 선의 두께와 진하기. */
  lineWidth: 5,
  lineAlpha: 0.75,
} as const;

/**
 * 멀리서 때리는 타격이 **가는 길**.
 *
 * 사거리를 나눈 뒤로 중·원거리 개체는 떨어진 자리에서 때리는데, 화면에는 맞은 쪽에서만
 * 파편이 터져 **누가 쳤는지도, 무엇이 날아갔는지도 보이지 않았다.** 근거리는 몸이 붙어
 * 있어 그 자체가 답이지만, 떨어져 있으면 사이를 잇는 것이 없으면 그냥 숫자만 뜬다.
 *
 * 두 결을 나눈다.
 * - **중거리(`lash`)**: 채찍처럼 **한 번에 뻗었다 걷힌다.** 날아가는 물체가 아니라 이미
 *   닿아 있는 선이라, 자라나지 않고 처음부터 끝까지 이어진 채 끝에서 얇아지며 사라진다.
 * - **원거리(`bullet`)**: 탄환이 **실제로 날아간다.** 피해는 이미 확정됐으므로 연출은
 *   숫자가 뜨는 순간과 어긋나지 않게 짧아야 한다.
 *
 * 값은 여기 한 표에만 있고 씬은 "누가 누구를 어떤 사거리로 쳤는지"만 넘긴다.
 */
export const REACH_STRIKE = {
  lash: {
    /** 뿌리 쪽 두께(px). 끝으로 갈수록 가늘어져 휘두른 방향이 읽힌다. */
    rootWidth: 15,
    /** 끝 쪽 두께(px). 0으로 두면 뾰족한 삼각형이 되어 채찍이 아니라 창처럼 보인다. */
    tipWidth: 4,
    /**
     * 채찍이 **길의 몇 할 지점부터** 시작하는지.
     *
     * 두 자리를 통째로 잇는 리본은 중거리 적과 원거리 아군이 맞붙으면 화면을 가로질러
     * 그 사이의 탄환을 통째로 덮는다. 휘두르는 쪽이 아니라 **닿는 쪽 끝**만 그리면 같은
     * 동작이 남으면서 길 가운데가 비어, 날아가는 것이 그 위로 보인다. 뿌리가 두껍고 끝이
     * 가는 형태 자체가 이미 방향을 말하므로 누가 쳤는지도 흐려지지 않는다.
     */
    startAt: 0.34,
    /**
     * 가운데가 휘는 정도(길이 대비).
     *
     * 곧은 선은 채찍이 아니라 레이저다. 진행 방향의 수직으로 살짝 밀어 한 번 휜 자국을 만든다.
     */
    bend: 0.13,
    /** 뻗었다 걷히기까지(ms). 다음 평타보다 반드시 짧아야 잔상이 겹치지 않는다. */
    ms: 130,
    /** 가장 진할 때의 알파. 겹쳐 밝아지는 합성이라 낮게 둔다. */
    alpha: 0.66,
  },
  bullet: {
    /**
     * 탄환 한 알의 길이·두께(px). 마름모 한 조각이라 나는 방향으로 길게 눕는다.
     *
     * 두께는 반드시 채찍의 뿌리보다 두껍다 — 얇으면 같은 길 위에서 채찍에 통째로 묻힌다.
     */
    length: 50,
    thickness: 18,
    /** 날아가는 시간(ms). 거리와 무관하게 고정이라 먼 적일수록 빨라 보인다. */
    ms: 150,
    /** 지나온 자리에 남는 옅은 꼬리의 길이 배수. */
    trail: 1.9,
    alpha: 0.85,
    /** 살아 있는 탄환의 상한. 넘으면 가장 오래된 것을 즉시 회수한다. */
    maxLive: 10,
    /** 채찍보다 몇 겹 위에 그릴지. 같은 깊이에 두면 나중에 열린 채찍이 탄환을 덮는다. */
    depthLift: 2,
  },
} as const;

/**
 * 유지 효과의 순수한 도형/움직임 배치표다. 색은 캐릭터의 `skillArtTint()`가 정하므로 이곳에
 * 넣지 않으며, 낮은 알파로 기존 폭주 실루엣 필터를 가리지 않는다.
 */
export const SUSTAINED_COMBAT_EFFECT = {
  mette: { alpha: 0.24, lineWidth: 3, halfWidth: 38, spacing: 15, pulseMs: 360 },
  luka: { alpha: 0.2, lineWidth: 2, length: 76, spacing: 14, travelMs: 460 },
} as const;
