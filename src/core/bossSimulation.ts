/** Boss battles integrate the same 20 ms ticks in the scene and authoritative replay. */
export const BOSS_STEP_MS = 20;
export function bossBattleRandom(identity: string): () => number {
  let seed = 2166136261;
  for (const character of identity) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
