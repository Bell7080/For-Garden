import Phaser from "phaser";
import { drawLayer, slantedRect, toPoints } from "./holo";
import { COLOR, textStyle } from "./theme";

/**
 * 칸·팝업의 제목표.
 *
 * 제목은 판의 **윗변에 걸터앉는다.** 판 안으로 들여놓으면 아래 내용과 한 덩어리로 읽히고,
 * 어중간하게 띄우면 어느 판의 제목인지 흐려진다. 왼쪽의 짧은 빗금(`/`)이 제목을 판에 묶고,
 * 글자는 강조색으로 굵게 선다.
 *
 * 정보창의 칸 제목(유대·능력치·룬)과 팝업 머리글이 같은 모양을 쓰도록 여기 한 곳에서만
 * 그린다. 화면마다 제 나름의 제목을 만들면 같은 위계가 어디서는 판, 어디서는 맨 글자가 된다.
 */
export interface SectionTitleOptions {
  /** 글자 크기. 판의 높이도 이 값을 따라간다. */
  size?: number;
  /** 담을 컨테이너. 주지 않으면 씬에 바로 올린다. */
  parent?: Phaser.GameObjects.Container;
}

/** `x`는 제목표의 **왼쪽 끝**, `y`는 걸터앉을 변의 높이다. */
export function addSectionTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  options: SectionTitleOptions = {},
): Phaser.GameObjects.Container {
  const size = options.size ?? 34;
  const height = Math.round(size * 1.52);
  const label = scene.add
    .text(x + size, y, text, textStyle({ role: "display", size, color: COLOR.accentText }))
    .setOrigin(0, 0.5);
  const width = label.width + size * 1.82;
  const plate = drawLayer(scene, x + width / 2 + 8, y, slantedRect(width, height, Math.round(height * 0.3)), {
    fill: 0x05070a,
    alpha: 0.92,
    edge: COLOR.accent,
    edgeAlpha: 0.55,
  });
  // 빗금 하나. 제목이 판에서 떨어져 떠 보이지 않게 묶어 주는 표식이다.
  const bar = scene.add.graphics();
  bar.fillStyle(COLOR.accent, 0.95);
  bar.fillPoints(
    toPoints(slantedRect(Math.round(size * 0.26), Math.round(height * 0.69), Math.round(size * 0.2)))
      .map((point) => new Phaser.Geom.Point(point.x + x + size * 0.47, point.y + y)),
    true,
  );
  const title = scene.add.container(0, 0, [plate, bar, label]);
  options.parent?.add(title);
  return title;
}
