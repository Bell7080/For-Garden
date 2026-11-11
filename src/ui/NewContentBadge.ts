import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { chipPoints, drawLayer } from "./holo";
import { NEW_BADGE } from "./newBadgeStyle";
import { COLOR, textStyle } from "./theme";

export interface NewBadgeOptions {
  /** 판 색. 기본은 강조색 — 레벨업 판처럼 잎마다 색이 다른 자리만 바꾼다. */
  tone?: number;
  /** 숨 쉬듯 부풀었다 줄고 모서리에 별이 반짝인다. 한 장 안에 여럿 서는 목록(레벨업 판)은 끈다. */
  pulse?: boolean;
  /** 판 기울기(도) — 기울어진 입구에 붙일 때 그 판과 같은 각도로 앉힌다. */
  angle?: number;
  /** 크기 배율. */
  scale?: number;
}

/**
 * 「NEW」 표식의 **유일한 프리팹**. 새로 열린 콘텐츠의 입구(로비·하단 탭·출격 판)와 레벨업 판의 새 잎이 같은 한 장을 쓴다 —
 * 화면마다 따로 그리면 같은 「새것」이 어디서는 판, 어디서는 글자로 선다.
 *
 * 붉은 점은 「받을 것이 있다」를 말하므로 겹치지 않게 다른 모양·다른 색(강조색 칩 + 검은 글자)으로 선다. 글자는 어느 언어에서나
 * 같은 `NEW`다 — 숫자처럼 읽히는 표식이라 언어마다 길이가 달라지면 칩 폭이 흔들린다.
 * 움직임 줄이기에서는 부풀지도 반짝이지도 않고 멈춘 채 선다.
 */
export function addNewBadge(scene: Phaser.Scene, x: number, y: number, options: NewBadgeOptions = {}): Phaser.GameObjects.Container {
  const S = NEW_BADGE;
  const badge = scene.add.container(x, y).setAngle(options.angle ?? 0);
  const inner = scene.add.container(0, 0);
  badge.add(inner);
  const tone = options.tone ?? COLOR.accent;
  inner.add(drawLayer(scene, 0, 0, chipPoints(S.width, S.height, { bevel: { topLeft: S.bevel, bottomRight: S.bevel } }), { fill: tone, alpha: 0.96, shadow: { x: 0, y: S.shadowY } }));
  inner.add(scene.add.text(0, 0, "NEW", textStyle({ role: "display", size: S.fontSize, color: "#05070a" })).setOrigin(0.5));
  badge.setScale(options.scale ?? 1);
  const moving = options.pulse !== false && motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  if (!moving) return badge;
  // 숨 — 크게 부풀지 않는다. 입구 글자보다 먼저 읽히면 표식이 아니라 소음이다.
  scene.tweens.add({ targets: inner, scale: S.pulseScale, duration: S.pulseMs, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  // 모서리의 네 갈래 별이 가끔 반짝인다. 겹쳐 밝아지는 합성은 밝은 원화 위에서 묻히므로 보통 합성으로 흰 별을 그린다.
  const star = scene.add.graphics({ x: S.width / 2 - 4, y: -S.height / 2 + 2 }).setAlpha(0);
  const r = S.starSize;
  star.fillStyle(0xffffff, 1);
  star.fillPoints([new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r * 0.22, -r * 0.22), new Phaser.Geom.Point(r, 0), new Phaser.Geom.Point(r * 0.22, r * 0.22), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r * 0.22, r * 0.22), new Phaser.Geom.Point(-r, 0), new Phaser.Geom.Point(-r * 0.22, -r * 0.22)], true);
  badge.add(star);
  scene.tweens.add({ targets: star, alpha: { from: 0, to: 1 }, scale: { from: 0.4, to: 1.1 }, angle: { from: 0, to: 45 }, duration: S.twinkleMs, yoyo: true, repeat: -1, repeatDelay: S.twinkleGapMs, ease: "Sine.easeOut" });
  badge.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf([inner, star]));
  return badge;
}

/**
 * 붙은 자리에서 톡 튀어나오며 선다 — 방금 풀린 자물쇠 뒤에 붙을 때 쓴다. 움직임 줄이기에서는 곧바로 선다.
 */
export function popInBadge(scene: Phaser.Scene, badge: Phaser.GameObjects.Container): void {
  if (motionPolicy(session.settings).nonEssentialDistanceFactor <= 0) return;
  const target = badge.scale;
  badge.setScale(target * 0.3).setAlpha(0);
  scene.tweens.add({ targets: badge, scale: target, alpha: 1, duration: NEW_BADGE.popMs, ease: "Back.easeOut" });
}
