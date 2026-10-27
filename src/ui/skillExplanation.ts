/** 원문·계수·태그를 바꾸지 않고 효과 하나를 한 문단으로 읽게 한다. 소수점·태그 내부는 자르지 않는다. */
export function formatEffectDescription(text: string): string {
  if (text.includes("\n")) return text;
  const protectedTags: string[] = [];
  const plain = text.replace(/\[\[[\s\S]*?\]\]/g, tag => `\u0000${protectedTags.push(tag) - 1}\u0000`);
  const lines = plain.split(/(?<=[.!?])\s+|(?<=[。！？])\s*/u).map(s => s.trim()).filter(Boolean);
  const restore = (line: string) => line.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedTags[Number(i)]);
  return lines.length < 2 ? text : lines.map(line => `• ${restore(line)}`).join("\n\n");
}

/** 요약이 여러 줄인 기술도 본문·구분선과 겹치지 않는다. */
export function skillDescriptionTop(summaryHeight: number): number {
  return Math.max(268, 156 + summaryHeight + 36);
}
