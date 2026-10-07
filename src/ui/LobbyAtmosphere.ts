import Phaser from "phaser";
import { LOBBY_ATMOSPHERE, lobbyAtmospherePlan, moteFrequencyMs } from "../core/lobbyAtmosphere";
import { powerSavingPolicy } from "../core/settings";
import type { Element, Role } from "../core/types";
import { session } from "../state/session";
import { EFFECT_TEXTURE, ensureEffectTextures } from "./effectTextures";
import { skillArtTint } from "./skillArt";

/**
 * 로비의 역광 + 빛 알갱이.
 *
 * 값은 `core/lobbyAtmosphere.ts` 한 곳이 갖는다. 개체가 바뀌면 `setRelic`이 색만 갈아 끼우고
 * 아무것도 다시 굽거나 다시 읽지 않는다 — 그림은 이펙트가 이미 쓰는 흰 조각(`fx-glow`·`fx-shard`)이다.
 */
export class LobbyAtmosphere {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly motes?: Phaser.GameObjects.Particles.ParticleEmitter;
  private breath?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, depths: { glow: number; motes: number }) {
    ensureEffectTextures(scene);
    const { glow, motes } = LOBBY_ATMOSPHERE;
    const plan = lobbyAtmospherePlan({
      particleFactor: powerSavingPolicy(session.settings).decorativeParticleFactor,
      quality: session.settings.presentation.graphicsQuality,
      reduceMotion: session.settings.accessibility.reduceMotion,
    });
    // 겹쳐 밝아지는 합성이라 진하면 배경이 하얗게 뜬다. 알파가 곧 세기다.
    this.glow = scene.add.image(glow.x, glow.y, EFFECT_TEXTURE.glow)
      .setDisplaySize(glow.width, glow.height)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(glow.alpha)
      .setDepth(depths.glow);
    if (plan.breathing) {
      this.breath = scene.tweens.add({
        targets: this.glow,
        alpha: glow.alpha + glow.breathAlpha,
        duration: glow.breathMs,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
    if (plan.motes > 0) {
      this.motes = scene.add.particles(0, 0, EFFECT_TEXTURE.shard, {
        x: { min: motes.zone.x, max: motes.zone.x + motes.zone.width },
        y: { min: motes.zone.y, max: motes.zone.y + motes.zone.height },
        lifespan: { min: motes.lifeMs[0], max: motes.lifeMs[1] },
        speedY: { min: -motes.rise[1], max: -motes.rise[0] },
        speedX: { min: motes.drift[0], max: motes.drift[1] },
        scale: { min: motes.scale[0], max: motes.scale[1] },
        // 나타났다 사라지는 곡선: 가운데에서 가장 밝다.
        alpha: { onEmit: () => 0, onUpdate: (_p, _k, t: number) => Math.sin(t * Math.PI) * motes.alpha },
        rotate: { min: -20, max: 20 },
        blendMode: Phaser.BlendModes.ADD,
        frequency: moteFrequencyMs(plan.motes),
        maxAliveParticles: plan.motes,
      }).setDepth(depths.motes);
      // 처음부터 허공이 비어 있지 않게 한 바퀴 치 앞서 돌려 둔다.
      this.motes.fastForward(motes.lifeMs[0]);
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** 애착 렐릭이 바뀌면 속성·직군 혼합색으로 색만 갈아 끼운다. */
  setRelic(element: Element, role: Role): void {
    const tint = skillArtTint(element, role);
    this.glow.setTint(tint);
    this.motes?.setParticleTint(tint);
  }

  destroy(): void {
    this.breath?.stop();
    this.glow.destroy();
    this.motes?.destroy();
  }
}
