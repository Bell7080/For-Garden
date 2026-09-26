/** id table. Same keys as the Korean table; any key missing here falls back to Korean. */
import { SETTINGS_ID } from "./settings";
import { LOBBY_ID } from "./lobby";
import { COMMON_ID } from "./common";
import { INFO_ID } from "./info";
import { STATUS_ID } from "./status";
import { LAB_ID } from "./lab";
import { EXPEDITION_ID } from "./expedition";
import { BATTLE_ID } from "./battle";
import { CAKE_OPERATION_ID } from "./cakeOperation";
import { EXCAVATION_ID } from "./excavation";
import { AUGMENT_ID } from "./augment";
import { FRIENDS_ID } from "./friends";
import { RUNE_ID } from "./rune";
import { PARTY_ID } from "./party";
import { EXPEDITION_REWARD_ID } from "./expeditionReward";
import { SAVE_CONFLICT_ID } from "./saveConflict";
import { INTERACTION_ID } from "./interaction";
import { SHOP_ID } from "./shop";
import { MISSIONS_ID } from "./missions";
import { INVENTORY_ID } from "./inventory";
import { MISC_ID } from "./misc";
import { SKILL_ID } from "./skill";
import { SYSTEM_ID } from "./system";
import { RAID_ID } from "./raid";
import { BOUNTY_ID } from "./bounty";
import { DUNGEON_ID } from "./dungeon";

export default { ...SETTINGS_ID, ...LOBBY_ID, ...COMMON_ID, ...INFO_ID, ...STATUS_ID, ...LAB_ID, ...EXPEDITION_ID, ...BATTLE_ID, ...CAKE_OPERATION_ID, ...EXCAVATION_ID, ...AUGMENT_ID, ...FRIENDS_ID, ...RUNE_ID, ...PARTY_ID, ...EXPEDITION_REWARD_ID, ...SAVE_CONFLICT_ID, ...INTERACTION_ID, ...SHOP_ID, ...MISSIONS_ID, ...INVENTORY_ID, ...MISC_ID, ...SKILL_ID, ...SYSTEM_ID, ...RAID_ID, ...BOUNTY_ID, ...DUNGEON_ID };
