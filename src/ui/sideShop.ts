import Phaser from "phaser";
import { RailButton } from "./RailButton";

/**
 * 화면 곁에 붙는 **상점 아이콘** — 연구소·고고학·출격판이 같은 한 벌을 쓴다.
 *
 * 상점은 로비 레일의 상점과 **같은 아이콘 칩**(`RailButton`)이고 황금빛이다. 각 화면이 저마다
 * 둥근 알약·라벨 버튼·가방 아이콘으로 세우던 때는 같은 "사러 간다"가 화면마다 다른 조작으로
 * 읽혔다. 확률 정보는 이 칩 바로 아래에 청록 버튼(`addRatesButton` · `RATES_SPOT.screen`)으로 선다.
 */
export const SIDE_SHOP = {
  /** 연구소·고고학 — 화면 왼쪽 중상단. 두 화면이 같은 자리에 세운다. */
  screen: { x: 84, y: 430, size: 104 },
} as const;

export function addSideShopButton(scene: Phaser.Scene, x: number, y: number, size: number, label: string, onClick: () => void): RailButton {
  return new RailButton(scene, x, y, { icon: "shop", label, size, accent: true, onClick });
}
