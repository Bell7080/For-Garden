/** 기존 UI import를 보존하면서 구현 소유권은 화면 공용 puppets 경계로 승격한다. */
export { loadOwnedPuppet, loadOwnedPuppetPair, loadOwnedPuppetWithRetry } from "../puppets/ownedPuppetLoad";
export type { DisposablePuppet, PuppetLoadResult } from "../puppets/ownedPuppetLoad";
