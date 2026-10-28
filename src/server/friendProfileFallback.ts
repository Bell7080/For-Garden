import { publicProfile } from "./publicProfile";
import { saveManager } from "../state/SaveManager";

type ProfileJson = { id?: unknown; competitiveStats?: Record<string, unknown> | null } & Record<string, unknown>;
type LoadSave = (playerId: string) => Promise<{ data: unknown } | null>;

/**
 * v0.372.0 전에 굳은 공개 프로필에는 스토리 최고 관문·원정 최고 점수가 없다 — 그 친구가 다시 저장하기 전까지
 * 친구 카드가 「기록 없음」으로 섰다. 공개 프로필에 스토리 관문이 없으면 그 친구의 저장에서 기록 칸만 다시 짓는다.
 * 1-1은 오프닝이 곧장 들어가는 관문이라 실제로 깬 관문이 없는 계정은 드물고, 다시 지어도 값은 같다.
 * 공개하는 값은 `publicProfile`의 화이트리스트 그대로다(저장 본문은 응답에 싣지 않는다).
 */
export async function refreshStaleProfileRecords(result: unknown, loadSave: LoadSave, now: Date): Promise<void> {
  const profiles = collectProfiles(result).filter((profile) => typeof profile.id === "string" && !profile.competitiveStats?.highestStage);
  await Promise.all(profiles.map(async (profile) => {
    try {
      const stored = await loadSave(profile.id as string);
      if (!stored) return;
      const fresh = publicProfile(saveManager.parse(stored.data), profile.id as string, now).competitiveStats;
      // 아레나 RP는 DB 트리거가 공개 프로필에 얹는 값이라 그대로 둔다.
      profile.competitiveStats = { ...(profile.competitiveStats ?? {}), ...fresh };
    } catch {
      // 저장을 읽지 못한 친구는 예전 카드 그대로 선다 — 목록 전체를 실패시키지 않는다.
    }
  }));
}

function collectProfiles(result: unknown): ProfileJson[] {
  if (!result || typeof result !== "object") return [];
  const data = result as Record<string, unknown>;
  const out: ProfileJson[] = [];
  const push = (value: unknown) => { if (value && typeof value === "object") out.push(value as ProfileJson); };
  if (Array.isArray(data.friends)) data.friends.forEach(push);
  for (const key of ["incoming", "outgoing", "users"]) {
    const rows = data[key];
    if (Array.isArray(rows)) rows.forEach((row) => push((row as { profile?: unknown } | null)?.profile));
  }
  return out;
}
