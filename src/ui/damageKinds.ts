import type { Passive, RelicDef, Skill } from "../core/types";

/**
 * 한 기술·한 개체가 **실제로 어떤 피해를 내는가** — 물리 · 마법 · 고정(방어·저항을 지나는 피해).
 *
 * 스킬 칩 첫 칸(`effectType`)은 그 기술의 **얼굴**만 말한다. 그런데 피해는 그 밖에서도 난다 —
 * 켄토의 「까칠」이 되돌려 주는 마법 피해, 안카가 재운 적이 깰 때의 마법 피해, 유티의 서리깃이 터진 뒤
 * 방어를 지나는 동상, 모르페의 관측 발동처럼. 여기서는 전투가 그 피해를 계산할 때 읽는 **계약의 모양**만
 * 보고 종류를 모은다. 개체 이름으로 가르지 않는다. 피해 공식(`skirmish.ts`)이 그 계약에 붙인 종류를
 * 그대로 옮긴 것이라, 새 계약이 피해를 내면 아래 두 표에 한 줄을 더한다.
 *
 * 혼합은 기술 하나의 성질이 아니다 — 한 타격의 피해 종류는 늘 하나이고(`secondaryScaling`은 위력을
 * 두 능력치에서 뽑을 뿐 종류는 그대로다), **한 개체가 물리와 마법을 함께 낼 때**만 혼합이다.
 *
 * 폭주 특성·한계 돌파가 더하는 피해는 세지 않는다 — 늘 서 있는 기본 몫이 그 개체를 말한다.
 */
export type DamageKind = "physical" | "magical" | "fixed";

/** 겹이 차면 스스로 피해를 내는 상태. 종류는 그 상태를 터뜨리는 코어 함수가 정한 값이다. */
const STATUS_DAMAGE: Readonly<Partial<Record<string, DamageKind>>> = {
  vandalism: "magical", // 낙서 폭발 — 주문력 마법 피해
  drowsy: "magical", // 깨는 순간 — 재운 쪽 저항력의 마법 피해
  pressure: "physical", // 수압 폭발 — 방어·저항에서 나온 물리 피해
  butcher: "physical", // 손질 폭발 — 물리 피해
  frostPlume: "fixed", // 동상 — 방어를 지나는 피해
};

/** 상태가 아니라 제 이름의 필드로 피해를 내는 계약. */
const FIELD_DAMAGE: Readonly<Partial<Record<string, DamageKind>>> = {
  prickle: "magical", // 까칠 반격 — 주문력 마법 피해
  batSwarm: "magical", // 박쥐 떼 — 주문력 마법 피해
  observationVolley: "fixed", // 관측 발동 — 방어·저항을 지난다
};

function walk(value: unknown, into: Set<DamageKind>, depth: number): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, into, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.kind === "string") {
    const kind = STATUS_DAMAGE[record.kind];
    if (kind) into.add(kind);
  }
  // 숨어 들어가 꽂는 한 방(은신 궁극기)은 방어·저항을 지나는 고정 피해다.
  if (record.ignoresDefense === true) into.add("fixed");
  for (const [key, child] of Object.entries(record)) {
    const kind = FIELD_DAMAGE[key];
    if (kind && child !== undefined) into.add(kind);
    walk(child, into, depth + 1);
  }
}

/** 기술 하나가 내는 피해 종류. 얼굴(`effectType`)·피해 종류(`damageType`)·딸린 계약을 함께 본다. */
export function skillDamageKinds(skill: Skill | Passive): Set<DamageKind> {
  const kinds = new Set<DamageKind>();
  const raw = skill as { effectType: string; damageType?: string };
  if (raw.effectType === "physical" || raw.effectType === "magical" || raw.effectType === "fixed") kinds.add(raw.effectType);
  if (raw.damageType === "physical" || raw.damageType === "magical") kinds.add(raw.damageType);
  walk(skill, kinds, 0);
  return kinds;
}

/** 개체 하나가 내는 피해 종류 전부 — 일반 공격·궁극기·패시브. */
export function characterDamageKinds(def: Pick<RelicDef, "basic" | "ultimate" | "passive">): Set<DamageKind> {
  const kinds = new Set<DamageKind>();
  for (const skill of [def.basic as Skill, def.ultimate as Skill, def.passive]) {
    for (const kind of skillDamageKinds(skill)) kinds.add(kind);
  }
  return kinds;
}

/** 이름 아래 해시태그의 피해 갈래 — 물리와 마법을 함께 내면 혼합이다. */
export type CharacterDamageTag = "physical" | "magical" | "mixed";

export function characterDamageTag(kinds: ReadonlySet<DamageKind>): CharacterDamageTag | undefined {
  if (kinds.has("physical") && kinds.has("magical")) return "mixed";
  if (kinds.has("physical")) return "physical";
  if (kinds.has("magical")) return "magical";
  return undefined;
}
