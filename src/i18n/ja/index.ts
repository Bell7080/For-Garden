/** 일본어 표. 한국어 표와 같은 키를 쓰며, 빠진 키는 한국어가 메운다. */
import { SETTINGS_JA } from "./settings";
import { LOBBY_JA } from "./lobby";
import { COMMON_JA } from "./common";
import { INFO_JA } from "./info";
import { STATUS_JA } from "./status";
import { LAB_JA } from "./lab";
import { EXPEDITION_JA } from "./expedition";
import { BATTLE_JA } from "./battle";

export default { ...SETTINGS_JA, ...LOBBY_JA, ...COMMON_JA, ...INFO_JA, ...STATUS_JA, ...LAB_JA, ...EXPEDITION_JA, ...BATTLE_JA };
