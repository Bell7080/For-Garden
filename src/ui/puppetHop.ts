import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import type { PuppetCreature } from "../puppets/assets";

/**
 * 통통 튀는 배치 모션 — **발굴과 파견이 나눠 쓰는 한 규칙.**
 *
 * 올라갈 때 감속하고 내려올 때 가속하는 포물선이라야 착지가 보인다. 좌우로 같은 이징을
 * 되감으면(`yoyo`) 내려오는 동안에도 느려져 뛰는 것이 아니라 땅으로 가라앉는 것처럼 읽힌다.
 *
 * 칸마다 다른 대기·쉼을 주어 셋이 한 몸처럼 동시에 뛰지 않는다 — 같은 박자로 뛰면 캐릭터가
 * 아니라 판 하나가 흔들리는 것으로 보인다.
 */
export const PUPPET_HOP = { rise: 42, duration: 460, delays: [180, 570, 930], rests: [520, 780, 640] } as const;

/**
 * 세워 둔 SD 한 마리를 제자리에서 뛰게 한다.
 *
 * Puppet은 Mesh라 원점이 이미지 한가운데다. 세울 때 쓰는 `groundY`는 발끝이므로 그 값으로
 * y를 움직이면 캐릭터가 제 키의 절반만큼 땅으로 꺼진다 — 지금 서 있는 y를 기준으로만 띄운다.
 *
 * 전체 움직임 감소에서는 거리를 줄이고 무한 반복을 없앤다. 되돌려 받는 tween은 부르는 쪽이
 * 붙잡아 두었다가 SD를 버릴 때 함께 멈춘다.
 *
 * **한 번만 뛸 수도 있다**(`once`). 세워 두는 내내 뛰면 그 움직임이 "지금 무슨 일이 일어났다"를
 * 말하지 못한다 — 교류 파견은 자리를 고르는 동안에는 가만히 서 있고, 보내는 순간에만 한 번
 * 뛰어 배웅한다.
 */
export function startPuppetHop(scene: Phaser.Scene, puppet: PuppetCreature, index: number, options: { once?: boolean } = {}): Phaser.Tweens.Tween {
  const motion = motionPolicy(session.settings);
  const restY = puppet.y;
  const hop = { progress: 0 };
  return scene.tweens.add({
    targets: hop, progress: 1, ease: "Linear",
    duration: PUPPET_HOP.duration + index * 40,
    delay: PUPPET_HOP.delays[index % PUPPET_HOP.delays.length],
    repeat: options.once || motion.nonEssentialRepeatFactor === 0 ? 0 : -1,
    repeatDelay: PUPPET_HOP.rests[index % PUPPET_HOP.rests.length],
    onUpdate: () => { puppet.y = restY - PUPPET_HOP.rise * motion.nonEssentialDistanceFactor * (1 - (2 * hop.progress - 1) ** 2); },
    // 쉬는 동안에는 정확히 제자리에 서 있어야 다음 도약이 바닥에서 시작한다.
    onRepeat: () => { puppet.y = restY; },
    onComplete: () => { puppet.y = restY; },
  });
}
