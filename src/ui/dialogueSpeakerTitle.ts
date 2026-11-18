import type { DialogueStandingAsset } from "../core/dialogue";
import type { SquadId } from "../core/types";
import { RELICS } from "../data/relics";
import { SQUADS } from "../data/factions";
import { t, type TextKey } from "../i18n";

/**
 * 대사판 이름 아래에 서는 수식어 — 「테러조 간부」 「회수조 부간부」 「앱솔루트 팽」.
 *
 * 공멸은 조와 직책이 말씨를 정하는 조직이라(군대식 직책 체계 — `docs/story-brain/relationships.md` §1-1)
 * 그 둘을 함께 적고, 아군은 소속 스쿼드 이름을 적는다. 직책은 `docs/lore.md` §4 표와 같아야 한다.
 */
const ANNIHILATION_TITLE: Readonly<Record<string, TextKey>> = {
  koma: "dialogue.title.terrorOfficer",
  toby: "dialogue.title.terrorMember",
  amo: "dialogue.title.terrorMember",
  ripa: "dialogue.title.terrorMember",
  ikanixia: "dialogue.title.retrievalOfficer",
  atra: "dialogue.title.retrievalSubOfficer",
  pulsi: "dialogue.title.retrievalMember",
  neuri: "dialogue.title.retrievalMember",
  mir: "dialogue.title.retrievalMember",
  magasa: "dialogue.title.confinementOfficer",
  noa: "dialogue.title.confinementOfficer",
  raja: "dialogue.title.confinementSubOfficer",
  carno: "dialogue.title.viceCaptain",
};

/** 렐릭이 아닌 화자(상점 점원 등)의 수식어. */
const OTHER_TITLE: Readonly<Record<string, TextKey>> = {
  obi: "dialogue.title.obi",
};

export interface DialogueSpeakerTitle {
  text: string;
  /** 엠블럼을 세울 소속. 없으면 글자만 선다. */
  squad?: SquadId;
}

/** 화자를 찾는다 — 스탠딩이 있으면 그것이, 없으면 이름이 같은 렐릭이 그 사람이다. */
export function dialogueSpeakerId(speaker: string, standing?: DialogueStandingAsset): string | undefined {
  if (!speaker || speaker === "???") return undefined;
  if (standing) return standing;
  return RELICS.find((relic) => relic.name === speaker)?.id;
}

export function dialogueSpeakerTitle(id: string | undefined): DialogueSpeakerTitle | undefined {
  if (!id) return undefined;
  const other = OTHER_TITLE[id];
  if (other) return { text: t(other) };
  const relic = RELICS.find((entry) => entry.id === id);
  if (!relic) return undefined;
  const rank = ANNIHILATION_TITLE[id];
  if (rank) return { text: t(rank), squad: relic.squad };
  const squad = SQUADS[relic.squad];
  return squad ? { text: squad.name, squad: relic.squad } : undefined;
}

/** 시험용 — 공멸 직책표에 오른 개체. */
export const ANNIHILATION_TITLED_IDS = Object.keys(ANNIHILATION_TITLE);
