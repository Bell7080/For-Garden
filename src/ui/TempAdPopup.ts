import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { t } from "../i18n";
import { LUKA_SD_ASSET, LEXIA_SD_ASSET, TORIKA_SD_ASSET, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import { chipPoints, drawLayer, HoloBar } from "./holo";
import { UI_ICON } from "./icons";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { COLOR, textStyle } from "./theme";

/** 실제 광고 SDK가 붙기 전까지 광고 자리를 메우는 임시 팝업의 값. */
export const TEMP_AD = {
  seconds: 3,
  depth: 6000,
  dimAlpha: 0.82,
  card: { width: 820, height: 760 },
  bar: { width: 620, height: 34 },
  sdHeight: 230,
} as const;

/**
 * 광고 SDK 대신 서는 임시 광고 팝업. 루카·토리카·렉시아 SD가 뽀용뽀용 뛰는 동안 게이지가 3초에 걸쳐 차고,
 * 다 차면 「광고 보상 받기!」 버튼이 뜬다. 버튼을 누르면 true, 씬이 닫히면 false로 끝난다.
 * 게이지는 씬 타이머가 아니라 실제 시계로 잰다 — 바쁜 기기에서 프레임이 밀려도 3초는 3초다.
 */
export function playTempAdPopup(scene: Phaser.Scene): Promise<boolean> {
  return new Promise((resolve) => {
    const cx = BASE_WIDTH / 2;
    const cy = BASE_HEIGHT / 2;
    const { card, bar: barSize } = TEMP_AD;
    const dim = scene.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x000000, TEMP_AD.dimAlpha).setOrigin(0).setInteractive();
    const panel = scene.add.container(cx, cy);
    panel.add(drawLayer(scene, -card.width / 2, -card.height / 2, chipPoints(card.width, card.height, { bevel: { topLeft: 56, bottomRight: 56 } }), { fill: COLOR.panel, alpha: 0.96, shadow: true }));
    const adIcon = scene.add.image(-card.width / 2 + 90, -card.height / 2 + 90, UI_ICON.ad).setDisplaySize(84, 84);
    const title = scene.add.text(30, -card.height / 2 + 90, t("ad.temp.title"), textStyle({ role: "display", size: 46, color: COLOR.ink })).setOrigin(0.5);
    const bar = new HoloBar(scene, 0, 150, barSize.width, barSize.height, { color: COLOR.accent, trackAlpha: 0.86, outline: true, shadow: { offsetX: 3, offsetY: 6, alpha: 0.6 }, glow: { spread: 8, alpha: 0.22 } }).addTo(panel);
    bar.setValue(0);
    const percent = scene.add.text(0, 150 + 62, "0%", textStyle({ role: "emphasis", size: 34, color: COLOR.accentText })).setOrigin(0.5);
    panel.add([adIcon, title, percent]);
    // 팝업이 톡 튀어나온다.
    panel.setScale(0.8).setAlpha(0);
    const root = scene.add.container(0, 0, [dim, panel]).setDepth(TEMP_AD.depth).setScrollFactor(0);
    scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: "Back.Out" });
    scene.scene.bringToTop();

    // SD 셋이 뽀용뽀용 뛴다. 늦게 도착한 개체는 이미 닫힌 뒤면 곧바로 버린다.
    const puppets: PuppetCreature[] = [];
    const hops: Phaser.Tweens.Tween[] = [];
    const shadows: Phaser.GameObjects.Container[] = [];
    let done = false;
    const sdY = cy - 40;
    [LUKA_SD_ASSET, TORIKA_SD_ASSET, LEXIA_SD_ASSET].forEach((asset, index) => {
      const x = cx + (index - 1) * 230;
      void spawnPuppet(scene, asset, { x, groundY: sdY + (index === 0 ? 20 : 0), height: TEMP_AD.sdHeight, depth: TEMP_AD.depth + 2 }).then((puppet) => {
        if (done) { puppet.destroy(); return; }
        puppet.disableInteractive();
        puppets.push(puppet);
        const shadow = addSdFootShadow(scene, x, sdY + (index === 0 ? 20 : 0), 150).setDepth(TEMP_AD.depth + 1);
        shadows.push(shadow);
        hops.push(startPuppetHop(scene, puppet, index));
      }).catch(() => undefined);
    });

    const finish = (claimed: boolean): void => {
      if (done) return;
      done = true;
      clearInterval(timer);
      hops.forEach((hop) => hop.stop());
      puppets.forEach((puppet) => puppet.destroy());
      shadows.forEach((shadow) => shadow.destroy(true));
      claimButton?.destroy();
      root.destroy(true);
      resolve(claimed);
    };

    let claimButton: Button | undefined;
    const showClaim = (): void => {
      percent.setText(t("ad.temp.done"));
      claimButton = new Button(scene, cx, cy + 270, { width: 560, height: 120, label: t("ad.temp.claim"), variant: "primary", fontSize: 40, onClick: () => finish(true) });
      claimButton.setDepth(TEMP_AD.depth + 3).setScale(0.4).setAlpha(0);
      scene.tweens.add({
        targets: claimButton, scale: 1, alpha: 1, duration: 320, ease: "Back.Out",
        // 눌러 달라고 숨 쉬듯 볼록거린다.
        onComplete: () => { if (!done && claimButton) scene.tweens.add({ targets: claimButton, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" }); },
      });
    };

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / (TEMP_AD.seconds * 1000));
      bar.setValue(ratio);
      percent.setText(`${Math.floor(ratio * 100)}%`);
      if (ratio >= 1) { clearInterval(timer); showClaim(); }
    }, 33);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => finish(false));
  });
}
