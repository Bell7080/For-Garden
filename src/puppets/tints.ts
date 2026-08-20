/**
 * 렐릭별 색 필터. **임시다.**
 *
 * 아직 전용 SD가 없는 아군을 1번 SD로 대신 표시할 때 서로 구분하기 위한 임시 색이다.
 * 토비·아모·리파는 전용 적 Puppet을 연결했으므로 이 색 목록을 사용하지 않는다.
 */
const TINTS: Record<string, number> = {
  rex: 0xd86b4a, // 티라노 — 붉은 흙빛
  anky: 0x8a9a6b, // 안킬로 — 이끼 낀 갑주
  spino: 0x5b9cad, // 스피노사우루스 — 물빛 청록
  dodo: 0xe8d9a0, // 도도 — 바랜 깃털
  smilo: 0xd9a54a, // 스밀로돈 — 황토빛 털
  quetz: 0x6fb3c4, // 케찰 — 창공빛
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
