import Phaser from "phaser";
import { t } from "../i18n";
import type { Element, Role } from "../core/types";
import { ELEMENT_ADVANTAGE_MULTIPLIER, ELEMENT_DISADVANTAGE_MULTIPLIER } from "../core/element";
import { AffinityBadge } from "./AffinityBadge";
import { AFFINITY_GLOW, ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import {
  elementChartEdges,
  elementChartNodes,
  elementStrongAgainst,
  elementWeakTo,
} from "./elementChart";
import { drawLayer, slantedRect } from "./holo";
import { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/** 배율은 표에서 온다. 화면이 1.25·0.8을 손으로 적으면 상성을 고친 날 그 글자만 남는다. */
const MULTIPLIER = {
  strong: ELEMENT_ADVANTAGE_MULTIPLIER.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""),
  weak: ELEMENT_DISADVANTAGE_MULTIPLIER.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""),
} as const;

/** 상성표 한 장. 오각형 하나에 열 관계가 다 들어간다. */
const CHART = { width: 700, height: 800, radius: 212, icon: 92, centerY: 26 } as const;
/** 속성 쪽지. 아이콘·이름 아래로 유리·불리 두 줄이 선다. */
const DETAIL = { width: 620, height: 520, icon: 128, rowIcon: 70 } as const;
const ROLE_NOTE = { width: 600, height: 430, icon: 128 } as const;

/**
 * 속성 상성표.
 *
 * **다섯이 오각형으로 서고 화살표가 이기는 쪽을 가리킨다.** 표로 적으면 열 줄을 읽고 머릿속에
 * 다시 그려야 하지만, 고리 하나면 "내 옆을 이기고 건너편에 진다"가 한눈에 들어온다. 바깥
 * 테두리와 안쪽 별의 순서는 순수 규칙(`elementChart.ts`)이 정하고 화면은 그리기만 한다.
 */
export function openElementChartPopup(scene: Phaser.Scene, popups: PopupLayer, anchor?: { x: number; y: number }): void {
  popups.open(
    { width: CHART.width, height: CHART.height, title: t("affinity.chart"), closeOnBackdrop: true, ...(anchor ? { anchor } : {}) },
    (body) => {
      const nodes = elementChartNodes(CHART.radius);
      const at = (element: Element) => nodes.find((node) => node.element === element)!;
      const lines = scene.add.graphics({ x: 0, y: CHART.centerY });
      body.add(lines);
      // 선을 먼저 다 긋고 아이콘을 그 위에 얹는다 — 순서가 뒤바뀌면 화살표가 얼굴을 가로지른다.
      for (const edge of elementChartEdges()) {
        drawAffinityArrow(lines, at(edge.from), at(edge.to), CHART.icon / 2 + 12, edge.outer);
      }
      for (const node of nodes) {
        body.add(new AffinityBadge(scene, node.x, node.y + CHART.centerY, ELEMENT_ICON[node.element], CHART.icon, 0.55));
        body.add(scene.add
          .text(node.x, node.y + CHART.centerY + CHART.icon * 0.62, t(`element.${node.element}`), textStyle({ role: "display", size: 26, color: COLOR.ink }))
          .setOrigin(0.5)
          .setShadow(0, 3, "#05070a", 5, false, true));
        // 꼭짓점을 누르면 그 속성의 쪽지가 위에 한 겹 더 열린다.
        const hit = scene.add.rectangle(node.x, node.y + CHART.centerY, CHART.icon, CHART.icon, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => openElementPopup(scene, popups, node.element));
        body.add(hit);
      }
    },
  );
}

/**
 * 속성 하나의 쪽지 — 아이콘·이름·유리·불리.
 *
 * 전투에서 아군이든 적이든 속성 표식을 누르면 여기로 온다. 상성표 전체를 띄우지 않는 이유는,
 * 그 손이 알고 싶은 것은 **지금 이 개체**가 무엇에 강하고 무엇에 약한가이기 때문이다.
 */
export function openElementPopup(scene: Phaser.Scene, popups: PopupLayer, element: Element, anchor?: { x: number; y: number }): void {
  const tone = AFFINITY_GLOW[ELEMENT_ICON[element]];
  popups.open(
    { width: DETAIL.width, height: DETAIL.height, title: t(`element.${element}`), closeOnBackdrop: true, ...(anchor ? { anchor } : {}) },
    (body) => {
      body.add(new AffinityBadge(scene, 0, -DETAIL.height / 2 + 132, ELEMENT_ICON[element], DETAIL.icon, 0.55));
      addAffinityRow(scene, body, 46, t("affinity.strong", { multiplier: MULTIPLIER.strong }), tone, elementStrongAgainst(element));
      addAffinityRow(scene, body, 176, t("affinity.weak", { multiplier: MULTIPLIER.weak }), COLOR.danger, elementWeakTo(element));
    },
  );
}

/**
 * 직군 하나의 쪽지.
 *
 * **숨은 보정치를 말하지 않는다** — 직군은 데이터 태그일 뿐이라(`docs/combat-affinities.md`),
 * 여기 적는 것은 그 자리가 전장에서 무엇을 하는 자리인가까지다. 실제 성능은 능력치와 스킬이
 * 정하고 그것들은 제 칸이 이미 말하고 있다.
 */
export function openRolePopup(scene: Phaser.Scene, popups: PopupLayer, role: Role, anchor?: { x: number; y: number }): void {
  popups.open(
    { width: ROLE_NOTE.width, height: ROLE_NOTE.height, title: t(`role.${role}`), closeOnBackdrop: true, ...(anchor ? { anchor } : {}) },
    (body) => {
      body.add(new AffinityBadge(scene, 0, -ROLE_NOTE.height / 2 + 136, ROLE_ICON[role], ROLE_NOTE.icon, 0.55));
      body.add(scene.add
        .text(0, 78, t(`role.desc.${role}`), textStyle({ role: "body", size: 26, color: COLOR.ink, align: "center", wrap: ROLE_NOTE.width - 120 }))
        .setOrigin(0.5));
    },
  );
}

/** 유리·불리 한 줄. 이름표가 왼쪽, 그 관계의 속성 둘이 오른쪽에 선다. */
function addAffinityRow(
  scene: Phaser.Scene,
  body: Phaser.GameObjects.Container,
  y: number,
  label: string,
  tone: number,
  elements: readonly Element[],
): void {
  const width = DETAIL.width - 96;
  body.add(drawLayer(scene, 0, y, slantedRect(width, 104, 18), { fill: 0x0d131b, alpha: 0.92, edge: tone, edgeAlpha: 0.8, edgeWidth: 4 }));
  body.add(scene.add
    .text(-width / 2 + 28, y, label, textStyle({ role: "display", size: 26, color: `#${tone.toString(16).padStart(6, "0")}` }))
    .setOrigin(0, 0.5));
  elements.forEach((element, index) => {
    const x = width / 2 - 40 - (elements.length - 1 - index) * (DETAIL.rowIcon + 18);
    body.add(new AffinityBadge(scene, x, y, ELEMENT_ICON[element], DETAIL.rowIcon, 0.5));
  });
}

/**
 * 이기는 쪽을 가리키는 화살표.
 *
 * 꼭짓점 한가운데가 아니라 아이콘 **밖**에서 시작해 밖에서 끝난다 — 중심끼리 이으면 선이
 * 얼굴 위를 지난다. 머리는 둥글리지 않고 각진 삼각형이라 화면의 다른 아이콘과 결이 같다.
 */
function drawAffinityArrow(
  graphics: Phaser.GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  inset: number,
  outer: boolean,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const start = { x: from.x + ux * inset, y: from.y + uy * inset };
  const end = { x: to.x - ux * inset, y: to.y - uy * inset };
  // 바깥 고리가 먼저 읽혀야 한다. 안쪽 별은 같은 관계의 나머지 절반이라 옅게 깐다.
  const alpha = outer ? 0.85 : 0.34;
  const head = outer ? 20 : 15;
  graphics.lineStyle(outer ? 4 : 3, COLOR.accent, alpha);
  graphics.lineBetween(start.x, start.y, end.x - ux * head * 0.8, end.y - uy * head * 0.8);
  graphics.fillStyle(COLOR.accent, alpha);
  graphics.fillPoints([
    new Phaser.Geom.Point(end.x, end.y),
    new Phaser.Geom.Point(end.x - ux * head + uy * head * 0.46, end.y - uy * head - ux * head * 0.46),
    new Phaser.Geom.Point(end.x - ux * head - uy * head * 0.46, end.y - uy * head + ux * head * 0.46),
  ], true);
}
