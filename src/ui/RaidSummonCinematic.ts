import Phaser from "phaser";
import type { RaidDifficulty } from "../data/raid";
import { getRelic } from "../data/relics";
import { t } from "../i18n";
import { addBreakthroughBurst, breakthroughShardVector, burstDiamond } from "./breakthroughBurst";
import { ensureEffectTextures, EFFECT_TEXTURE } from "./effectTextures";
import { FaceFrame } from "./FaceFrame";
import { toPoints } from "./holo";
import { RAID_DIFFICULTY_TONE, RAID_SUMMON_INTENSITY, RAID_SUMMON_STAGE } from "./raidLayout";
import { COLOR, textStyle } from "./theme";

export interface RaidSummonCinematicOptions {
  bossRelicId: string;
  difficulty: RaidDifficulty;
  level: number;
  depth: number;
  /** 드러난 뒤 화면을 누르면 부른다. 연출이 스스로 닫히지 않는다 — 누가 나왔는지 읽을 틈을 준다. */
  onDone: () => void;
}

/**
 * 토벌권을 쓰는 순간의 연출 — **봉인이 모이고, 터지고, 보스가 드러난다.**
 *
 * 토벌권 한 장은 판 하나를 여는 값이라, 버튼 한 번에 목록만 한 줄 늘면 무엇을 치렀는지가 남지
 * 않는다. 세 걸음으로 끊는다:
 *
 * 1. **모임** — 화면이 가라앉고 가운데 납작한 마름모 봉인이 난이도의 색으로 조여 든다. 사방에서
 *    마름모 파편이 봉인으로 빨려 들고, 조금씩 떨린다.
 * 2. **터짐** — 한계 돌파와 같은 폭발(`addBreakthroughBurst` — 섬광·파문·위로 뜨는 파편)이 봉인
 *   자리에서 터진다.
 * 3. **드러남** — 보스의 얼굴 액자가 튀어나오고 그 아래 이름과 난이도·레벨이 선다.
 *
 * **어려운 판일수록 오래 모이고 세게 터진다**(`RAID_SUMMON_INTENSITY`). 화면 전체의 규칙은 그대로다 —
 * 동그라미가 아니라 마름모, 파편은 위로, 섬광은 옅게, 난수 없이.
 *
 * **손이 먼저면 기다리지 않는다.** 드러나기 전에 누르면 곧바로 드러난 자리로 가고, 드러난 뒤에
 * 누르면 닫힌다. 판이 떠 있는 동안 뒤 화면은 손을 받지 않는다(가장 위의 입력면이 막는다).
 */
export function playRaidSummonCinematic(scene: Phaser.Scene, options: RaidSummonCinematicOptions): void {
  ensureEffectTextures(scene);
  const { depth } = options;
  const camera = scene.cameras.main;
  const width = camera.width;
  const height = camera.height;
  const cx = width / 2;
  const cy = RAID_SUMMON_STAGE.centerY;
  const tone = RAID_DIFFICULTY_TONE[options.difficulty];
  const intensity = RAID_SUMMON_INTENSITY[options.difficulty];
  const root = scene.add.container(0, 0).setDepth(depth);

  const shade = scene.add.rectangle(cx, height / 2, width, height, COLOR.void, 0).setInteractive();
  root.add(shade);
  scene.tweens.add({ targets: shade, fillAlpha: 0.9, duration: 260, ease: "Sine.easeOut" });

  // 1. 모임 — 봉인이 조여 들고 파편이 빨려 든다.
  const seal = scene.add.graphics({ x: cx, y: cy });
  root.add(seal);
  const { radius, squash } = RAID_SUMMON_STAGE.seal;
  const sealState = { radius, spin: 0 };
  const drawSeal = (): void => {
    seal.clear();
    const life = 1 - (sealState.radius - radius * 0.28) / (radius * 0.72);
    seal.lineStyle(6, tone, 0.45 + 0.55 * life);
    seal.strokePoints(toPoints(burstDiamond(sealState.radius, squash)), true);
    seal.lineStyle(3, 0xffffff, 0.35 * life);
    seal.strokePoints(toPoints(burstDiamond(sealState.radius * 0.62, squash)), true);
    seal.fillStyle(tone, 0.12 + 0.3 * life);
    seal.fillPoints(toPoints(burstDiamond(sealState.radius * 0.62, squash)), true);
    seal.setAngle(sealState.spin);
  };
  drawSeal();
  const gather = scene.tweens.add({
    targets: sealState, radius: radius * 0.28, spin: 8, duration: intensity.charge, ease: "Cubic.easeIn",
    onUpdate: drawSeal,
  });
  const shards: Phaser.GameObjects.Image[] = [];
  for (let index = 0; index < intensity.shards; index += 1) {
    // 빨려 드는 파편도 고르게 나눈 방향에서 온다 — 한계 돌파의 부채꼴을 아래로 뒤집어 둘러 쓴다.
    const up = breakthroughShardVector(index, intensity.shards);
    const side = index % 2 === 0 ? 1 : -1;
    const from = { x: cx + up.x * 520 * side, y: cy + up.y * 420 * side };
    const piece = scene.add.image(from.x, from.y, EFFECT_TEXTURE.shard)
      .setTint(tone).setDisplaySize(34, 34).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    root.add(piece);
    shards.push(piece);
    scene.tweens.add({
      targets: piece, x: cx, y: cy, alpha: { from: 0.9, to: 0.2 }, angle: 180 * side,
      duration: intensity.charge * 0.8, delay: (intensity.charge * 0.2 * index) / intensity.shards, ease: "Cubic.easeIn",
    });
  }
  const tremble = scene.time.addEvent({
    delay: 60, repeat: Math.floor(intensity.charge / 60),
    callback: () => camera.shake(60, intensity.shake * 0.25),
  });

  let revealed = false;
  let finished = false;
  const reveal = (): void => {
    if (revealed) return;
    revealed = true;
    gather.stop();
    tremble.remove(false);
    seal.destroy();
    shards.forEach((piece) => piece.destroy());
    // 2. 터짐 — 한계 돌파와 같은 폭발을 난이도의 색으로.
    addBreakthroughBurst(scene, cx, cy, tone, depth + 1);
    camera.shake(320, intensity.shake);
    // 3. 드러남 — 얼굴 액자가 튀어나오고 이름·난이도가 그 아래 선다.
    const def = getRelic(options.bossRelicId);
    const face = new FaceFrame(scene, cx, cy, { portraitAssetId: def.portraitAssetId, size: RAID_SUMMON_STAGE.face, color: tone });
    face.setScale(0.3).setAlpha(0);
    root.add(face);
    scene.tweens.add({ targets: face, scale: 1, alpha: 1, duration: 420, ease: "Back.easeOut" });
    const name = scene.add.text(cx, RAID_SUMMON_STAGE.nameY, def.name, textStyle({ role: "display", size: 66 }))
      .setOrigin(0.5).setAlpha(0).setShadow(0, 4, "#000000", 8, false, true);
    const tag = scene.add.text(cx, RAID_SUMMON_STAGE.tagY, t("raid.summon.difficulty", { difficulty: t(`raid.difficulty.${options.difficulty}`), level: options.level }),
      textStyle({ role: "emphasis", size: 32, color: `#${tone.toString(16).padStart(6, "0")}` }))
      .setOrigin(0.5).setAlpha(0).setShadow(0, 3, "#000000", 6, false, true);
    root.add([name, tag]);
    scene.tweens.add({ targets: [name, tag], alpha: 1, y: "-=16", duration: 360, delay: 200, ease: "Cubic.easeOut" });
    // 누를 수 있는 곳이 화면 전체라는 말은 판 밖 밑동에서 한다 — 보상 영수증과 같은 양식이다.
    const hint = scene.add.text(cx, height - 130, t("reward.tapHint"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
      .setOrigin(0.5).setAlpha(0);
    root.add(hint);
    scene.tweens.add({ targets: hint, alpha: 0.72, duration: 300, delay: 700 });
  };
  const charge = scene.time.delayedCall(intensity.charge, reveal);

  shade.on("pointerup", () => {
    if (!revealed) { charge.remove(false); reveal(); return; }
    if (finished) return;
    finished = true;
    scene.tweens.add({ targets: root, alpha: 0, duration: 180, onComplete: () => { root.destroy(); options.onDone(); } });
  });
}
