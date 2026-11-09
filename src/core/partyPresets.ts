/**
 * 편성 프리셋 — 이름을 붙여 둔 세 자리 편성 다섯 벌.
 *
 * 콘텐츠마다 맞는 조합이 달라(스토리 · 레이드 보스 · 현상수배 1대1) 한 벌만 기억하면 화면에 들어올
 * 때마다 다시 짜야 한다. 다섯 벌을 계정 설정에 두고 편성 화면에서 좌우로 넘긴다. **세 자리 콘텐츠만**
 * 쓴다 — 수호전 여섯 칸은 제 기억(`guardFormation`)을 따로 갖고, 방어덱은 서버가 게시본을 갖는다.
 *
 * 이름은 비워 둘 수 있다 — 비우면 화면이 「편성 N」으로 메운다(저장에 번호 이름을 굳히지 않는다,
 * 언어를 바꾸면 그 줄만 옛 언어로 남는다).
 */
export const PARTY_PRESET_COUNT = 5;
export const PARTY_PRESET_SLOTS = 3;
/** 이름은 화면에 서는 글자로 센다(이모지 하나가 둘로 세어지지 않게). */
export const PARTY_PRESET_NAME_MAX = 10;
const ID_MAX = 64;

export interface PartyPreset {
  name: string;
  slots: (string | null)[];
}

const graphemes = (value: string): string[] => {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(value), ({ segment }) => segment) : Array.from(value);
};

/** 앞뒤 공백·줄바꿈을 걷고 글자 수 상한에서 자른다. */
export function normalizePresetName(value: unknown): string {
  if (typeof value !== "string") return "";
  const flat = value.replace(/[\r\n\t]+/g, " ").trim();
  return graphemes(flat).slice(0, PARTY_PRESET_NAME_MAX).join("");
}

function emptyPreset(): PartyPreset {
  return { name: "", slots: Array.from({ length: PARTY_PRESET_SLOTS }, () => null) };
}

/** 저장값을 언제나 다섯 벌 · 세 자리로 맞춘다. 같은 렐릭이 한 벌에 두 번 서면 뒤의 것을 비운다. */
export function normalizePartyPresets(value: unknown): PartyPreset[] {
  const list = Array.isArray(value) ? value : [];
  return Array.from({ length: PARTY_PRESET_COUNT }, (_unused, index) => {
    const raw = list[index] as { name?: unknown; slots?: unknown } | undefined;
    if (!raw || typeof raw !== "object") return emptyPreset();
    const seen = new Set<string>();
    const rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
    const slots = Array.from({ length: PARTY_PRESET_SLOTS }, (_slot, slot) => {
      const id = rawSlots[slot];
      if (typeof id !== "string" || id.length === 0 || id.length > ID_MAX || seen.has(id)) return null;
      seen.add(id);
      return id;
    });
    return { name: normalizePresetName(raw.name), slots };
  });
}

export function normalizePresetIndex(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < PARTY_PRESET_COUNT ? value : 0;
}

/** 다섯 벌을 끝에서 끝으로 넘긴다 — 마지막 다음은 처음이다. */
export function stepPresetIndex(index: number, delta: number): number {
  return (((index + delta) % PARTY_PRESET_COUNT) + PARTY_PRESET_COUNT) % PARTY_PRESET_COUNT;
}

/** 그새 잃은 렐릭만 비운다. 자리는 당기지 않는다. */
export function ownedPresetSlots(preset: PartyPreset, owned: ReadonlySet<string>): (string | null)[] {
  return preset.slots.map((id) => (id && owned.has(id) ? id : null));
}

export function presetIsEmpty(preset: PartyPreset): boolean {
  return preset.slots.every((id) => id === null);
}

/** 한 벌만 바꾼 새 목록. 다른 벌은 그대로 둔다. */
export function withPreset(presets: readonly PartyPreset[], index: number, change: Partial<PartyPreset>): PartyPreset[] {
  const next = normalizePartyPresets(presets);
  const current = next[index];
  if (!current) return next;
  next[index] = { name: change.name === undefined ? current.name : normalizePresetName(change.name), slots: change.slots ? normalizePartyPresets([{ slots: change.slots }])[0].slots : current.slots };
  return next;
}

/** 두 목록이 같은가 — 바뀐 것이 없으면 저장하지 않는다. */
export function samePresets(a: readonly PartyPreset[], b: readonly PartyPreset[]): boolean {
  return a.length === b.length && a.every((preset, index) => preset.name === b[index].name && preset.slots.every((id, slot) => id === b[index].slots[slot]));
}

/** 좌우로 넘기는 손짓 — 짧고(꾹 누름 전) 옆으로 길게 민 손만 센다. 세로로 쓸면 넘기지 않는다. */
export const PRESET_SWIPE = { maxMs: 360, minDistance: 90, ratio: 1.6 } as const;

/**
 * 왼쪽으로 밀면 다음(+1), 오른쪽으로 밀면 이전(−1). 넘기기가 아니면 0.
 *
 * 시간 제한은 **SD 위에서 시작한 손에만** 건다 — 거기서는 꾹 누른 뒤의 손이 끌어 옮기기라 둘을 시간으로
 * 가른다. 빈 띠·프리셋 줄에서 민 손은 겹치는 조작이 없어 천천히 밀어도 넘긴다(`timed: false`).
 */
export function presetSwipeDirection(sample: { elapsedMs: number; dx: number; dy: number }, timed = true): -1 | 0 | 1 {
  if (timed && sample.elapsedMs >= PRESET_SWIPE.maxMs) return 0;
  if (Math.abs(sample.dx) < PRESET_SWIPE.minDistance || Math.abs(sample.dx) < Math.abs(sample.dy) * PRESET_SWIPE.ratio) return 0;
  return sample.dx < 0 ? 1 : -1;
}
