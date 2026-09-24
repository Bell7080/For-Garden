import { cleanBio, cleanNickname, createPlayerUid, nicknameProblem, type NicknameProblem } from "../core/playerCard";
import { findProfileFrame, isProfileFrameUnlocked, PROFILE_FRAMES, type ProfileFrameDefinition } from "../data/profileFrames";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type PlayerCardState, type Session } from "../state/session";

export type PlayerCardResult = { ok: true } | { ok: false; reason: NicknameProblem | "frameLocked" | "unknownFrame" | "notOwned" };

/**
 * 플레이어 카드(닉네임·한 줄 소개·테두리·UID)를 바꾸는 유일한 경계.
 *
 * 씬은 입력만 넘기고 검증·저장은 여기서 끝낸다. 저장이 실패하면 메모리도 되돌린다 — 화면에는
 * 바뀐 이름이 섰는데 다시 켜면 옛 이름인 계정을 만들지 않는다.
 */
export class PlayerCardManager {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager) {}

  get card(): Readonly<PlayerCardState> { return this.state.playerCard; }

  /** UID와 연구 개시일은 계정이 처음 설 때 한 번 정해지고 그 뒤로 바뀌지 않는다. */
  ensureIdentity(random: () => number = Math.random, now: Date = new Date()): void {
    const card = this.state.playerCard;
    if (card.uid && card.createdAt) return;
    this.commit({ ...card, uid: card.uid || createPlayerUid(random), createdAt: card.createdAt || now.toISOString() });
  }

  setNickname(value: string): PlayerCardResult {
    const problem = nicknameProblem(value);
    if (problem) return { ok: false, reason: problem };
    this.commit({ ...this.state.playerCard, nickname: cleanNickname(value) });
    return { ok: true };
  }

  /** 닉네임을 비우면 기본 호칭으로 선다. */
  clearNickname(): PlayerCardResult {
    this.commit({ ...this.state.playerCard, nickname: "" });
    return { ok: true };
  }

  setBio(value: string): PlayerCardResult {
    this.commit({ ...this.state.playerCard, bio: cleanBio(value) });
    return { ok: true };
  }

  /** 테두리는 연구원 레벨이 연 것만 고를 수 있다. */
  setFrame(id: string): PlayerCardResult {
    const frame = findProfileFrame(id);
    if (!frame) return { ok: false, reason: "unknownFrame" };
    if (!isProfileFrameUnlocked(frame, this.state.playerResearch.level)) return { ok: false, reason: "frameLocked" };
    this.commit({ ...this.state.playerCard, frameId: id });
    return { ok: true };
  }

  /** 프로필 사진은 보유한 렐릭의 얼굴만 고를 수 있다. */
  setAvatar(relicId: string): PlayerCardResult {
    if (!this.state.owned.has(relicId)) return { ok: false, reason: "notOwned" };
    this.commit({ ...this.state.playerCard, avatarRelicId: relicId });
    return { ok: true };
  }

  frames(): { frame: ProfileFrameDefinition; unlocked: boolean }[] {
    return PROFILE_FRAMES.map((frame) => ({ frame, unlocked: isProfileFrameUnlocked(frame, this.state.playerResearch.level) }));
  }

  private commit(next: PlayerCardState): void {
    const previous = this.state.playerCard;
    this.state.playerCard = next;
    try { this.saves.save(this.state); } catch (error) { this.state.playerCard = previous; throw error; }
  }
}

export const playerCardManager = new PlayerCardManager();
