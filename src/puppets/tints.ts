/**
 * 렐릭별 색 필터. **임시다.**
 *
 * 지금은 아군도 적도 같은 SD 개체 하나를 돌려 쓰고 있어서, 누가 누구인지 색으로만 가른다.
 * 렐릭마다 제 그림이 생기면 이 파일은 통째로 없어진다.
 */
const TINTS: Record<string, number> = {
  rex: 0xd86b4a, // 티라노 — 붉은 흙빛
  anky: 0x8a9a6b, // 안킬로 — 이끼 낀 갑주
  spino: 0x5b9cad, // 스피노사우루스 — 물빛 청록
  dodo: 0xe8d9a0, // 도도 — 바랜 깃털
  smilo: 0xd9a54a, // 스밀로돈 — 황토빛 털
  quetz: 0x6fb3c4, // 케찰 — 창공빛

  "husk-raptor": 0xa33b3b, // 허스크 — 폭주한 붉은빛
  "husk-shell": 0x6d6a63,
  "husk-wing": 0x7a4a86,
};

const FALLBACK = 0xffffff;

export function tintFor(relicId: string): number {
  return TINTS[relicId] ?? FALLBACK;
}

/**
 * 색을 흰색 쪽으로 섞는다.
 *
 * 전신 일러스트에까지 진한 색 필터를 씌우면 그림이 뭉개져 얼굴이 안 보인다.
 * 누구인지 알아볼 정도로만 옅게 물들이려고 쓴다. `amount`가 1이면 흰색이다.
 */
export function mixWhite(color: number, amount: number): number {
  const blend = (channel: number): number => Math.round(channel + (255 - channel) * amount);
  const r = blend((color >> 16) & 0xff);
  const g = blend((color >> 8) & 0xff);
  const b = blend(color & 0xff);
  return (r << 16) | (g << 8) | b;
}
