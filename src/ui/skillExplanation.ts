/** 원문·계수·태그를 바꾸지 않고 효과 하나를 한 문단으로 읽게 한다. 소수점·태그 내부는 자르지 않는다. */
export function formatEffectDescription(text: string): string {
  if (text.includes("\n")) return text;
  const protectedTags: string[] = [];
  // 규칙어 태그와 **따옴표로 묶은 이름**은 문장 끝으로 보지 않는다. 「찰싹! 시약 묻히기」처럼 이름 안의
  // 느낌표·물음표에서 끊으면 한 문장이 두 줄로 갈라진다(리파의 돌파 표가 그랬다).
  const plain = text.replace(/\[\[[\s\S]*?\]\]|「[^」\n]*」|『[^』\n]*』|"[^"\n]*"|“[^”\n]*”|„[^“\n]*“|«[^»\n]*»/g, tag => `\u0000${protectedTags.push(tag) - 1}\u0000`);
  const lines = plain.split(/(?<=[.!?])\s+|(?<=[。！？])\s*/u).map(s => s.trim()).filter(Boolean);
  const restore = (line: string) => line.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedTags[Number(i)]);
  return lines.length < 2 ? text : lines.map(line => `• ${restore(line)}`).join("\n\n");
}

/** 돌파 표는 네 기술을 한 장에서 읽으므로 문장별 구분은 유지하고 문단 사이 빈 줄은 줄인다. */
export function formatBreakthroughDescription(text: string): string {
  return text.split(/\n+/).map(formatEffectDescription).join("\n").replace(/\n\n/g, "\n");
}

/**
 * 요약 칩 줄이 여러 줄로 내려가도 본문·구분선과 겹치지 않는다.
 * 칩은 `top + 160`에서 시작하고, 구분선(본문 − 28)이 칩 밑변에서 한 뼘(18) 떨어진다.
 */
export function skillDescriptionTop(summaryHeight: number): number {
  return Math.max(268, 160 + summaryHeight + 46);
}
