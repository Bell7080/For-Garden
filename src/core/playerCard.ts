import { DEFAULT_PROFILE_FRAME_ID, findProfileFrame } from "../data/profileFrames";
import { RELICS } from "../data/relics";
import type { PlayerCardState } from "../state/session";

/**
 * 플레이어 카드의 입력 규칙 — 닉네임·한 줄 소개·UID·테두리.
 *
 * 글자 수는 **자판의 글자가 아니라 화면에 서는 글자**(유니코드 문자)로 센다. `length`로 세면
 * 이모지 하나가 둘로 세어져 한국어·영어·이모지 닉네임의 상한이 서로 달라진다.
 */
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;
export const BIO_MAX_LENGTH = 40;
export const PLAYER_UID_LENGTH = 9;

export type NicknameProblem = "tooShort" | "tooLong" | "invalidCharacter";

const glyphs = (value: string): string[] => Array.from(value);
/** 줄바꿈·제어 문자·앞뒤 공백은 카드 한 줄을 깨뜨린다. */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

export function cleanNickname(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function nicknameProblem(value: string): NicknameProblem | undefined {
  const cleaned = cleanNickname(value);
  if (CONTROL.test(cleaned)) return "invalidCharacter";
  const length = glyphs(cleaned).length;
  if (length < NICKNAME_MIN_LENGTH) return "tooShort";
  if (length > NICKNAME_MAX_LENGTH) return "tooLong";
  return undefined;
}

/** 한 줄 소개는 비워도 된다. 줄바꿈을 한 칸으로 접고 상한에서 자른다. */
export function cleanBio(value: string): string {
  const flat = value.replace(/[\r\n\u2028\u2029]+/gu, " ").replace(CONTROL, "").replace(/\s+/gu, " ").trim();
  return glyphs(flat).slice(0, BIO_MAX_LENGTH).join("");
}

export function isPlayerUid(value: string): boolean {
  return new RegExp(`^[1-9][0-9]{${PLAYER_UID_LENGTH - 1}}$`).test(value);
}

/** 난수를 주입받아 아홉 자리 UID를 만든다(첫 자리는 0이 아니다). */
export function createPlayerUid(random: () => number): string {
  let uid = String(1 + Math.floor(random() * 9));
  while (uid.length < PLAYER_UID_LENGTH) uid += String(Math.floor(random() * 10) % 10);
  return uid;
}

/** 저장에서 읽은 카드를 규칙 안으로 되돌린다. 규칙 밖의 값은 버리고 기본값으로 강등한다. */
export function normalizePlayerCard(value: unknown): PlayerCardState {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<PlayerCardState>;
  const nickname = typeof raw.nickname === "string" && raw.nickname !== "" && nicknameProblem(raw.nickname) === undefined ? cleanNickname(raw.nickname) : "";
  return {
    uid: typeof raw.uid === "string" && isPlayerUid(raw.uid) ? raw.uid : "",
    nickname,
    bio: typeof raw.bio === "string" ? cleanBio(raw.bio) : "",
    frameId: typeof raw.frameId === "string" && findProfileFrame(raw.frameId) ? raw.frameId : DEFAULT_PROFILE_FRAME_ID,
    avatarRelicId: typeof raw.avatarRelicId === "string" && RELICS.some(({ id }) => id === raw.avatarRelicId) ? raw.avatarRelicId : "",
    createdAt: typeof raw.createdAt === "string" && Number.isFinite(Date.parse(raw.createdAt)) ? raw.createdAt : "",
  };
}

/** 연구 개시일부터 오늘까지 며칠째인가(첫날이 1일째). */
export function researchDays(createdAt: string, now: Date): number {
  const start = Date.parse(createdAt);
  if (!Number.isFinite(start)) return 1;
  return Math.max(1, Math.floor((now.getTime() - start) / 86_400_000) + 1);
}
