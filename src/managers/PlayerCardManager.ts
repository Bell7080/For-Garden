import { nicknameLockedUntil } from "../core/playerCard";
import { isProfileFrameUnlocked, PROFILE_FRAMES, type ProfileFrameDefinition } from "../data/profileFrames";
import type { PlayerCardFailureReason, UpdatePlayerCardRequest } from "../api/contracts";
import { session, type PlayerCardState, type Session } from "../state/session";
import { resolveServerApi, type ProfileApi } from "./serverApi";

export type PlayerCardResult = { ok: true } | { ok: false; reason: PlayerCardFailureReason };

/**
 * 플레이어 카드(닉네임·한 줄 소개·테두리·UID)를 바꾸는 유일한 경계.
 *
 * 씬은 입력만 넘기고 검증·저장은 서버(`GameApi.updatePlayerCard`)가 끝낸다 — 닉네임 주기와
 * 시각도 서버 시계로 잰다. 이 매니저는 요청을 보내고 결과를 데이터로 돌려줄 뿐 상태를 직접 쓰지 않는다.
 */
export class PlayerCardManager {
  private readonly apiCache: { api?: ProfileApi } = {};
  constructor(private readonly state: Session = session, private readonly injectedApi?: ProfileApi) {}

  private get api(): ProfileApi { return resolveServerApi<ProfileApi>(this.state, this.injectedApi, this.apiCache); }

  get card(): Readonly<PlayerCardState> { return this.state.playerCard; }

  /** UID와 연구 개시일은 계정이 처음 설 때 서버가 한 번 정하고 그 뒤로 바뀌지 않는다. */
  async ensureIdentity(): Promise<void> {
    const card = this.state.playerCard;
    if (card.uid && card.createdAt) return;
    await this.api.updatePlayerCard({ kind: "identity" });
  }

  /** 다음에 닉네임을 바꿀 수 있는 시각. 지금 바꿀 수 있으면 `undefined`다. 표시용 조회라 화면 시계를 쓴다. */
  nicknameLockedUntil(now: Date = new Date()): Date | undefined {
    return nicknameLockedUntil(this.state.playerCard, now);
  }

  /** 닉네임은 이레에 한 번 바꾼다(처음 정하는 이름은 세지 않는다). 규칙은 서버가 지킨다. */
  setNickname(value: string): Promise<PlayerCardResult> { return this.send({ kind: "nickname", value }); }

  setBio(value: string): Promise<PlayerCardResult> { return this.send({ kind: "bio", value }); }

  /** 레벨·업적 조건을 충족한 테두리만 서버가 장착한다. */
  setFrame(id: string): Promise<PlayerCardResult> { return this.send({ kind: "frame", frameId: id }); }

  /** 프로필 사진은 보유한 렐릭의 얼굴만 고를 수 있다. */
  setAvatar(relicId: string): Promise<PlayerCardResult> { return this.send({ kind: "avatar", relicId }); }

  frames(): { frame: ProfileFrameDefinition; unlocked: boolean }[] {
    return PROFILE_FRAMES.map((frame) => ({ frame, unlocked: isProfileFrameUnlocked(frame, this.state.playerResearch.level, this.state.achievements?.claimed) }));
  }

  private async send(request: UpdatePlayerCardRequest): Promise<PlayerCardResult> {
    const result = await this.api.updatePlayerCard(request);
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  }
}

export const playerCardManager = new PlayerCardManager();
