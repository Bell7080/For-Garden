/**
 * 출시 초기화 세대 확인. 서버 DB를 비우면(`supabase/ops/launch_reset.sql`) `launch_epoch`가 새 값이 된다.
 * 기기가 마지막으로 본 세대와 다르면, 초기화 이전에 만들어진 것들 — 게스트 토큰, 서버 연결 표식, 로컬 저장 —
 * 이 이 기기에 남아 정식 오픈에 섞이지 않도록 지운다. 서버에는 이미 없는 계정의 토큰으로 계속 부르거나,
 * 테스트 때의 로컬 진행이 새 계정 옆에 남는 일을 막는 마지막 문턱이다.
 *
 * 세대를 기록한 적 없는 기기는 `""`(초기화 이전)로 본다 — 그래서 이 기능이 들어가기 전부터 테스트하던 기기도 걸러진다.
 * 서버가 세대를 주지 않으면(`""`) 아무것도 지우지 않는다: 값을 못 읽은 것과 초기화가 없었던 것을 구별할 수 없다.
 * 토큰은 이 파일에서 읽지 않고 키 이름만 안다 — `Session`·`SaveData`로 새지 않는다.
 */
import { LOCAL_SAVE_FLAVOR, LOCAL_SAVE_STORAGE_KEYS } from "../core/saveStorage";
import { SERVER_LINK_STORAGE_KEY } from "./serverProgress";
import { WEB_TOKEN_STORAGE_KEY } from "./webTokenStore";

export const LAUNCH_EPOCH_STORAGE_KEY = "forgarden.launch-epoch";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 이 빌드가 초기화 때 지우는 키들. 설정·언어 같은 기기 취향도 로컬 저장에 들어 있어 함께 처음으로 돌아간다. */
export function launchEpochWipeKeys(): readonly string[] {
  return [WEB_TOKEN_STORAGE_KEY, SERVER_LINK_STORAGE_KEY, LOCAL_SAVE_STORAGE_KEYS[LOCAL_SAVE_FLAVOR]];
}

/**
 * 서버 세대와 기기 세대를 맞춘다. 지운 것이 하나라도 있으면 true — 부르는 쪽이 메모리에 올라간 옛 진행을
 * 버리도록 앱을 다시 시작해야 한다. 지울 것이 없던 새 기기는 세대만 적고 false를 돌려 다시 시작하지 않는다.
 */
export function reconcileLaunchEpoch(
  serverEpoch: string,
  storage: StorageLike | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
  keys: readonly string[] = launchEpochWipeKeys(),
): boolean {
  if (!storage || !serverEpoch) return false;
  try {
    if ((storage.getItem(LAUNCH_EPOCH_STORAGE_KEY) ?? "") === serverEpoch) return false;
    // 서버 계정과 이어진 적이 없는 기기(토큰·연결 표식이 없음)에는 지울 옛 계정이 없다. 이때 로컬 저장은
    // 부트가 방금 만든 첫 실행 상태일 뿐이라, 지우고 다시 시작하면 첫 방문자가 계정 선택 화면을 두 번 본다.
    if (!keys.slice(0, 2).some((key) => storage.getItem(key) !== null)) {
      storage.setItem(LAUNCH_EPOCH_STORAGE_KEY, serverEpoch);
      return false;
    }
    let wiped = false;
    for (const key of keys) {
      if (storage.getItem(key) !== null) wiped = true;
      storage.removeItem(key);
    }
    storage.setItem(LAUNCH_EPOCH_STORAGE_KEY, serverEpoch);
    return wiped;
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 창 등)은 지울 것도 남을 것도 없다.
    return false;
  }
}
