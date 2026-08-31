import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import type { CurrencyIconKey } from "./currencyIcons";
import { COLOR, textStyle } from "./theme";

/** 보상 액자의 상태색은 수령 가능/완료/진행 중을 카드와 같은 언어로 표현한다. */
export type RewardFrameState = "normal" | "claimable" | "claimed";

/** 아이콘을 액자 안에 두고 굵은 수량을 우하단에 겹치는 공용 보상 프리팹이다. */
export class RewardFrame extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, options: { icon: CurrencyIconKey; amount: number; size?: number; state?: RewardFrameState; /** 회색 연구 결과처럼 상태와 별개인 의미색을 주입한다. */ color?: number; onClick?: () => void }) {
    super(scene, x, y);
    scene.add.existing(this);
    const size = options.size ?? 128;
    const state = options.state ?? "normal";
    const color = options.color ?? (state === "claimable" ? COLOR.missionClaim : state === "claimed" ? 0x68717d : COLOR.accent);
    const frame = chipPoints(size, size, { bevel: { topLeft: size * 0.22, topRight: 0, bottomRight: size * 0.22, bottomLeft: 0 } });
    this.add(drawLayer(scene, 0, 0, frame, { fill: state === "claimed" ? 0x15191e : 0x101722, alpha: state === "claimed" ? 0.7 : 0.98 }));
    this.add(scene.add.image(0, 0, options.icon).setDisplaySize(size * 0.78, size * 0.78).setAlpha(state === "claimed" ? 0.38 : 1));
    this.add(drawInnerVignette(scene, 0, 0, frame, { strength: 0.62 }));
    this.add(drawShapeOutline(scene, 0, 0, frame, { color, alpha: state === "claimed" ? 0.42 : 0.9, width: state === "claimable" ? 4 : 3 }));
    // 수량은 아이콘과 분리된 정보가 되지 않도록 액자 모서리에 검은 외곽선과 함께 붙인다.
    const amount = scene.add.text(size / 2 - 8, size / 2 - 6, formatCurrency(options.amount), textStyle({ role: "display", size: Math.round(size * 0.23), color: state === "claimed" ? COLOR.inkDim : COLOR.accentText })).setOrigin(1, 1);
    amount.setStroke("#000000", 6); amount.setShadow(2, 3, "#000000", 2, false, true); this.add(amount);
    // 읽기 전용 결과도 눌림 확대 피드백은 유지하되 포인터 모양은 실제 행동이 있을 때만 바꾼다.
    {
      const hit = scene.add.rectangle(0, 0, size, size, 0xffffff, 0).setInteractive({ useHandCursor: !!options.onClick });
      hit.on("pointerdown", () => this.setScale(1.08)); hit.on("pointerout", () => this.setScale(1));
      hit.on("pointerup", () => { this.setScale(1); options.onClick?.(); }); this.add(hit);
    }
  }
}
