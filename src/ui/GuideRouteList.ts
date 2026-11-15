import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { GUIDE_ROUTE_DESTINATION, guideRouteParams, type GuideDestination, type GuideRouteId } from "../data/guideRoutes";
import { followGuideDestination, guideDestinationUsable, type GuideNavigator } from "./guideNavigation";
import { chipPoints, drawLayer, HoloBar, slantedRect } from "./holo";
import { drawGlyph } from "./glyphs";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 재화·아이템 안내창의 「획득처」·「사용처」 줄 — **한 장**이다.
 *
 * 재화 창·아이템 창·스테미나 창이 같은 줄을 저마다 그리던 때는 글자 크기가 22·23px로 갈렸고, 갈 곳이 있어도
 * 손이 닿을 길이 없었다. 지금은 줄마다 빗금 표식 + 문장이 서고, 갈 곳이 있는 줄은 오른쪽 끝에 화살표 칩이
 * 서며 **줄 전체가 눌린다**(작은 칩만 누르게 하면 손가락이 문장을 누르고 아무 일도 없다).
 */
export const GUIDE_ROUTE_ROW = {
  /** 줄 하나의 높이 — 누르는 면이라 손가락 한 마디보다 크게. */
  height: 54,
  text: 26,
  bullet: { width: 8, height: 24, x: 14 },
  textX: 34,
  arrow: { width: 58, height: 40 },
} as const;

export interface GuideRouteListOptions {
  readonly x: number;
  /** 첫 줄의 가운데 y. */
  readonly y: number;
  readonly width: number;
  readonly routes: readonly GuideRouteId[];
  readonly navigator: GuideNavigator;
  /** 화살표를 누르면 안내창을 먼저 닫는다. */
  readonly close: () => void;
  readonly rowHeight?: number;
  readonly textSize?: number;
}

/** 줄 문장 — 문구 표의 문장에 그 규칙을 가진 상수의 수를 채운다. */
export function guideRouteText(id: GuideRouteId): string {
  // 수는 천 단위로 끊는다(`젬 2000` → `젬 2,000`) — 화면의 다른 값과 같은 모양으로 읽힌다.
  const params = Object.fromEntries(Object.entries(guideRouteParams(id)).map(([key, value]) => [key, typeof value === "number" ? value.toLocaleString() : value]));
  return t(`guide.route.${id}` as TextKey, params);
}

/** 줄을 세우고, 세운 높이를 돌려준다. */
export function addGuideRouteList(scene: Phaser.Scene, body: Phaser.GameObjects.Container, options: GuideRouteListOptions): number {
  const rowHeight = options.rowHeight ?? GUIDE_ROUTE_ROW.height;
  const textSize = options.textSize ?? GUIDE_ROUTE_ROW.text;
  options.routes.forEach((id, index) => {
    const y = options.y + index * rowHeight;
    const destination = GUIDE_ROUTE_DESTINATION[id];
    const usable = guideDestinationUsable(options.navigator, destination);
    const row = scene.add.container(options.x, y);
    body.add(row);
    const half = options.width / 2;
    if (usable) {
      // 갈 수 있는 줄은 옅은 유리면을 깔아 「눌리는 줄」로 읽히게 한다.
      row.add(drawLayer(scene, 0, 0, chipPoints(options.width, rowHeight - 8, { bevel: { topLeft: 10, topRight: 0, bottomRight: 10, bottomLeft: 0 } }), { fill: 0x18222e, alpha: 0.72, shadow: false }));
    }
    const { bullet } = GUIDE_ROUTE_ROW;
    row.add(drawLayer(scene, -half + bullet.x, 0, slantedRect(bullet.width, bullet.height, 4), { fill: COLOR.accent, alpha: 0.85, shadow: false }));
    const arrowRoom = usable ? GUIDE_ROUTE_ROW.arrow.width + 16 : 8;
    const text = scene.add.text(-half + GUIDE_ROUTE_ROW.textX, 0, guideRouteText(id), textStyle({ role: "body", size: textSize, color: COLOR.ink })).setOrigin(0, 0.5);
    shrinkTextToWidth(text, options.width - GUIDE_ROUTE_ROW.textX - arrowRoom);
    row.add(text);
    if (!usable) return;
    const { arrow } = GUIDE_ROUTE_ROW;
    const arrowX = half - arrow.width / 2 - 6;
    const chip = scene.add.container(arrowX, 0);
    chip.add(drawLayer(scene, 0, 0, chipPoints(arrow.width, arrow.height, { bevel: { topLeft: 10, topRight: 0, bottomRight: 10, bottomLeft: 0 } }), { fill: COLOR.accent, alpha: 0.9, shadow: false }));
    chip.add(drawGlyph(scene, "page-next", -6, 0, 24, 0x1a1206, 1, 4));
    chip.add(drawGlyph(scene, "page-next", 8, 0, 24, 0x1a1206, 0.55, 4));
    row.add(chip);
    const hit = scene.add.rectangle(0, 0, options.width, rowHeight - 4, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(chip));
    hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(chip); follow(options, destination as GuideDestination); });
    row.add(hit);
  });
  return options.routes.length * rowHeight;
}

function follow(options: GuideRouteListOptions, destination: GuideDestination): void {
  // 안내창을 닫고 나서 옮긴다 — 창이 열린 채 씬이 바뀌면 닫는 연출이 다음 화면 첫 프레임에 남는다.
  options.close();
  followGuideDestination(options.navigator, destination);
}

/** 「획득처」·「사용처」·「효과」 제목줄 — 세 창이 같은 크기·같은 강조선으로 세운다. 줄 윗변 y를 받는다. */
export function addGuideSectionHeader(scene: Phaser.Scene, body: Phaser.GameObjects.Container, y: number, width: number, title: string, size = 30): void {
  body.add(scene.add.text(-width / 2, y + size / 2, title, textStyle({ role: "display", size, color: COLOR.accentText })).setOrigin(0, 0.5));
  new HoloBar(scene, 0, y + size + 12, width, 5, { color: COLOR.accent, trackAlpha: 0.5 }).addTo(body).setValue(1);
}
