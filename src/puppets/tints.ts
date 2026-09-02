/**
 * 색 섞기 도우미.
 *
 * 모든 렐릭이 전용 원화를 갖게 되면서 "전용 SD가 없는 개체를 1번 SD로 대신 세우고 색으로
 * 구분하던" 임시 색 표는 사라졌다. 남은 것은 카드 뒷배경처럼 색을 옅게 눌러야 하는 자리다.
 */

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
