import Phaser from "phaser";
import { t } from "../i18n";
import { motionPolicy } from "../core/settings";
import { playerExpBarSegments, PLAYER_LEVEL_CAP, type PlayerExpReceipt } from "../core/playerLevel";
import { findItem } from "../data/items";
import { session } from "../state/session";
import { chipPoints, drawLayer, drawShapeOutline, HoloBar } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { COLOR, textStyle } from "./theme";
import { PLAYER_EXP_ROW } from "./playerExpLayout";

/**
 * 연구원 경험치 **블록** — 이 판(또는 소탕)이 쓴 스테미나가 올린 몫이 차오른다.
 *
 * 경험치는 입장에서 이미 올랐지만(스테미나를 거기서 쓴다) 그것이 보이는 자리는 여기뿐이라, 입장
 * 전 값에서 시작해 입장 뒤 값까지 **줄이 차오르게** 그린다. 블록은 **가운데 정렬**이다 — 가운데 위에
 * 레벨 판, 그 아래 줄, 맨 아래 올린 몫. 레벨이 오르면 줄이 끝까지 찼다가 비워지며 레벨 판이 튀어
 * 오르고, 그 순간 판 옆에 「LEVEL UP!」과 줄 오른쪽 끝에 받은 병(`levelUpItems`)이 액자로 선다.
 *
 * 결과판(`StageCompletePopup`)은 기여도 버튼과 보상 줄 사이에, 소탕 영수증(`RewardPopup`)은 제 판
 * 머리에 같은 블록을 세운다. 자리는 `PLAYER_EXP_ROW` 한 표가 갖는다. 움직임 줄이기에서는 차오르지
 * 않고 끝난 모습으로 선다.
 */
export function addPlayerExpGainRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, receipt: PlayerExpReceipt): void {
  const L = PLAYER_EXP_ROW;
  const block = scene.add.container(0, y);
  body.add(block);

  // 레벨 판 — 판 한 장 + 강조색 외곽선. 「LV」는 작게, 수는 크게 한 덩어리로 가운데에 선다.
  const badge = scene.add.container(0, L.badge.y);
  const shape = chipPoints(L.badge.width, L.badge.height, { bevel: { topLeft: 14, topRight: 0, bottomRight: 14, bottomLeft: 0 } });
  badge.add(drawLayer(scene, 0, 0, shape, { fill: 0x1d1a12, alpha: 0.96, edge: COLOR.accent, edgeAlpha: 0.9 }));
  badge.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.55, width: 2 }));
  const lvLabel = scene.add.text(0, 2, "LV", textStyle({ role: "emphasis", size: L.badge.labelSize, color: COLOR.inkDim })).setOrigin(0, 0.5);
  const levelText = scene.add.text(0, 0, "", textStyle({ role: "display", size: L.badge.size, color: COLOR.accentText })).setOrigin(0, 0.5)
    .setShadow(0, 3, "#000000", 4, false, true);
  badge.add([lvLabel, levelText]);
  const setLevel = (level: number): void => {
    levelText.setText(String(level));
    const total = lvLabel.width + 6 + levelText.width;
    lvLabel.setX(-total / 2);
    levelText.setX(-total / 2 + lvLabel.width + 6);
  };
  setLevel(receipt.before.level);
  block.add(badge);

  const bar = new HoloBar(scene, 0, 0, L.bar.width, L.bar.height, { color: COLOR.accent, trackAlpha: 0.85, outline: true, ticks: 9 }).addTo(block);
  const value = scene.add.text(L.bar.width / 2, L.value.y, expValueLabel(receipt.before), textStyle({ role: "body", size: L.value.size, color: COLOR.inkDim })).setOrigin(1, 0.5);
  block.add(value);
  block.add(scene.add.text(0, L.gain.y, `+${receipt.granted.toLocaleString()} EXP`, textStyle({ role: "display", size: L.gain.size, color: COLOR.ink }))
    .setOrigin(0.5).setShadow(0, 3, "#000000", 4, false, true));

  const segments = playerExpBarSegments(receipt);
  bar.setValue(segments[0]?.from ?? 0);
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor === 0;

  /** 레벨이 처음 오르는 순간 한 번만 — 표제와 받은 병이 선다. */
  let announced = false;
  const announce = (): void => {
    if (announced || receipt.levelsGained <= 0) return;
    announced = true;
    const label = scene.add.text(L.badge.width / 2 + L.levelUp.gap, L.levelUp.y, "LEVEL UP!", textStyle({ role: "display", size: L.levelUp.size, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setAngle(-4);
    label.setStroke("#3b2408", 8);
    label.setShadow(0, 3, "#000000", 3, false, true);
    block.add(label);
    const reward = receipt.levelUpItems[0];
    const item = reward ? findItem(reward.itemId) : undefined;
    const holder = item?.icon.kind === "asset"
      ? addFramedIcon(scene, block, L.reward.x, 0, L.reward.size, item.icon.key, { amount: `×${reward.quantity}` })
      : undefined;
    if (still) return;
    label.setScale(0.4);
    scene.tweens.add({ targets: label, scale: 1, duration: 280, ease: "Back.Out" });
    if (holder) {
      holder.setScale(0.3).setAlpha(0);
      scene.tweens.add({ targets: holder, scale: 1, alpha: 1, duration: 320, ease: "Back.Out", delay: 80 });
    }
  };

  const finish = (): void => {
    bar.setValue(segments[segments.length - 1]?.to ?? 1);
    setLevel(receipt.after.level);
    value.setText(expValueLabel(receipt.after));
    announce();
  };
  if (still || segments.length === 0) { finish(); return; }

  // 구간을 차례로 채운다. 한 구간이 끝까지 차면(= 레벨업) 레벨 판이 튀고 다음 구간은 빈 줄에서 시작한다.
  const run = (index: number): void => {
    if (!block.active) return;
    const segment = segments[index];
    if (!segment) { finish(); return; }
    const counter = { ratio: segment.from };
    const duration = Math.max(L.minSegmentMs, L.fullSegmentMs * Math.abs(segment.to - segment.from));
    scene.tweens.add({
      targets: counter, ratio: segment.to, duration, delay: index === 0 ? L.startDelayMs : 0, ease: index === segments.length - 1 ? "Cubic.Out" : "Sine.In",
      onUpdate: () => { if (block.active) bar.setValue(counter.ratio); },
      onComplete: () => {
        if (!block.active) return;
        const next = segments[index + 1];
        if (next) {
          setLevel(next.level);
          scene.tweens.add({ targets: badge, scale: { from: 1.3, to: 1 }, duration: 260, ease: "Back.Out" });
          announce();
          bar.setValue(next.from);
        } else {
          value.setText(expValueLabel(receipt.after));
        }
        run(index + 1);
      },
    });
  };
  // 첫 구간의 기다림은 씬 시계가 아니라 트윈의 `delay`가 맡는다 — 결과판이 서는 전투 화면은 판이
  // 끝나면 씬 시계를 쓰지 않아 `delayedCall`이 깨어나지 않는다(줄이 멈춘 채로 남았다).
  run(0);
}

/** 줄 위의 `현재 / 요구` — 만렙은 한 마디다. */
function expValueLabel(progress: PlayerExpReceipt["after"]): string {
  if (progress.level >= PLAYER_LEVEL_CAP) return "MAX";
  return t("profile.exp.value", { current: progress.experience.toLocaleString(), total: progress.experienceToNext.toLocaleString() });
}
