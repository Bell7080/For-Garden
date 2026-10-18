/**
 * 서버가 진행을 소유하도록 켠다. 타이틀에서 한 번 부르고, 성공하면 `gameApi`가 서버 호출로 바뀌어
 * 이후 모든 조작이 `/api/game`을 지난다. 연결할 서버가 없는 빌드(설정·보안 저장소 없음, E2E)는
 * 아무것도 하지 않고 이 기기의 임시 구현에 머문다.
 *
 * - 정식 빌드: 로컬 업로드 없이 서버가 새 계정의 기본 상태를 생성한다.
 * - 개발/QA 연결 흐름: 기존 충돌 선택 경로를 유지한다. 운영 DB의 클라이언트 업로드 권한은 닫혀 있다.
 * - 이 기기가 이미 이 계정과 연결된 적이 있음: 서버 저장을 그대로 받는다(서버가 진실이다).
 * - 이 기기에 아직 연결된 적 없는 진행이 있고 서버에도 다른 진행이 있음: 자동으로 덮어쓰지 않고 고르게 한다.
 * 기기 값(소리·그래픽·글자 크기·언어)은 어느 쪽이든 이 기기 것을 지킨다(`mergeServerSettings`).
 */
import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { mergeServerSettings } from "../core/settingsOwnership";
import { session, type Session } from "../state/session";
import type { SaveManager } from "../state/SaveManager";
import type { AccountApi, AccountFailureCode } from "./AccountApi";
import { AccountSaveSync, type SaveSyncChoice } from "./AccountSaveSync";
import { installGameApi, signalRemoteMissionNotice } from "./FakeServer";
import { installSocialApi } from "./FakeSocialServer";
import { createRemoteSocialApi } from "./RemoteSocialApi";
import { createRemoteGuildApi } from "./RemoteGuildApi";
import { installGuildApi } from "./guildApi";
import { createRemoteGameApi, RemoteGameApiError } from "./RemoteGameApi";
import type { GameApi } from "./contracts";

/** 연결에 필요한 계정 쪽 능력만 좁힌 모양이다. `SupabaseAccountApi`가 그대로 맞는다. */
export type ServerProgressAccount = AccountApi & {
  accessToken(): Promise<string | null>;
  userId(): Promise<string | null>;
  lastFailure?(): string;
};

/** 어느 계정의 진행이 이 기기에 들어 있는지의 기억이다. 토큰이 아니라 식별자만 둔다. */
export interface LinkMarker {
  get(): string | null;
  set(userId: string | null): void;
}

export type ServerProgressResult =
  | { ok: true; mode: "server" | "local" }
  | { ok: false; code: AccountFailureCode; /** 실패 지점을 가르는 짧은 진단 문자열이다. 토큰·키는 담지 않는다. */ detail?: string };

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

export const SERVER_LINK_STORAGE_KEY = "forgarden.server-link";
const MARKER_KEY = SERVER_LINK_STORAGE_KEY;

export function createLinkMarker(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): LinkMarker {
  return {
    get() { try { return storage?.getItem(MARKER_KEY) ?? null; } catch { return null; } },
    set(userId) { try { if (userId === null) storage?.removeItem(MARKER_KEY); else storage?.setItem(MARKER_KEY, userId); } catch { /* 기억이 없으면 다음 연결에서 한 번 더 묻는다 */ } },
  };
}

/** 서버가 보낸 상태를 세션에 얹는다: 계정의 값은 서버 것, 기기 값은 이 기기 것. */
export function applyServerState(target: Session, next: Session, saves: Pick<SaveManager, "save">): void {
  const settings = mergeServerSettings(target.settings, next.settings);
  // 고른 관문은 지도에서 누른 순간 이 기기가 정한다. 서버 값은 마지막 입장의 관문이라, 편성을 만지는 사이 도착한
  // 어떤 응답이든 그대로 얹으면 1-2를 골라 놓고 1-1에 입장한다(깬 관문을 다시 깨고 새 관문은 영영 깨지 못한다).
  const selectedStageId = target.selectedStageId ?? next.selectedStageId;
  Object.assign(target, next, { settings, selectedStageId });
  saves.save(target);
}

/** `/api/game` 호출이 왜 실패했는지 한 줄로 줄인다. 상태 코드와 서버가 준 코드만 남긴다. */
export function describeGameFailure(error: unknown): string {
  if (error instanceof RemoteGameApiError) return `game:${error.status}:${error.code}`;
  return `game-exception:${error instanceof Error ? error.name : "unknown"}`;
}

export async function connectServerProgress(deps: ServerProgressDeps): Promise<ServerProgressResult> {
  const account = deps.account;
  if (!account) return !QA_TOOLS_ENABLED ? { ok: false, code: "unsupported" } : { ok: true, mode: "local" };
  const target = deps.target ?? session;
  const install = deps.install ?? installGameApi;

  const userId = await account.userId();
  if (!userId) return { ok: false, code: "network-error", detail: account.lastFailure?.() || "no-user" };

  // 서버는 로컬 세이브 업로드로 시작하지 않는다(클라이언트의 저장 쓰기 권한은 회수됐다). 첫 계정도 서버가 기본 상태를 생성한다. QA 빌드도 같은 길을 쓴다.
  const remote=createRemoteGameApi({getAccessToken:()=>account.accessToken(),applyState:next=>{applyServerState(target,next,deps.saves);signalRemoteMissionNotice(target);},fetchImpl:deps.fetchImpl});
  try { await remote.getPlayerState(); }
  catch (error) { return {ok:false,code:"network-error",detail:describeGameFailure(error)}; }
  install(remote);
  const social=createRemoteSocialApi({getAccessToken:()=>account.accessToken(),fetchImpl:deps.fetchImpl});
  installSocialApi(social);
  installGuildApi(createRemoteGuildApi({getAccessToken:()=>account.accessToken(),fetchImpl:deps.fetchImpl}));
  void social.getRequests().catch(()=>undefined);
  deps.marker.set(userId);
  return {ok:true,mode:"server"};
}

