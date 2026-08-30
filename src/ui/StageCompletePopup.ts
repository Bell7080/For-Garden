import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { getRelic } from "../data/relics";
import { relicProgression } from "../managers/RelicProgressionManager";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { drawGlyph } from "./glyphs";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { setDebugRewardPopup } from "../debug";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { loadOwnedPuppet } from "./statusPuppetLoad";

/** 결과 화면이 넘기는 편성원 한 명. MVP 여부만 알면 카드 크기·발광은 이 프리팹이 정한다. */
export interface StageCompleteFighter {
  relicId: string;
  isMvp: boolean;
}

export interface StageCompletePopupOptions {
  cheesecakeEarned: number;
  firstClear: boolean;
  /** 편성 순서 그대로 셋을 넘긴다. MVP 한 명만 가운데 크게 선다. */
  fighters: readonly StageCompleteFighter[];
  /** 그래프 팝업을 연 뒤 그 팝업이 닫히면 반드시 `onClosed`를 불러야 버튼이 다시 보인다. */
  onOpenContribution: (onClosed: () => void) => void;
  onConfirm?: () => void;
}

const WIDTH = 940;
const HEIGHT = 1200;
/**
 * MVP는 크게, 좌우 둘은 작게 — 가로 간격은 예전 카드 규격을 그대로 빌려 쓰고, 세로는 발끝이
 * 한 줄에 맞도록 SD 그림 높이만 다르게 잡는다. `groundY`가 모두 같은 값을 쓰는 이유다.
 */
const SD = { mvp: { width: 200, height: 300 }, side: { width: 150, height: 220 }, gap: 26, groundY: -30 };

/**
 * 스토리 스테이지 승리 결과.
 *
 * `RewardPopup`과 같은 계약(이미 지급 확정 · 화면 아무 곳이나 눌러 닫힘)을 따르는 연장선이다 —
 * 다만 보상 한 줄만으로는 그 판이 얼마나 잘 풀렸는지 보여줄 수 없어서, 위에 귀여운 승리 표제와
 * MVP 편성, 기여도 그래프 입구를 얹는다.
 */
export class StageCompletePopup {
  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  open(options: StageCompletePopupOptions): void {
    const cheesecake = Math.floor(options.cheesecakeEarned);
    let hint: Phaser.GameObjects.Text | undefined;
    /** Puppet은 컨테이너 변환을 물려받지 않으므로 원점(0,0)에 선 전용 레이어에 화면 좌표로 세운다. */
    let puppetLayer: Phaser.GameObjects.Container | undefined;
    const puppets = new Set<PuppetCreature>();
    let attackButton: Button | undefined;
    let disposed = false;
    setDebugRewardPopup(true, cheesecake > 0 ? 1 : 0, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 });
    this.popups.open({
      width: WIDTH, height: HEIGHT, dim: true, dimAlpha: 0.5,
      // 영수증과 같은 계약이라 팝업 안팎 어디를 눌러도 닫히고, 별도 닫기 버튼은 두지 않는다.
      closeOnBackdrop: true, hideCloseButton: true,
      onClose: () => {
        disposed = true;
        hint?.destroy();
        for (const puppet of puppets) { puppetLayer?.remove(puppet, false); puppet.destroy(); }
        puppets.clear();
        puppetLayer?.destroy(true);
        setDebugRewardPopup(false);
        options.onConfirm?.();
      },
    }, (body, close) => {
      // 기여도 그래프가 같은 popups 위에 한 겹 더 쌓이므로, 이 층의 깊이를 임의로 최상단에
      // 고정하지 않는다 — 고정하면 나중에 여는 팝업이 오히려 이 아래에 가려진다.
      // 배경 먼저 깔아 둬야 뒤에 얹는 카드·버튼이 topOnly 입력 우선순위로 자기 클릭만 받는다.
      const closeCatcher = this.scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff, 0).setInteractive({ useHandCursor: true });
      closeCatcher.on("pointerup", close);
      body.add(closeCatcher);

      this.buildTitle(body);
      // SD는 body 바깥, 팝업 층 바로 위에 화면 좌표로 세운다.
      puppetLayer = this.scene.add.container(0, 0).setDepth((body.parentContainer?.depth ?? 0) + 1);
      this.buildFighterPuppets(body, puppetLayer, puppets, () => disposed, options.fighters);
      attackButton = new Button(this.scene, 0, 90, {
        width: 360, height: 84, label: "공격 · 방어 · 회복", fontSize: 26,
        // 그래프를 보는 동안은 이 버튼이 뒤에서 겹쳐 눌리지 않도록 숨겼다가, 그래프를 닫으면
        // 다시 보여준다.
        onClick: () => { attackButton?.setVisible(false); options.onOpenContribution(() => { if (!disposed) attackButton?.setVisible(true); }); },
      });
      body.add(attackButton);
      body.add(drawHairline(this.scene, 0, 168, WIDTH - 140, { color: COLOR.accent, alpha: 0.3 }));
      this.buildReward(body, cheesecake, options.firstClear);

      // 팝업 밖(화면 고정 좌표)에 두되, 이 층 바로 위에만 머물게 한다 — 그래야 기여도 그래프가
      // 같은 popups 위에 한 겹 더 쌓여도 그 뒤로 가려지고, 새치기하듯 계속 앞에 남지 않는다.
      hint = this.scene.add
        .text(this.scene.scale.width / 2, this.scene.scale.height - 130, "화면을 눌러 확인", textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
        .setOrigin(0.5).setAlpha(0.62).setDepth((body.parentContainer?.depth ?? 0) + 1);
      hint.setShadow(0, 3, "#000000", 4, false, true);
    });
  }

  /** "Victory!"는 튀어 오르듯 한 번 확대했다 가라앉고, 양옆의 별 표식이 축하 인상을 더한다. */
  private buildTitle(body: Phaser.GameObjects.Container): void {
    const y = -HEIGHT / 2 + 108;
    const title = this.scene.add.text(0, y, "Victory!", textStyle({ role: "display", size: 64, color: COLOR.accentText })).setOrigin(0.5);
    title.setShadow(0, 4, "#000000", 6, false, true);
    title.setScale(0.5);
    this.scene.tweens.add({ targets: title, scale: 1.12, duration: 260, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: title, scale: 1, duration: 140, ease: "Sine.Out" }) });
    const starLeft = drawGlyph(this.scene, "bookmark", -title.width / 2 - 44, y, 40, COLOR.accent);
    const starRight = drawGlyph(this.scene, "bookmark", title.width / 2 + 44, y, 40, COLOR.accent);
    body.add([title, starLeft, starRight]);
  }

  /**
   * MVP는 가운데 크게, 나머지 둘은 옆에 작게 — 그리드 카드 대신 SD가 idle로 서 있는 편성을
   * 보여준다. Puppet은 컨테이너 변환을 물려받지 않으므로 `puppetLayer`(화면 좌표, body 밖)에
   * 세우고, 이름표·MVP 표식만 `body`(팝업 로컬 좌표)에 얹는다.
   */
  private buildFighterPuppets(
    body: Phaser.GameObjects.Container,
    puppetLayer: Phaser.GameObjects.Container,
    puppets: Set<PuppetCreature>,
    isDisposed: () => boolean,
    fighters: readonly StageCompleteFighter[],
  ): void {
    const centerIndex = fighters.findIndex((fighter) => fighter.isMvp);
    const order = centerIndex < 0 ? fighters : [...fighters.slice(0, centerIndex), ...fighters.slice(centerIndex + 1)];
    // 항상 [왼쪽 보조, MVP, 오른쪽 보조] 순서로 세워 MVP가 어느 슬롯에서 왔든 가운데 자리는 고정한다.
    const layout: Array<{ fighter: StageCompleteFighter; slot: "side" | "mvp" }> = centerIndex < 0
      ? fighters.map((fighter) => ({ fighter, slot: "side" as const }))
      : [{ fighter: order[0], slot: "side" }, { fighter: fighters[centerIndex], slot: "mvp" }, { fighter: order[1], slot: "side" }];

    const totalWidth = SD.side.width * 2 + SD.mvp.width + SD.gap * 2;
    const absGroundY = BASE_HEIGHT / 2 + SD.groundY;
    let x = -totalWidth / 2;
    layout.forEach(({ fighter, slot }) => {
      const size = slot === "mvp" ? SD.mvp : SD.side;
      const cx = x + size.width / 2;
      const absX = BASE_WIDTH / 2 + cx;
      const relic = getRelic(fighter.relicId);
      // 발밑 그림자는 카드 없이 서는 SD가 바닥에 붙어 보이게 하는 최소한의 장치다.
      puppetLayer.add(this.scene.add.ellipse(absX, absGroundY + 6, size.width * 0.6, size.width * 0.2, 0x000000, 0.32));
      void loadOwnedPuppet({
        spawn: () => spawnPuppet(this.scene, sdAssetFor(fighter.relicId), { x: absX, groundY: absGroundY, height: size.height }),
        isCurrent: () => !isDisposed(),
        isDisplayable: (puppet) => Boolean(puppet.active),
        adopt: (puppet) => { puppet.disableInteractive(); puppetLayer.add(puppet); puppets.add(puppet); },
      });
      const level = relicProgression.getProgress(relic.id).level;
      body.add(this.scene.add.text(cx, SD.groundY + 34, `Lv.${level}  ${relic.name}`, textStyle({ role: "emphasis", size: slot === "mvp" ? 24 : 19, color: slot === "mvp" ? COLOR.accentText : COLOR.ink })).setOrigin(0.5));
      if (slot === "mvp") this.buildMvpLabel(body, cx, SD.groundY - size.height - 26);
      x += size.width + SD.gap;
    });
  }

  /** "MVP!"는 승리 표제처럼 튀어 오르며 살짝 기울어져, 작은 글자여도 눈에 먼저 든다. */
  private buildMvpLabel(body: Phaser.GameObjects.Container, x: number, y: number): void {
    const label = this.scene.add.text(x, y, "MVP!", textStyle({ role: "display", size: 42, color: COLOR.accentText })).setOrigin(0.5).setAngle(-6);
    label.setStroke("#3b2408", 10);
    label.setShadow(0, 4, "#000000", 4, false, true);
    label.setScale(0.5);
    this.scene.tweens.add({ targets: label, scale: 1.18, duration: 260, ease: "Back.Out", delay: 120, onComplete: () => this.scene.tweens.add({ targets: label, scale: 1.04, duration: 140, ease: "Sine.Out" }) });
    body.add(label);
  }

  /** RewardPopup과 같은 액자 하나로, 지금은 치즈케이크 한 종류만 보여 준다. */
  private buildReward(body: Phaser.GameObjects.Container, cheesecake: number, firstClear: boolean): void {
    const y = 300;
    if (cheesecake <= 0) return;
    const size = 132;
    const frame = chipPoints(size, size, { bevel: { topLeft: size * 0.215, topRight: 0, bottomRight: size * 0.215, bottomLeft: 0 } });
    body.add(drawLayer(this.scene, 0, y, frame, { fill: 0x101722, alpha: 0.98 }));
    body.add(this.scene.add.image(0, y, "currency-cheesecake").setDisplaySize(size * 0.76, size * 0.76));
    body.add(drawInnerVignette(this.scene, 0, y, frame, { strength: 0.62 }));
    body.add(drawShapeOutline(this.scene, 0, y, frame, { color: COLOR.accent, alpha: 0.82, width: 3 }));
    const amount = this.scene.add.text(size / 2 - 11, y + size / 2 - 9, formatCurrency(cheesecake), textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(1, 1);
    amount.setStroke("#000000", 6); amount.setShadow(2, 3, "#000000", 2, false, true);
    body.add(amount);
    body.add(this.scene.add.text(0, y + size / 2 + 33, firstClear ? "최초 클리어 보상" : "반복 클리어 보상", textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
  }
}
