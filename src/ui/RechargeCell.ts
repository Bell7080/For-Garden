import Phaser from "phaser";
import { formatCurrency } from "../core/formatCurrency";
import { Button } from "./Button";
import { chipPoints, drawLayer } from "./holo";
import { addFramedIcon } from "./itemFrame";
import { POPUP_BEVEL_RATIO, STAMINA_CELL } from "./staminaPopupLayout";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 충전 칸·충전 버튼 — 스테미나 창·결투 도전권 창·던전 횟수 창이 **같은 한 벌**을 쓴다.
 *
 * 예전에는 세 창이 공용 강조 버튼(어두운 판 + 금빛 윗줄)에 값만 얹어, 젬으로 사는 칸·광고 칸·병을 쓰는 칸이
 * 모두 같은 판이었고 버튼 안의 젬 그림과 수가 작아 「얼마를 치르나」가 먼저 읽히지 않았다. 이제 무엇으로
 * 채우는가(`RechargeKind`)가 판의 색을 정한다 — 쓰기는 호박, 젬은 청록, 광고는 보랏빛. 칸의 윗줄도 같은 색이라
 * 어느 칸이 어느 수단인지 그림보다 먼저 색이 말한다. 값의 그림·수는 버튼 글자보다 한 뼘 크다.
 */
export type RechargeKind = "use" | "gem" | "ad";

export const RECHARGE_TONE: Readonly<Record<RechargeKind, { accent: number; fill: number; text: string }>> = {
  use: { accent: 0xf2c25a, fill: 0x2b2008, text: "#ffe2a0" },
  gem: { accent: 0x5ad8e6, fill: 0x0a2830, text: "#b4f4fb" },
  ad: { accent: 0xb894ff, fill: 0x1f1538, text: "#ded0ff" },
};

/** 버튼 안 글자·값 그림의 크기. 칸이 작은 던전 창도 같은 비율로 줄여 쓴다. */
export const RECHARGE_BUTTON = { fontSize: 30, costIconScale: 1.4, compactFontSize: 26 } as const;

/** 값 수가 서는 색 — 판이 짙은 색이라 흰 글자가 가장 또렷하다. 모자라면 붉다. */
const VALUE_TONE = "#ffe9a3";

export interface RechargeButtonOptions {
  readonly kind: RechargeKind;
  readonly width: number;
  readonly height: number;
  /** 버튼 글자. 젬 칸은 비워 그림과 값만 세운다. */
  readonly label: string;
  readonly cost?: { amount: number; affordable: boolean };
  /** 라벨 왼쪽 그림(광고). */
  readonly art?: string;
  readonly enabled: boolean;
  readonly onClick: () => void;
  readonly fontSize?: number;
}

/** 충전 버튼 한 장. 판·윗줄·밑줄이 수단의 색으로 물든다. */
export function addRechargeButton(scene: Phaser.Scene, x: number, y: number, options: RechargeButtonOptions): Button {
  const tone = RECHARGE_TONE[options.kind];
  return new Button(scene, x, y, {
    width: options.width, height: options.height, label: options.label,
    fontSize: options.fontSize ?? RECHARGE_BUTTON.fontSize, variant: "primary",
    fill: tone.fill, accentColor: tone.accent, accentTextColor: tone.text, labelColor: tone.text,
    cost: options.cost ? { icon: "currency-gems", amount: options.cost.amount, affordable: options.cost.affordable, iconScale: RECHARGE_BUTTON.costIconScale } : undefined,
    art: options.art, artShadow: { x: 2, y: 4, alpha: 0.6 },
    onClick: options.onClick,
  }).setEnabled(options.enabled);
}

export interface RechargeCellView {
  readonly kind: RechargeKind;
  readonly texture?: string;
  /** 액자 우하단에 겹칠 보유 수. 광고처럼 가진 것이 없는 수단은 비운다. */
  readonly owned?: number;
  readonly gain: number;
  readonly name: string;
  readonly detail: string;
  readonly button: Omit<RechargeButtonOptions, "kind" | "width" | "height">;
}

/**
 * 충전 칸 한 장 — 액자 → 회복량 → 이름 → 남은 횟수 → 버튼(`STAMINA_CELL`).
 * 스테미나 창과 결투 도전권 창이 이 함수 하나로 칸을 세운다.
 */
export function addRechargeCell(scene: Phaser.Scene, x: number, y: number, size: { width: number; height: number }, view: RechargeCellView): Phaser.GameObjects.Container {
  const cell = scene.add.container(x, y);
  const { width, height } = size;
  const tone = RECHARGE_TONE[view.kind];
  const C = STAMINA_CELL;
  cell.add(drawLayer(scene, 0, 0, rechargePanelShape(width, height), { fill: 0x141a22, alpha: 0.94, edge: tone.accent, edgeAlpha: 0.7 }));
  if (view.texture) {
    // 칸 자체가 충전 버튼을 가진 자리라, 그림만 다른 창을 열면 한 칸이 두 가지 일을 한다.
    addFramedIcon(scene, cell, 0, C.frameY, C.frameSize, view.texture, { amount: view.owned === undefined ? undefined : formatCurrency(view.owned), plain: true });
  }
  // 회복량은 이 칸의 이유다. 이름보다 크게, 스테미나와 같은 색으로 세운다.
  cell.add(scene.add.text(0, C.gainY, `+${view.gain}`, textStyle({ role: "display", size: C.gainSize, color: VALUE_TONE })).setOrigin(0.5).setShadow(0, 3, "#05070a", 4, false, true));
  cell.add(squeezeTextToWidth(scene.add.text(0, C.nameY, view.name, textStyle({ role: "emphasis", size: C.nameSize })).setOrigin(0.5), width - C.padX * 2));
  if (view.detail) cell.add(squeezeTextToWidth(scene.add.text(0, C.detailY, view.detail, textStyle({ role: "body", size: C.detailSize, color: COLOR.inkDim })).setOrigin(0.5), width - C.padX * 2));
  cell.add(addRechargeButton(scene, 0, C.buttonY, { ...view.button, kind: view.kind, width: width - C.padX * 2, height: C.buttonHeight }));
  return cell;
}

/** 팝업 몸판과 같은 비율로 깎은 판. 충전 창 안의 모든 판과 칸이 이 한 함수를 쓴다. */
export function rechargePanelShape(width: number, height: number): number[] {
  const unit = Math.min(width, height) * POPUP_BEVEL_RATIO;
  return chipPoints(width, height, { bevel: { topLeft: unit, topRight: 0, bottomRight: unit, bottomLeft: 0 } });
}
