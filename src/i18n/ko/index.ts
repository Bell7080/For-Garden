/**
 * 한국어 표. **모든 언어의 원본이자 대체본이다.**
 *
 * 다른 언어는 필요할 때 따로 내려받지만 한국어는 언제나 묶음에 들어 있다 — 어느 언어에서든 키가
 * 빠지면 그 자리를 한국어가 메워야 하므로, 늦게 도착하는 자리에 둘 수 없다.
 *
 * 화면이 늘면 그 화면의 표를 새 파일로 만들고 여기서 펼친다.
 */
import { SETTINGS_KO } from "./settings";
import { LOBBY_KO } from "./lobby";
import { COMMON_KO } from "./common";
import { INFO_KO } from "./info";
import { STATUS_KO } from "./status";
import { LAB_KO } from "./lab";
import { EXPEDITION_KO } from "./expedition";
import { BATTLE_KO } from "./battle";
import { EXCAVATION_KO } from "./excavation";
import { AUGMENT_KO } from "./augment";
import { FRIENDS_KO } from "./friends";
import { RUNE_KO } from "./rune";
import { PARTY_KO } from "./party";
import { EXPEDITION_REWARD_KO } from "./expeditionReward";
import { SAVE_CONFLICT_KO } from "./saveConflict";
import { INTERACTION_KO } from "./interaction";
import { SHOP_KO } from "./shop";
import { MISSIONS_KO } from "./missions";
import { INVENTORY_KO } from "./inventory";
import { MISC_KO } from "./misc";

export const KO = { ...SETTINGS_KO, ...LOBBY_KO, ...COMMON_KO, ...INFO_KO, ...STATUS_KO, ...LAB_KO, ...EXPEDITION_KO, ...BATTLE_KO, ...EXCAVATION_KO, ...AUGMENT_KO, ...FRIENDS_KO, ...RUNE_KO, ...PARTY_KO, ...EXPEDITION_REWARD_KO, ...SAVE_CONFLICT_KO, ...INTERACTION_KO, ...SHOP_KO, ...MISSIONS_KO, ...INVENTORY_KO, ...MISC_KO } as const;

/** 화면이 고를 수 있는 문구 키. 한국어 표에 없는 키는 타입에서 막힌다. */
export type TextKey = keyof typeof KO;

/** 언어 폴더는 모두 같은 모양으로 표를 내보낸다 — 검사가 폴더를 훑어 새 언어를 저절로 잡는다. */
export default KO;
