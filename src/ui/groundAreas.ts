import { AREA_IMPACT } from "./effectPresets";
import { DAMAGE_FLAVOR_COLOR, INCOMING_DAMAGE_TONE } from "./damageNumbers";
import { UNIT_STATUS_COLOR, type UnitStatusId } from "./unitStatusModel";

/**
 * 바닥에 깔리는 범위 표시의 **순수 규칙**.
 *
 * 광역은 숫자만 여럿 뜨면 왜 셋이 함께 맞았는지 읽히지 않는다. 바닥에 한 겹 깔면 "여기까지가
 * 범위였다"가 한 번에 보인다. 그리는 것은 `EffectManager.groundArea` 하나이고, 무엇을 어떤
 * 색으로 그릴지는 이 파일이 정한다 — 씬이 개체 이름이나 스킬 정의를 다시 읽지 않는다.
 *
 * 규칙은 셋이다.
 *
 * 1. **양식은 하나뿐이다.** 빗금·점선·격자로 종류를 가르지 않는다. 반투명 채움 한 겹과 그
 *    테두리선 한 줄이 전부이고, 모든 범위가 같은 생김새로 선다. 무늬를 섞으면 근미래 홀로그램
 *    이라는 화면 전체의 결이 범위 표시에서만 깨진다.
 * 2. **가르는 것은 색이다.** 무엇에 맞는지(피해 종류)와 누가 깔았는지(아군/적)를 색이 말한다.
 *    축은 피해 수치(`damageNumbers.ts`)와 **정확히 같다** — 우리 편이 맞는 범위는 종류를
 *    가리지 않고 붉은 계열 하나이고, 적에게 들어가는 범위만 종류별 색을 갖는다. 두 곳이 다른
 *    축을 쓰면 같은 타격이 바닥과 숫자에서 다른 색으로 읽힌다.
 * 3. **순간과 지속은 시간이 가른다.** 한 번 터진 자리는 곧 꺼지고 되풀이되는 것은 틱마다 다시
 *    벌어진다. 그 차이가 이미 보이므로 지속형에 별도의 무늬를 주지 않는다.
 */

/** 그릴 범위의 생김새. 판정이 쓰는 모양을 그대로 옮긴다 — 화면이 다른 모양을 그리면 보여 준 범위와 맞은 범위가 갈린다. */
export type GroundAreaShape =
  /** 한 점을 중심으로 퍼지는 원. 바닥에 누운 원근이라 눌린 마름모로 그린다. */
  | { shape: "radial"; x: number; y: number; radius: number }
  /**
   * 뚫고 지나간 통로.
   *
   * 판정은 선분에서 `halfWidth`까지의 최단 거리라 실제 모양은 캡슐이다. 마름모와 같은 결로
   * 두기 위해 양 끝을 뾰족하게 깎은 **늘어난 마름모**(육각형)로 그린다.
   */
  | { shape: "lane"; from: Point; to: Point; halfWidth: number }
  /** 전장 전체. 그릴 경계가 없으므로 마름모가 아니라 화면 가장자리에서 스며드는 워시로 알린다. */
  | { shape: "battlefield" };

export interface Point { x: number; y: number }

/** 어떤 성격의 범위인가. 색은 여기서만 갈린다. */
export interface GroundAreaRequest {
  /**
   * 우리 편이 맞는 범위인가.
   *
   * 적이 깐 범위는 물리·마법·고정을 가리지 않고 붉은 계열 하나로 묶인다. 난전에서 먼저 읽어야
   * 하는 것은 "무엇으로 때리나"가 아니라 **"여기 서 있으면 맞는다"**이기 때문이다.
   */
  hostile: boolean;
  /** 적에게 들어가는 범위의 색을 고른다. 피해가 없는 지원 범위는 비운다. */
  damageType?: "physical" | "magical" | "true";
  /** 아군을 살리는 범위(회복 지정 원). 피해 색 대신 체력 색으로 선다. */
  supportive?: boolean;
  /**
   * 피해가 아니라 **상태를 거는** 범위(스피나의 여울). 그 상태의 머리 위 칩과 같은 색으로 선다.
   *
   * 피해 수치에서 디버프가 받는 쪽에서도 제 색을 지키는 것과 같은 규칙이라 아군 피격보다 먼저
   * 색을 정한다 — 같은 상태가 바닥과 머리 위에서 다른 색이면 무엇이 걸렸는지 두 번 읽어야 한다.
   */
  status?: UnitStatusId;
  /** 궁극기 범위는 조금 더 오래 남아 무엇이 컸는지 알린다. 색은 바꾸지 않는다. */
  ultimate: boolean;
}

/** 씬이 그대로 옮겨 그리는 표시 계약. 여기 없는 값을 화면이 새로 정하지 않는다. */
export interface GroundAreaStyle {
  color: string;
  fillAlpha: number;
  /** 색면 아래에 먼저 까는 검은 겹의 진하기. 밝은 배경 원화 위에서 옅은 색이 묻히지 않게 한다. */
  backdropAlpha: number;
  lineAlpha: number;
  lineWidth: number;
  /** 벌어져 꺼지기까지의 시간(ms). */
  ms: number;
}

/**
 * 우리 편이 맞는 범위의 색.
 *
 * 세기로 짙어지는 피해 수치와 달리 범위는 등급이 없으므로 붉은 계열의 **한 값**만 쓴다.
 * 궁극기라고 더 붉게 하지 않는다 — 그 차이는 남아 있는 시간이 이미 말한다.
 */
export const HOSTILE_AREA_COLOR = INCOMING_DAMAGE_TONE[3];

/** 회복 범위의 색. 체력 게이지·회복 수치와 같은 연두다. */
export const SUPPORTIVE_AREA_COLOR = DAMAGE_FLAVOR_COLOR.heal;

/**
 * 상태를 거는 범위의 색.
 *
 * 머리 위 상태 칩과 **같은 표**를 읽는다 — 여기서 색을 새로 고르면 같은 둔화가 바닥에서는
 * 다른 색으로 번진다.
 */
export function statusAreaColor(status: UnitStatusId): string {
  return `#${UNIT_STATUS_COLOR[status].toString(16).padStart(6, "0")}`;
}

/**
 * 범위 한 겹의 색과 진하기를 정한다.
 *
 * 우선순위는 피해 수치와 같다 — **상태 → 아군 피격 → 지원 → 종류**. 우리 편이 맞는다는 사실이 무엇에
 * 맞는지보다 먼저 읽혀야 한다.
 */
export function groundAreaStyle(request: GroundAreaRequest): GroundAreaStyle {
  const color = request.status
    ? statusAreaColor(request.status)
    : request.hostile
    ? HOSTILE_AREA_COLOR
    : request.supportive
      ? SUPPORTIVE_AREA_COLOR
      // 물리와 마법은 색으로 가르지 않는다(피해 수치와 같은 규칙). 방어를 지나치는 고정 피해만 갈린다.
      : request.damageType === "true" ? DAMAGE_FLAVOR_COLOR.true : DAMAGE_FLAVOR_COLOR.damage;
  return {
    color,
    fillAlpha: AREA_IMPACT.fillAlpha,
    backdropAlpha: AREA_IMPACT.backdropAlpha,
    lineAlpha: AREA_IMPACT.lineAlpha,
    lineWidth: AREA_IMPACT.lineWidth,
    ms: request.ultimate ? AREA_IMPACT.ultimateMs : AREA_IMPACT.ms,
  };
}

/**
 * 바닥에 누운 원 하나.
 *
 * 정원을 그리면 바닥에 누운 것이 아니라 캐릭터 앞에 세워 둔 고리처럼 보이므로 세로를 눌러
 * 마름모로 만든다. 좌표는 중심을 원점으로 한 국소 좌표다.
 */
export function radialAreaPoints(radius: number): Point[] {
  const half = radius * AREA_IMPACT.squash;
  return [{ x: 0, y: -half }, { x: radius, y: 0 }, { x: 0, y: half }, { x: -radius, y: 0 }];
}

/**
 * 통로 하나를 **월드 좌표 그대로** 그린다.
 *
 * 국소 좌표에 그려 두고 컨테이너를 돌리면 눌린 세로까지 함께 돌아가, 비스듬히 달린 돌진의
 * 통로가 바닥에 누운 것으로 보이지 않는다. 그래서 눌림은 **y 성분에만** 적용해 어느 방향으로
 * 달려도 같은 바닥면 위에 눕게 한다.
 *
 * 양 끝은 반폭만큼 더 뻗은 뾰족한 꼭짓점이다 — 판정이 선분에서 잰 거리라 끝점 너머도 반폭까지
 * 맞는데, 네모로 끊으면 그 몫이 그림에서 빠진다.
 */
export function laneAreaPoints(from: Point, to: Point, halfWidth: number): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // 제자리에서 터진 돌진은 방향이 없다 — 통로가 아니라 반폭짜리 원으로 되돌린다.
  if (length < 1e-3) return radialAreaPoints(halfWidth).map((point) => ({ x: from.x + point.x, y: from.y + point.y }));
  const ux = dx / length;
  const uy = dy / length;
  const squash = AREA_IMPACT.squash;
  const axis = { x: ux * halfWidth, y: uy * halfWidth * squash };
  const side = { x: -uy * halfWidth, y: ux * halfWidth * squash };
  return [
    { x: from.x - axis.x, y: from.y - axis.y },
    { x: from.x + side.x, y: from.y + side.y },
    { x: to.x + side.x, y: to.y + side.y },
    { x: to.x + axis.x, y: to.y + axis.y },
    { x: to.x - side.x, y: to.y - side.y },
    { x: from.x - side.x, y: from.y - side.y },
  ];
}

/**
 * 전장 전체를 때리는 기술이 켜는 가장자리 워시.
 *
 * 전장 크기의 마름모를 깔면 화면 대부분이 덮여 정작 봐야 할 SD와 체력 바가 그 속에 묻힌다.
 * "어디까지"가 아니라 **"전부"**를 뜻하는 다른 문법이라, 네 변에서 안쪽으로 스며드는 띠 몇 겹만
 * 세운다. 캔버스 그라데이션은 열 때마다 프레임이 튀므로 **띠를 겹쳐** 계단으로 만든다.
 *
 * 바깥 띠가 가장 진하고 안으로 갈수록 옅어진다. 반환값은 각 띠가 전장 짧은 변의 몇 할까지
 * 파고드는지(`inset`)와 그 진하기 배수(`alpha`)다.
 */
export function battlefieldWashBands(): readonly { inset: number; alpha: number }[] {
  return BATTLEFIELD_WASH.map((ratio, index) => ({
    inset: ratio,
    // 안쪽 띠일수록 옅다. 마지막 띠가 0이 되지 않도록 겹 수가 아니라 겹 수 + 1로 나눈다.
    alpha: (BATTLEFIELD_WASH.length - index) / (BATTLEFIELD_WASH.length + 1),
  }));
}

/** 각 띠가 짧은 변의 몇 할까지 파고드는지. 넷을 넘기면 계단이 보이지 않고 그리는 값만 늘어난다. */
const BATTLEFIELD_WASH: readonly number[] = [0.04, 0.09, 0.15, 0.22];
