import { publicProfile } from "./publicProfile";
import { saveManager } from "../state/SaveManager";
import { sharedReadCache } from "./sharedReadCache";

type ProfileJson = { id?: unknown; competitiveStats?: Record<string, unknown> | null } & Record<string, unknown>;
type LoadSave = (playerId: string) => Promise<{ data: unknown } | null>;
const legacyRecords = sharedReadCache<ReturnType<typeof publicProfile>["competitiveStats"] | null>(60_000, 256);
const LEGACY_READ_CONCURRENCY = 4;

/**
 * v0.372.0 전에 굳은 공개 프로필에는 스토리 최고 관문·원정 최고 점수가 없다 — 그 친구가 다시 저장하기 전까지
 * 친구 카드가 「기록 없음」으로 섰다. 공개 프로필에 스토리 관문이 없으면 그 친구의 저장에서 기록 칸만 다시 짓는다.
 * 최신 프로필은 완료한 관문이 없을 때 null을 싣는다. 바로 전 형식의 storyClears도 기록을 계산한 표식이다.
 * 공개하는 값은 `publicProfile`의 화이트리스트 그대로다(저장 본문은 응답에 싣지 않는다).
 */
export async function refreshStaleProfileRecords(result: unknown, loadSave: LoadSave, now: Date, project = ""): Promise<void> {
  const byPlayer = new Map<string, ProfileJson[]>();
  for (const profile of collectProfiles(result)) {
    if (typeof profile.id !== "string" || profile.competitiveStats?.highestStage !== undefined
      || Array.isArray(profile.competitiveStats?.storyClears)) continue;
    const group = byPlayer.get(profile.id);
    if (group) group.push(profile);
    else byPlayer.set(profile.id, [profile]);
  }
  const pending = byPlayer.entries();
  await Promise.all(Array.from({ length: Math.min(LEGACY_READ_CONCURRENCY, byPlayer.size) }, async () => {
    for (const [id, profiles] of pending) {
      try {
        const fresh = await legacyRecords.read(JSON.stringify([project, id]), async () => {
          const stored = await loadSave(id);
          return stored ? publicProfile(saveManager.parse(stored.data), id, now).competitiveStats : null;
        });
        if (fresh) for (const profile of profiles) {
          // 아레나 RP는 DB 트리거가 공개 프로필에 얹는 값이라 그대로 둔다.
          profile.competitiveStats = { ...(profile.competitiveStats ?? {}), ...fresh };
        }
      } catch {
        // 저장을 읽지 못한 친구는 예전 카드 그대로 선다.
      }
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
