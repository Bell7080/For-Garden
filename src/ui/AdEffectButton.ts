import Phaser from "phaser";
import { AD_BUTTON_STYLE, AD_TONE } from "./adTone";
import { Button, primaryButtonGlowShape } from "./Button";
import { HoloBar, toPoints } from "./holo";
import { UI_ICON } from "./icons";
import { t } from "../i18n";

/** 광고를 보고 일정 시간 도는 효과를 켜는 버튼의 결. 자리·크기는 부르는 화면이 정하고 비율만 여기서 갖는다. */
export const AD_EFFECT_BUTTON = {
  fontSize: 24,
  subFontSize: 18,
  /** 버튼 밑변 아래 남은 시간 줄 — 판과 한 뼘 떼어 둔다. */
  gaugeGap: 14,
  gaugeHeight: 8,
  /** 효과가 도는 동안 판 뒤에서 숨 쉬는 빛. 겹쳐 밝아지는 합성이라 옅게만 오간다. */
  glow: { grow: 8, min: 0.08, max: 0.3, period: 1400 },
} as const;

export interface AdEffectButtonView {
  readonly label: string;
  readonly sub: string;
  readonly enabled: boolean;
  readonly active: boolean;
  /** 남은 시간의 몫(0~1). */
  readonly progress: number;
}

/**
 * 광고를 보고 효과를 켜는 버튼 한 장 — 발굴의 생산 가속·보관 늘리기가 쓴다.
 *
 * 판은 모든 광고 칸과 같은 와인빛(`AD_BUTTON_STYLE`)이고 라벨은 **효과와 지속 시간**(「보관량 ×2 · 16시간」)이다.
 * 광고를 본 뒤에는 같은 버튼이 「진행 중」 딱지를 달고, 아래 줄이 남은 시간으로 바뀌며, 밑변 아래 효과 색
 * 줄이 남은 몫만큼 줄어든다 — 효과가 켜졌다는 것을 버튼 옆의 작은 칩이 아니라 누른 그 자리가 말한다.
 * 효과가 켜졌다 꺼지는 순간에는 부르는 쪽이 새로 세운다(딱지는 세울 때만 붙는다). 남은 시간은 `update`로 갈아 끼운다.
 */
export class AdEffectButton extends Phaser.GameObjects.Container {
  private readonly button: Button;
  private readonly gauge?: HoloBar;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: { width: number; height: number; effectColor: number; view: AdEffectButtonView; reduceMotion: boolean; onClick: () => void }) {
    super(scene, x, y);
    const { width, height, view } = opts;
    const S = AD_EFFECT_BUTTON;
    if (view.active) {
      // 숨 쉬는 빛은 판 실루엣을 그대로 넓힌 모양이다 — 모양을 새로 지으면 깎인 모서리 밖으로 뿔이 선다.
      const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      glow.fillStyle(AD_TONE.accent, 1);
      glow.fillPoints(toPoints(primaryButtonGlowShape(width, height, { x: S.glow.grow, y: S.glow.grow })), true);
      glow.setAlpha(opts.reduceMotion ? S.glow.max * 0.7 : S.glow.min);
      this.add(glow);
      if (!opts.reduceMotion) scene.tweens.add({ targets: glow, alpha: S.glow.max, duration: S.glow.period, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    this.button = new Button(scene, 0, 0, {
      ...AD_BUTTON_STYLE, width, height, label: view.label, sub: view.sub,
      fontSize: S.fontSize, subFontSize: S.subFontSize,
      // 광고를 보고 받는 자리라는 것은 모든 광고 칸과 같은 그림이 말한다.
      art: UI_ICON.ad,
      ...(view.active ? { ribbon: t("excavation.ad.active") } : {}),
      onClick: opts.onClick,
    }).setEnabled(view.enabled);
    this.add(this.button);
    if (view.active) {
      // 남은 시간 줄 — 효과의 색(생산 청록·보관 보라)이라 위 보관 게이지의 늘어난 몫과 한 짝으로 읽힌다.
      this.gauge = new HoloBar(scene, 0, height / 2 + S.gaugeGap, width - height * 0.6, S.gaugeHeight, { color: opts.effectColor, trackAlpha: 0.8, outline: true, glow: { alpha: 0.35 } });
      for (const object of this.gauge.objects) this.add(object);
      this.gauge.setValue(view.progress);
    }
    scene.add.existing(this);
  }

  /** 초마다 남은 시간 줄과 아래 글만 갈아 끼운다 — 판·딱지는 다시 세우지 않는다. */
  update(view: Pick<AdEffectButtonView, "sub" | "progress">): void {
    this.button.setSub(view.sub);
    this.gauge?.setValue(view.progress);
  }

  setEnabled(enabled: boolean): this {
    this.button.setEnabled(enabled);
    return this;
  }
}
