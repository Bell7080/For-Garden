import Phaser from "phaser";
import { t } from "../i18n";
import { audioManager } from "../managers/AudioManager";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { playerProfileDisplay, profileAvatarContent } from "../state/playerProfile";
import type { ArenaRoom } from "../core/liveArena";
import type { ArenaSeenRecord } from "../core/arenaNotice";
import { getRelic } from "../data/relics";
import type { PortraitAssetId } from "../core/types";
import { ARENA_TONE } from "./arenaTheme";
import { ARENA_RESULT as L, arenaResultActionY, arenaResultTeamX } from "./arenaResultLayout";
import { Button } from "./Button";
import { addDuelStandingRow } from "./DuelStandingRow";
import { FaceFrame } from "./FaceFrame";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { ProfileAvatar } from "./ProfileAvatar";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

export type ArenaResultOutcome = "win" | "loss" | "draw";

/** 한 편 — 얼굴과 이름, 그 판에 세운 세 렐릭(모르면 비운다). */
export interface ArenaResultSide {
  name: string;
  picks: readonly string[];
  /** 내 편이면 프로필 얼굴(테두리)로, 상대면 첫 렐릭의 얼굴 액자로 선다. */
  profile?: { frameId: string; portraitAssetId?: PortraitAssetId; fallback: string };
}

export interface ArenaResultOptions {
  outcome: ArenaResultOutcome;
  ranked: boolean;
  /** 결과판 없이 끝난 판을 로비가 뒤늦게 알릴 때. 표제 위 칩이 「지난 판 결과」로 바뀐다. */
  notice?: boolean;
  reason?: "combat" | "timeout" | "forfeit";
  me: ArenaResultSide;
  foe?: ArenaResultSide;
  /** 랭크전 RP 변화. 없으면 RP 블록을 세우지 않는다. */
  standing?: { before: number; after: number; streakBonus: number; winStreak: number };
  /** 가장 많이 기여한 내 렐릭 — 그 얼굴 위에 MVP가 선다. */
  mvpRelicId?: string;
  onContribution?: (onClosed: () => void) => void;
  /** 친선전 다시 하기 — 같은 상대·같은 편성으로 곧바로. */
  onRematch?: () => void;
  onClose: () => void;
}

/**
 * 아레나 결과판 — 랭크전·친선전·로비의 「지난 판 결과」가 같은 한 장을 쓴다.
 *
 * 수집형 대전 결과의 문법을 따른다: 크게 터지는 승패 표제와 그 뒤를 가로지르는 빗금 띠, 두 편이 마주 보는 VS 줄,
 * 그 아래 RP 변화(결투장 결과판과 같은 휘장·게이지 블록). 고를 것이 없는 영수증이라 화면 어디를 눌러도 닫히고
 * 판 안 X는 두지 않는다 — 닫는 길의 안내는 화면 밑동에 선다(`StageCompletePopup`과 같은 계약).
 */
export function openArenaResultPopup(scene: Phaser.Scene, popups: PopupLayer, options: ArenaResultOptions): void {
  const win = options.outcome === "win", loss = options.outcome === "loss";
  const tone = win ? ARENA_TONE.accent : loss ? ARENA_TONE.ban : 0x8a8fa8;
  const toneText = win ? ARENA_TONE.accentText : loss ? ARENA_TONE.banText : COLOR.ink;
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;
  if (!options.notice) audioManager?.playSfx(loss ? "battle.defeat" : "battle.victory");
  else audioManager?.playUi(loss ? "ui.deny" : "ui.reward");
  let hint: Phaser.GameObjects.Text | undefined;
  let chosen = false;
  popups.open({
    width: L.width, height: L.height, dim: true, dimAlpha: loss ? 0.76 : 0.56, accent: tone, fill: ARENA_TONE.panel,
    closeOnBackdrop: true, hideCloseButton: true,
    onClose: () => { hint?.destroy(); if (!chosen) options.onClose(); },
  }, (body, close) => {
    const closeCatcher = scene.add.rectangle(0, 0, L.width, L.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    closeCatcher.on("pointerup", close);
    body.add(closeCatcher);
    paintBanner(scene, body, options, tone, toneText, still);
    paintVersus(scene, body, options, still);
    if (options.standing) addDuelStandingRow(scene, body, L.standing.y, { scoreBefore: options.standing.before, scoreAfter: options.standing.after, streakBonus: options.standing.streakBonus, winStreak: options.standing.winStreak, track: "arena" });
    else if (!options.ranked) body.add(scene.add.text(0, L.friendly.y, t("arena.result.friendlyNotice"), textStyle({ role: "body", size: L.friendly.font, color: COLOR.inkDim, align: "center", wrap: L.width - 140 })).setOrigin(0.5));
    const actions: { label: string; primary?: boolean; run: () => void }[] = [];
    let contribution: Button | undefined;
    if (options.onContribution) actions.push({ label: t("stageComplete.contribution"), run: () => { contribution?.setVisible(false); options.onContribution!(() => contribution?.setVisible(true)); } });
    if (options.onRematch) actions.push({ label: t("arena.result.rematch"), primary: true, run: () => { chosen = true; close(); options.onRematch!(); } });
    actions.forEach((action, index) => {
      const button = new Button(scene, 0, arenaResultActionY(index), {
        width: L.actions.width, height: L.actions.height, label: action.label, fontSize: 28,
        ...(action.primary ? { variant: "primary" as const, fill: ARENA_TONE.confirm } : {}),
        accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, onClick: action.run,
      });
      if (index === 0 && options.onContribution) contribution = button;
      body.add(button);
    });
    hint = scene.add.text(scene.scale.width / 2, scene.scale.height - L.hintFromBottom, t("stageComplete.tapToConfirm"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5).setAlpha(0.62).setDepth((body.parentContainer?.depth ?? 0) + 1).setShadow(0, 3, "#000000", 4, false, true);
  });
}

/** 모드 칩 · 빗금 띠 위의 큰 표제 · 끝난 사유. 이기면 튀어 오르고, 지면 위에서 내려앉는다. */
function paintBanner(scene: Phaser.Scene, body: Phaser.GameObjects.Container, options: ArenaResultOptions, tone: number, toneText: string, still: boolean): void {
  const B = L.banner;
  const modeLabel = options.notice ? t("arena.result.lastMatch") : options.ranked ? t("arena.room.ranked") : t("arena.room.friendly");
  body.add(drawLayer(scene, 0, L.mode.y, chipPoints(L.mode.width + 80, L.mode.height, { bevel: { topLeft: 14, topRight: 0, bottomRight: 14, bottomLeft: 0 } }), { fill: ARENA_TONE.deep, alpha: 0.9, edge: ARENA_TONE.accent, edgeAlpha: 0.9 }));
  const mode = scene.add.text(0, L.mode.y, modeLabel, textStyle({ role: "emphasis", size: L.mode.font, color: ARENA_TONE.accentText })).setOrigin(0.5);
  squeezeTextToWidth(mode, L.mode.width + 50);
  body.add(mode);
  // 표제 뒤를 판 밖까지 가로지르는 띠 — 승리는 보라, 패배는 붉은빛. 판보다 넓게 그려 몸판 밖으로 비어져 나온다.
  const stripe = scene.add.container(0, B.y);
  stripe.add(drawLayer(scene, 0, 0, slantedRect(B.stripe, B.height, 70), { fill: tone, alpha: 0.32, shadow: false }));
  stripe.add(drawLayer(scene, 0, 0, slantedRect(B.stripe, B.height * 0.56, 70), { fill: tone, alpha: 0.42, shadow: false }));
  stripe.add(scene.add.rectangle(0, -B.height / 2, B.stripe, 4, tone, 0.9));
  stripe.add(scene.add.rectangle(0, B.height / 2, B.stripe, 4, tone, 0.9));
  body.add(stripe);
  const word = options.outcome === "win" ? "VICTORY" : options.outcome === "loss" ? "DEFEAT" : "DRAW";
  const title = scene.add.text(0, B.y - 12, word, textStyle({ role: "display", size: B.font, color: toneText })).setOrigin(0.5);
  title.setStroke("#0b0418", 12).setShadow(0, 6, "#000000", 8, false, true);
  body.add(title);
  const sub = scene.add.text(0, B.y + B.height / 2 - 18, options.outcome === "win" ? t("arena.result.winLabel") : options.outcome === "loss" ? t("arena.result.lossLabel") : t("arena.result.drawLabel"), textStyle({ role: "emphasis", size: 26, color: COLOR.ink })).setOrigin(0.5);
  sub.setStroke("#0b0418", 6);
  body.add(sub);
  if (!still) {
    stripe.setScale(0.2, 1).setAlpha(0);
    scene.tweens.add({ targets: stripe, scaleX: 1, alpha: 1, duration: 300, ease: "Cubic.Out" });
    if (options.outcome === "loss") {
      title.setY(B.y - 52).setAlpha(0);
      scene.tweens.add({ targets: title, y: B.y - 12, alpha: 1, duration: 420, ease: "Bounce.Out", delay: 120 });
    } else {
      title.setScale(0.4).setAlpha(0);
      scene.tweens.add({ targets: title, scale: 1.14, alpha: 1, duration: 280, ease: "Back.Out", delay: 120, onComplete: () => scene.tweens.add({ targets: title, scale: 1, duration: 160, ease: "Sine.Out" }) });
    }
  }
  const reason = options.reason === "forfeit" || options.reason === "timeout"
    ? (options.outcome === "win" ? t("arena.result.foeForfeit") : options.outcome === "loss" ? t("arena.result.selfForfeit") : undefined)
    : undefined;
  if (reason) body.add(scene.add.text(0, L.reason.y, reason, textStyle({ role: "body", size: L.reason.font, color: ARENA_TONE.sparkText, align: "center", wrap: L.reason.wrap })).setOrigin(0.5));
}

/** 두 편이 마주 보는 줄 — 왼쪽이 나(초록 이름), 오른쪽이 상대(붉은 이름), 가운데 VS. 아래에 그 판의 세 자리 얼굴. */
function paintVersus(scene: Phaser.Scene, body: Phaser.GameObjects.Container, options: ArenaResultOptions, still: boolean): void {
  const V = L.versus;
  const sides: { side: ArenaResultSide | undefined; x: number; color: string; won: boolean; mine: boolean }[] = [
    { side: options.me, x: -V.sideX, color: ARENA_TONE.allyText, won: options.outcome === "win", mine: true },
    { side: options.foe, x: V.sideX, color: ARENA_TONE.foeText, won: options.outcome === "loss", mine: false },
  ];
  if (!options.foe) {
    // 상대를 모르는 알림(오래전 판 등)은 나만 가운데에 세운다.
    sides.splice(1, 1);
    sides[0].x = 0;
  } else {
    const vs = scene.add.text(0, V.y, "VS", textStyle({ role: "display", size: V.vsFont, color: ARENA_TONE.sparkText })).setOrigin(0.5).setAngle(-8);
    vs.setStroke("#0b0418", 10).setShadow(0, 5, "#000000", 6, false, true);
    body.add(vs);
  }
  for (const { side, x, color, won, mine } of sides) {
    if (!side) continue;
    const firstPick = side.picks[0];
    if (side.profile) {
      body.add(new ProfileAvatar(scene, x, V.y, { size: V.avatar, frameId: side.profile.frameId, portraitAssetId: side.profile.portraitAssetId, fallback: side.profile.fallback }));
    } else if (firstPick) {
      body.add(new FaceFrame(scene, x, V.y, { portraitAssetId: getRelic(firstPick).portraitAssetId, size: V.avatar, color: mine ? ARENA_TONE.ally : ARENA_TONE.foe }));
    }
    const name = scene.add.text(x, V.y + V.nameY, side.name, textStyle({ role: "display", size: V.nameFont, color })).setOrigin(0.5).setShadow(0, 3, "#000000", 0, true, true);
    squeezeTextToWidth(name, V.sideX * 2 - 180);
    body.add(name);
    // 이긴 편 얼굴 위의 작은 「WIN」 딱지 — 승패가 표제만이 아니라 얼굴에도 붙어 누가 이겼는지 한눈에 읽힌다.
    if (won) {
      const tag = scene.add.text(x, V.y + V.crownY, "WIN", textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(0.5).setAngle(-6);
      tag.setStroke(mine ? "#0f4d2c" : "#5a0d22", 8);
      body.add(tag);
      if (!still) { tag.setScale(0.4); scene.tweens.add({ targets: tag, scale: 1, duration: 260, ease: "Back.Out", delay: 360 }); }
    }
    side.picks.slice(0, 3).forEach((relicId, index, list) => {
      const fx = x + arenaResultTeamX(index, list.length), fy = L.team.y + V.nameY - 14;
      body.add(new FaceFrame(scene, fx, fy, { portraitAssetId: getRelic(relicId).portraitAssetId, size: L.team.frame, color: mine ? ARENA_TONE.ally : ARENA_TONE.foe }));
      if (mine && relicId === options.mvpRelicId) {
        const mvp = scene.add.text(fx, fy - L.team.frame / 2 - 6, "MVP", textStyle({ role: "display", size: 24, color: ARENA_TONE.accentText })).setOrigin(0.5).setAngle(-6);
        mvp.setStroke("#0b0418", 7);
        body.add(mvp);
      }
    });
  }
}

/** 내 편 — 프로필 얼굴·이름에 그 판의 세 자리. */
export function arenaResultMe(picks: readonly string[]): ArenaResultSide {
  const profile = playerProfileDisplay(session);
  return { name: profile.displayName, picks, profile: { frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId, fallback: profileAvatarContent(profile, () => false).fallback } };
}

/** 끝난 방에서 결과판의 두 편·승패·사유를 읽는다. */
export function arenaResultFromRoom(room: ArenaRoom, playerId: string): Pick<ArenaResultOptions, "outcome" | "ranked" | "reason" | "me" | "foe"> {
  const side = Math.max(0, room.players.findIndex((p) => p.id === playerId));
  const foe = room.players[1 - side];
  return {
    outcome: room.winner === null || room.winner === undefined ? "draw" : room.winner === side ? "win" : "loss",
    ranked: room.ranked,
    ...(room.reason ? { reason: room.reason } : {}),
    me: arenaResultMe(room.picks[side].map((p) => p.relicId)),
    ...(foe ? { foe: { name: foe.name, picks: room.picks[1 - side].map((p) => p.relicId) } } : {}),
  };
}

/** 지금 계정의 아레나 전적 기록(`core/arenaNotice.ts`) — UID가 없으면(첫 실행) 기록하지 않는다. */
export function arenaSeenFor(status: { score: number; wins: number; losses: number }): ArenaSeenRecord | null {
  const owner = session.playerCard.uid;
  return owner ? { owner, score: status.score, wins: status.wins, losses: status.losses } : null;
}
