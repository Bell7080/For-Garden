/** 중복 표본은 아이템을 중복 지급하지 않고 같은 도시의 다음 미발견 표본으로 바꾸는 명시적 정책이다. */
export type JournalDiscoveryResolution = { kind: "new" | "replacement"; journalId: string } | { kind: "exhausted"; journalId: null };

/** 후보는 이미 도시별 발견 순서로 정렬되어 들어오며, 난수나 상태 변경 없이 결과만 고른다. */
export function resolveJournalDiscovery(candidateId: string, cityJournalIds: readonly string[], discovered: ReadonlySet<string>): JournalDiscoveryResolution {
  if (!cityJournalIds.includes(candidateId)) throw new RangeError("후보 일지가 해당 도시에 없습니다.");
  if (!discovered.has(candidateId)) return { kind: "new", journalId: candidateId };
  const replacement = cityJournalIds.find((id) => !discovered.has(id));
  return replacement ? { kind: "replacement", journalId: replacement } : { kind: "exhausted", journalId: null };
}
