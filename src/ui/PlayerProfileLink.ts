import Phaser from "phaser";
import { socialApi, socialProfileReachable, SocialApiError } from "../api/FakeSocialServer";
import { lastActiveAge, profileFriendAction, type FriendRelation, type ProfileFriendAction } from "../core/social";
import { t, type TextKey } from "../i18n";
import { loadPlayerProfileDisplay } from "../managers/PlayerProfileManager";
import { profileModifierManager } from "../managers/ProfileModifierManager";
import { friendProfileDisplay, playerProfileDisplay } from "../state/playerProfile";
import { session } from "../state/session";
import { pointInClip, type ClipRect } from "./clipRect";
import { showContentToast } from "./ContentToast";
import { sceneInfoManager } from "./info";
import { PlayerProfilePopup, type ProfileAction } from "./PlayerProfilePopup";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { logError } from "../managers/ErrorReporter";

/**
 * **순위·목록의 한 줄 → 그 사람의 플레이어 카드.**
 *
 * 결투장·아레나·고대 지층·원정·레이드·결투 상대·길드처럼 다른 연구원이 줄로 서는 화면은 모두 이 한 문을 지난다.
 * 카드는 친구 화면과 같은 한 장(`PlayerProfilePopup` + `friendProfileDisplay`)이고, 밑동에 친구 조작 한 칸이 선다
 * (관계마다 신청 · 수락 · 대기 중 · 이미 친구 — `profileFriendAction`). 내 줄은 내 카드를 읽기 전용으로 연다.
 * 관계는 화면이 기억하지 않고 서버(`socialApi.getProfile`)에서 매번 받아 온다.
 */
export interface PlayerProfileTarget {
  /** 서버 계정 id. 없거나 표본·NPC라 카드가 없으면 줄이 눌리지 않는다. */
  playerId?: string;
  isMe?: boolean;
}

/** 이 줄을 눌러 카드를 열 수 있는가. */
export function canOpenPlayerProfile(target: PlayerProfileTarget): boolean {
  return Boolean(target.isMe) || socialProfileReachable(target.playerId);
}

const FRIEND_ACTION_LABEL: Record<ProfileFriendAction, TextKey> = {
  request: "friends.card.request",
  accept: "friends.card.accept",
  pending: "friends.card.pending",
  friend: "friends.card.already",
};

const ERROR_KEY: Record<string, TextKey> = {
  FRIEND_LIMIT: "friends.error.friendLimit",
  REQUEST_LIMIT: "friends.error.requestLimit",
  ALREADY_FRIEND: "friends.error.alreadyFriend",
  ALREADY_REQUESTED: "friends.error.alreadyRequested",
  SELF_REQUEST: "friends.error.self",
};

/** 한 씬에서 카드를 여는 중이면 다음 누름을 버린다 — 서버 응답을 기다리는 동안의 연타가 카드를 두 장 세우지 않게. */
const BUSY = new WeakSet<Phaser.Scene>();

function lastActiveText(lastActiveAt: number, nowMs: number): string {
  const age = lastActiveAge(lastActiveAt, nowMs);
  return age.unit === "online" ? t("friends.age.online") : t(`friends.age.${age.unit}`, { value: age.value });
}

function errorMessage(error: unknown): string {
  const code = error instanceof SocialApiError ? error.code : undefined;
  return t(code && ERROR_KEY[code] ? ERROR_KEY[code] : "friends.error.gone");
}

/** 순위·목록 위에 그 사람의 카드를 겹쳐 연다. 닫으면 열려 있던 판으로 돌아간다. */
export async function openPlayerProfileCard(scene: Phaser.Scene, popups: PopupLayer, target: PlayerProfileTarget, instant = false): Promise<void> {
  if (BUSY.has(scene) || !canOpenPlayerProfile(target)) return;
  BUSY.add(scene);
  try {
    if (target.isMe) {
      const profile = await loadPlayerProfileDisplay(session).catch(() => playerProfileDisplay(session, profileModifierManager.equipped()));
      if (!scene.sys.isActive()) return;
      new PlayerProfilePopup(scene, popups, profile, () => undefined).open({ stacked: true, instant });
      return;
    }
    const entry = await socialApi.getProfile(target.playerId!);
    if (!scene.sys.isActive()) return;
    showOtherCard(scene, popups, target, entry.profile, entry.relation, entry.serverTime, instant);
  } catch (error) {
    if (!(error instanceof SocialApiError)) logError("profile.openFromList", "[profile] open card failed", error);
    if (scene.sys.isActive()) showContentToast(scene, errorMessage(error), "refused");
  } finally {
    BUSY.delete(scene);
  }
}

function showOtherCard(
  scene: Phaser.Scene, popups: PopupLayer, target: PlayerProfileTarget,
  profile: Awaited<ReturnType<typeof socialApi.getProfile>>["profile"], relation: FriendRelation, nowMs: number, instant: boolean,
): void {
  const action = profileFriendButton(scene, profile.id, relation, (next) => {
    // 같은 제목의 판을 닫고 곧바로 다시 여는 것이라 PopupLayer가 갈아 끼우기로 본다 — 새 관계의 버튼으로 선다.
    popup.close();
    showOtherCard(scene, popups, target, profile, next, nowMs, true);
  });
  const info = sceneInfoManager(scene, {
    key: `player-profile-${popups.baseDepth}`, context: "friend",
    baseDepth: popups.baseDepth + 200, portraitDepth: popups.baseDepth + 201,
  });
  const popup = new PlayerProfilePopup(scene, popups, friendProfileDisplay({ ...profile, lastActive: lastActiveText(profile.lastActiveAt, nowMs) }), () => undefined, undefined, {
    title: t(relation === "friend" ? "friends.profile" : "profile.title"),
    onFavorite: () => info.showFriend(profile.favoriteRelic),
    actions: [action],
    report: true,
  });
  popup.open({ stacked: true, instant });
}

/**
 * 카드 밑동의 친구 조작 한 칸 — 관계마다 신청 · 수락 · 대기 중 · 이미 친구. 길드원 카드도 같은 칸을 쓴다.
 * 누르면 서버가 관계를 바꾸고, 결과 한 줄을 토스트로 알린 뒤 `onChanged`가 새 관계로 카드를 다시 세운다.
 */
export function profileFriendButton(scene: Phaser.Scene, userId: string, relation: FriendRelation, onChanged: (next: FriendRelation) => void): ProfileAction {
  const friend = profileFriendAction(relation);
  return {
    label: t(FRIEND_ACTION_LABEL[friend.action]),
    icon: "friends",
    friend: true,
    disabled: !friend.enabled,
    onClick: () => {
      if (!friend.enabled || BUSY.has(scene)) return;
      BUSY.add(scene);
      const run = friend.action === "accept"
        ? socialApi.acceptRequest(userId).then(() => "friend" as FriendRelation)
        : socialApi.sendRequest(userId, session.playerCard.uid).then((result) => result.relation);
      void run.then((next) => {
        BUSY.delete(scene);
        if (!scene.sys.isActive()) return;
        showContentToast(scene, t(next === "friend" ? "friends.card.became" : "friends.card.sent"), "info");
        onChanged(next);
      }, (error: unknown) => {
        BUSY.delete(scene);
        if (!(error instanceof SocialApiError)) logError("profile.friendRequest", "[profile] friend request failed", error);
        if (scene.sys.isActive()) showContentToast(scene, errorMessage(error), "refused");
      });
    },
  };
}

/** 그 이용자와 나의 관계 — 카드를 열 수 없는 이용자거나 서버가 답하지 못하면 `null`(친구 칸을 세우지 않는다). */
export async function fetchFriendRelation(userId: string): Promise<FriendRelation | null> {
  if (!socialProfileReachable(userId)) return null;
  try { return (await socialApi.getProfile(userId)).relation; } catch { return null; }
}

/**
 * 줄 하나를 카드의 입구로 만든다. 줄 전체가 누르는 면이고, 스크롤되는 목록이면 `clip` 밖의 누름은 받지 않는다.
 * 끌어서 스크롤한 손은 화면의 끌기 경계(`installTapSlopGuard`)가 이미 걸러 준다. 카드가 없는 줄이면 아무것도 걸지 않는다.
 */
export function addPlayerProfileTap(
  scene: Phaser.Scene, row: Phaser.GameObjects.Container, width: number, height: number,
  popups: PopupLayer, target: PlayerProfileTarget, clip?: ClipRect,
): void {
  if (!canOpenPlayerProfile(target)) return;
  const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  row.addAt(hit, 0);
  const inside = (pointer: Phaser.Input.Pointer): boolean => !clip || pointInClip(clip, pointer.x, pointer.y);
  hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { if (inside(pointer)) pressIn(row); });
  hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
  hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
    pressOut(row);
    if (inside(pointer)) void openPlayerProfileCard(scene, popups, target);
  });
}
