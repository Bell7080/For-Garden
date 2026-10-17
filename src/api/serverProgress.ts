/**
 * 서버가 진행을 소유하도록 켠다. 타이틀에서 한 번 부르고, 성공하면 `gameApi`가 서버 호출로 바뀌어
 * 이후 모든 조작이 `/api/game`을 지난다. 연결할 서버가 없는 빌드(설정·보안 저장소 없음, E2E)는
 * 아무것도 하지 않고 이 기기의 임시 구현에 머문다.
 *
 * - 처음 연결(서버에 저장이 없음): 이 기기의 진행을 그대로 올려 서버 계정의 시작점으로 삼는다.
 * - 이 기기가 이미 이 계정과 연결된 적이 있음: 서버 저장을 그대로 받는다(서버가 진실이다).
 * - 이 기기에 아직 연결된 적 없는 진행이 있고 서버에도 다른 진행이 있음: 자동으로 덮어쓰지 않고 고르게 한다.
 * 기기 값(소리·그래픽·글자 크기·언어)은 어느 쪽이든 이 기기 것을 지킨다(`mergeServerSettings`).
 */
import { mergeServerSettings } from "../core/settingsOwnership";
import { session, type Session } from "../state/session";
import type { SaveManager } from "../state/SaveManager";
import type { AccountApi, AccountFailureCode } from "./AccountApi";
import { AccountSaveSync, type SaveSyncChoice } from "./AccountSaveSync";
import { installGameApi, signalRemoteMissionNotice } from "./FakeServer";
import { createRemoteGameApi } from "./RemoteGameApi";
import type { GameApi } from "./contracts";

/** 연결에 필요한 계정 쪽 능력만 좁힌 모양이다. `SupabaseAccountApi`가 그대로 맞는다. */
export type ServerProgressAccount = AccountApi & {
  accessToken(): Promise<string | null>;
  userId(): Promise<string | null>;
};

/** 어느 계정의 진행이 이 기기에 들어 있는지의 기억이다. 토큰이 아니라 식별자만 둔다. */
export interface LinkMarker {
  get(): string | null;
  set(userId: string | null): void;
}

export type ServerProgressResult =
  | { ok: true; mode: "server" | "local" }
  | { ok: false; code: AccountFailureCode };

export interface ServerProgressDeps {
  account: ServerProgressAccount | null;
  saves: Pick<SaveManager, "exportData" | "importRemote" | "save">;
  marker: LinkMarker;
  /** 서로 다른 두 진행이 만났을 때 고른다. */
  choose: (local: Parameters<Parameters<AccountSaveSync["synchronize"]>[1]>[0], remote: Parameters<Parameters<AccountSaveSync["synchronize"]>[1]>[1]) => Promise<SaveSyncChoice>;
  /** 서버 상태를 반영할 세션이다. 기본은 공유 세션이다. */
  target?: Session;
  install?: (api: GameApi | null) => void;
  fetchImpl?: typeof fetch;
}

const MARKER_KEY = "forgarden.server-link";

export function createLinkMarker(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): LinkMarker {
  return {
    get() { try { return storage?.getItem(MARKER_KEY) ?? null; } catch { return null; } },
    set(userId) { try { if (userId === null) storage?.removeItem(MARKER_KEY); else storage?.setItem(MARKER_KEY, userId); } catch { /* 기억이 없으면 다음 연결에서 한 번 더 묻는다 */ } },
  };
}

/** 서버가 보낸 상태를 세션에 얹는다: 계정의 값은 서버 것, 기기 값은 이 기기 것. */
export function applyServerState(target: Session, next: Session, saves: Pick<SaveManager, "save">): void {
  const settings = mergeServerSettings(target.settings, next.settings);
  Object.assign(target, next, { settings });
  saves.save(target);
}

export async function connectServerProgress(deps: ServerProgressDeps): Promise<ServerProgressResult> {
  const account = deps.account;
  if (!account) return { ok: true, mode: "local" };
  const target = deps.target ?? session;
  const install = deps.install ?? installGameApi;

  const userId = await account.userId();
  if (!userId) return { ok: false, code: "network-error" };

  const meta = await account.getRemoteSaveMetadata();
  if (!meta.ok) return meta;

  if (meta.value === null || deps.marker.get() !== userId) {
    // 처음 만나는 기기이거나 서버가 비어 있다: 같은 해시면 그대로, 다르면 고르게 한다.
    const sync = new AccountSaveSync(account, deps.saves);
    const result = await sync.synchronize(target, deps.choose);
    if (!result.ok) return result;
  }

  // 위 동기화가 로컬 저장을 서버 쪽으로 맞췄으므로 서버 본문을 한 번 받아 세션과 맞춘다.
  const downloaded = await account.downloadRemoteSave();
  if (!downloaded.ok) return downloaded;
  let restored: Session;
  try { restored = deps.saves.importRemote(downloaded.value.data); }
  catch { return { ok: false, code: "invalid-remote-save" }; }
  applyServerState(target, restored, deps.saves);
  deps.marker.set(userId);

  install(createRemoteGameApi({
    getAccessToken: () => account.accessToken(),
    applyState: (next) => { applyServerState(target, next, deps.saves); signalRemoteMissionNotice(target); },
    ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
  }));
  return { ok: true, mode: "server" };
}
