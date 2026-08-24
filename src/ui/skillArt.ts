import type { Element, Role } from "../core/types";

/**
 * 스킬 일러스트와 그 위에 씌우는 색 필터.
 *
 * 원화는 흰 실루엣 한 장씩이고(`scripts/prepare_skill_icons.py`가 구운다), 색은 여기서만
 * 정한다. 캐릭터가 늘어도 파일은 폴더 하나 늘 뿐이고 색 규칙은 이 표에 그대로 남는다.
 * 그림마다 색을 미리 구워 넣으면 개체의 속성이 바뀔 때 아트를 다시 받아야 한다.
 */

/** 스킬 칸 넷. 원본 파일 이름(`char{번호}skill_{자리}`)의 자리 번호와 순서가 같다. */
export type SkillArtSlot = "passive" | "basic" | "ultimate" | "ferocity";

export const SKILL_ART_SLOTS: readonly SkillArtSlot[] = ["passive", "basic", "ultimate", "ferocity"];

/**
 * 전용 스킬 일러스트를 가진 렐릭.
 *
 * 여기 없는 개체는 공용 효과 아이콘(`skillIcons.ts`)으로 남는다. 아트가 도착하면 이 목록에
 * id를 더하고 같은 이름의 폴더만 채우면 된다 — 화면 코드는 손대지 않는다.
 */
const RELICS_WITH_ART: readonly string[] = ["anky", "rex", "spino", "luka", "husk-raptor", "husk-shell", "husk-wing"];

/** Phaser 텍스처 키. 파일 경로가 아니라 이 함수가 만든 키로만 그림을 찾는다. */
export function skillArtKey(relicId: string, slot: SkillArtSlot): string {
  return `skill-art-${relicId}-${slot}`;
}

/** 전용 일러스트가 있으면 그 키를, 없으면 undefined를 준다. 화면은 없을 때 공용 아이콘으로 되돌린다. */
export function skillArtFor(relicId: string, slot: SkillArtSlot): string | undefined {
  return RELICS_WITH_ART.includes(relicId) ? skillArtKey(relicId, slot) : undefined;
}

/** 로딩 단계가 읽는 목록. 렐릭 하나에 네 장이다. */
export const SKILL_ART_ASSETS: ReadonlyArray<readonly [string, string]> = RELICS_WITH_ART.flatMap((relicId) =>
  SKILL_ART_SLOTS.map((slot) => [skillArtKey(relicId, slot), `/sprites/skills/${relicId}/${slot}.webp`] as const),
);

/**
 * 속성과 직군의 색.
 *
 * 구워 둔 속성·직군 아이콘(`scripts/prepare_icons.py`의 표)과 **같은 값**이다. 그 아이콘은
 * 파일에 색이 들어 있고 이쪽은 코드가 칠하므로 표가 둘로 나뉘는데, 두 표가 갈라지면 같은
 * 속성이 화면에서 서로 다른 색으로 보인다. `tests/unit/skillArt.test.ts`가 둘을 묶어 둔다.
 */
export const ELEMENT_TINT: Record<Element, number> = {
  fire: 0xef5b45,
  water: 0x4fa8e4,
  grass: 0x63c172,
  earth: 0xd29b5e,
  wind: 0x86dcc8,
};

export const ROLE_TINT: Record<Role, number> = {
  warrior: 0xe25c54,
  tank: 0x5cb8ea,
  support: 0x9fd45f,
  assassin: 0xa87ce6,
};

/**
 * 필터의 성격.
 *
 * 두 색을 그냥 섞으면 마주 보는 색끼리(흙과 물처럼) 잿빛이 된다. 그래서 섞은 것에서 **색상만**
 * 가져오고 진하기와 밝기는 여기 값으로 고정한다. 그러면 어떤 조합이 와도 탁해지지 않고,
 * 흰 실루엣 위에 얹혔을 때 은은한 파스텔 한 겹으로 읽힌다.
 */
const FILTER = { elementWeight: 0.66, saturation: 0.34, value: 1 } as const;

/** 필터를 배경 판에 옅게 깔 때 쓰는 진하기. 그림보다 진해지면 칩이 색판으로 보인다. */
export const SKILL_ART_WASH_ALPHA = 0.15;

function hue(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const delta = max - min;
  const raw = max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
  return ((raw * 60) % 360 + 360) % 360;
}

/**
 * 속성과 직군을 섞은 은은한 색.
 *
 * 속성이 조금 더 세다 — 개체를 먼저 가르는 것이 속성이기 때문이다. 직군은 같은 속성끼리
 * 서로 다른 쪽으로 밀어 주는 정도만 맡는다.
 */
export function skillArtTint(element: Element, role: Role): number {
  const from = ELEMENT_TINT[element];
  const to = ROLE_TINT[role];
  const weight = FILTER.elementWeight;
  const mix = (shift: number): number => (((from >> shift) & 0xff) * weight + ((to >> shift) & 0xff) * (1 - weight)) / 255;
  const h = hue(mix(16), mix(8), mix(0)) / 60;
  // 색상 하나에서 파스텔을 만든다. 진하기와 밝기가 늘 같아서 아이콘 넷이 한 벌로 읽힌다.
  const chroma = FILTER.value * FILTER.saturation;
  const second = chroma * (1 - Math.abs((h % 2) - 1));
  const base = FILTER.value - chroma;
  const table: readonly [number, number, number][] = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second],
  ];
  const [r, g, b] = table[Math.floor(h) % 6];
  const byte = (channel: number): number => Math.round((channel + base) * 255);
  return (byte(r) << 16) | (byte(g) << 8) | byte(b);
}
