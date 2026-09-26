/** es table. Same keys as the Korean table; any key missing here falls back to Korean. */
import { SETTINGS_ES } from "./settings";
import { LOBBY_ES } from "./lobby";
import { COMMON_ES } from "./common";
import { INFO_ES } from "./info";
import { STATUS_ES } from "./status";
import { LAB_ES } from "./lab";
import { EXPEDITION_ES } from "./expedition";
import { BATTLE_ES } from "./battle";
import { CAKE_OPERATION_ES } from "./cakeOperation";
import { EXCAVATION_ES } from "./excavation";
import { AUGMENT_ES } from "./augment";
import { FRIENDS_ES } from "./friends";
import { RUNE_ES } from "./rune";
import { PARTY_ES } from "./party";
import { EXPEDITION_REWARD_ES } from "./expeditionReward";
import { SAVE_CONFLICT_ES } from "./saveConflict";
import { INTERACTION_ES } from "./interaction";
import { SHOP_ES } from "./shop";
import { MISSIONS_ES } from "./missions";
import { INVENTORY_ES } from "./inventory";
import { MISC_ES } from "./misc";
import { SKILL_ES } from "./skill";
import { SYSTEM_ES } from "./system";
import { RAID_ES } from "./raid";
import { BOUNTY_ES } from "./bounty";
import { DUNGEON_ES } from "./dungeon";

export default { ...SETTINGS_ES, ...LOBBY_ES, ...COMMON_ES, ...INFO_ES, ...STATUS_ES, ...LAB_ES, ...EXPEDITION_ES, ...BATTLE_ES, ...CAKE_OPERATION_ES, ...EXCAVATION_ES, ...AUGMENT_ES, ...FRIENDS_ES, ...RUNE_ES, ...PARTY_ES, ...EXPEDITION_REWARD_ES, ...SAVE_CONFLICT_ES, ...INTERACTION_ES, ...SHOP_ES, ...MISSIONS_ES, ...INVENTORY_ES, ...MISC_ES, ...SKILL_ES, ...SYSTEM_ES, ...RAID_ES, ...BOUNTY_ES, ...DUNGEON_ES };
