/**
 * 실시간 아레나의 **화면 시점**.
 *
 * 두 클라이언트는 같은 canonical 판(서버가 발급한 리스)을 같은 시드로 돌린다 — 상대 시점이라고
 * 코어의 배열·난수 순서를 뒤집으면 화면과 서버 정산이 갈린다. 그래서 뒤집는 것은 **그리는 일뿐**이다:
 * canonical 위쪽(1번 자리, 코어의 `enemy`)에 선 사람의 화면은 전장을 위아래로 거울에 비춰
 * 제 편이 아래에 서고, 제 편의 체력이 아군(초록)으로 읽힌다.
 *
 * 거울은 전장 위아래의 가운데를 축으로 y만 뒤집는다. 거리·방향의 크기가 그대로인 등거리 변환이라
 * 사거리·겹침 같은 읽기 전용 질의는 뒤집힌 값에서도 같은 답을 낸다. 코어를 **진행**시키는 일은
 * 반드시 원래 좌표에서 한다(`BattleScene`이 스텝 앞뒤로 되돌린다).
 */

/** 이 편의 화면이 전장을 뒤집어 보는가. canonical 1번 자리(코어의 적 편)만 뒤집는다. */
export function arenaViewFlipped(side: number | undefined): boolean {
  return side === 1;
}

/** 거울의 축. 전장 위·아래 변의 합이며 `c - y`가 뒤집힌 y다. */
export function arenaMirrorCenter(arena: { top: number; bottom: number }): number {
  return arena.top + arena.bottom;
}

/**
 * 사건 하나의 좌표를 거울에 비춘 **사본**을 만든다. 원본은 건드리지 않는다 — 사건이 코어 상태의
 * 배열을 가리키고 있으면 제자리에서 바꿀 때 두 번 뒤집힌다.
 *
 * `x`·`y`가 함께 있는 평범한 객체만 점으로 본다(광역 범위의 중심, 돌진의 `from`·`to` 등). 클래스
 * 인스턴스와 깊은 정의(스킬 사본)는 손대지 않는다.
 */
export function mirrorPointsY<T>(value: T, center: number, depth = 0): T {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => mirrorPointsY(item, center, depth + 1)) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) copy[key] = mirrorPointsY(item, center, depth + 1);
  if (typeof copy.x === "number" && typeof copy.y === "number") copy.y = center - copy.y;
  return copy as T;
}

/** 화면에서 이 편이 아군인가. 뒤집힌 화면에서는 코어의 적 편이 곧 나다. */
export function arenaViewAlly(side: "player" | "enemy", flipped: boolean): boolean {
  return (side === "player") !== (flipped === true);
}

/** 거울에 비춘 상태를 원래 값으로 되돌린다. 되돌림은 계산이 아니라 **적어 둔 값**이라 비트 단위로 같다. */
export type ArenaMirrorRestore = () => void;

const MIRROR_SKIP = new Set(["def", "skill", "skills", "basic", "ultimate", "passive", "summons"]);

/**
 * 전투원들의 좌표를 **제자리에서** 거울에 비추고, 원래 값을 되돌리는 함수를 돌려준다.
 *
 * 코어를 진행시키기 전에는 반드시 되돌린다 — `c - (c - y)`는 부동소수 오차로 원래 y와 갈릴 수
 * 있으므로 다시 계산하지 않고 적어 둔 값을 그대로 넣는다. 그래야 서버 재현과 한 비트도 갈리지 않는다.
 *
 * 점(`x`·`y`가 함께 있는 평범한 객체: 몸·여울·메아리·돌아갈 자리)은 축을 기준으로, 오프셋·속도
 * (`dashY`·`knockback.vy`)는 부호만 뒤집는다. 같은 객체를 두 번 비추지 않도록 지나간 것을 기억한다.
 */
export function mirrorFightersY(fighters: readonly object[], center: number): ArenaMirrorRestore {
  const saved: [Record<string, unknown>, string, unknown][] = [];
  const seen = new Set<object>();
  const set = (target: Record<string, unknown>, key: string, value: number): void => {
    saved.push([target, key, target[key]]);
    target[key] = value;
  };
  const walk = (value: unknown, depth: number): void => {
    if (depth > 4 || value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach((item) => walk(item, depth + 1)); return; }
    if (Object.getPrototypeOf(value) !== Object.prototype) return;
    const record = value as Record<string, unknown>;
    if (typeof record.x === "number" && typeof record.y === "number") set(record, "y", center - record.y);
    if (typeof record.dashY === "number") set(record, "dashY", -record.dashY);
    if (typeof record.vy === "number" && typeof record.vx === "number") set(record, "vy", -record.vy);
    for (const [key, item] of Object.entries(record)) {
      if (!MIRROR_SKIP.has(key) && item !== null && typeof item === "object") walk(item, depth + 1);
    }
  };
  fighters.forEach((fighter) => walk(fighter, 0));
  return () => {
    for (let index = saved.length - 1; index >= 0; index -= 1) {
      const [target, key, value] = saved[index];
      target[key] = value;
    }
  };
}
