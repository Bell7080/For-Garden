import Phaser from "phaser";
import { GUILD_BADGE_COLORS, GUILD_BADGE_ICON_POINTS, GUILD_BADGE_SHAPE_POINTS, type BadgePoint, type GuildBadge } from "../core/guildBadge";

/** 뱃지 크기에 대한 비율. 내부 아이콘은 배경 안에 앉고, 배경은 두꺼운 잉크선·아이콘은 얇은 잉크선을 두른다. */
const BADGE_STYLE = { iconScale: 0.46, iconLift: 0.02, shapeInk: 0.035, iconInk: 0.025, shadow: 0.05, shadowAlpha: 0.5 } as const;

const scaled = (points: readonly BadgePoint[], radius: number, dy = 0): Phaser.Types.Math.Vector2Like[] =>
  points.map(([x, y]) => ({ x: x * radius, y: y * radius + dy }));

function polygon(graphics: Phaser.GameObjects.Graphics, points: Phaser.Types.Math.Vector2Like[], fill: number, ink: number, inkWidth: number): void {
  graphics.fillStyle(fill, 1).fillPoints(points, true);
  graphics.lineStyle(inkWidth, ink, 1).strokePoints(points, true, true);
}

/**
 * 길드 뱃지 한 장 — `src/core/guildBadge.ts`의 좌표표로 그린다. 이미지 파일이 없고, 길드 목록·정보·멤버 줄이 모두 이 한 장을 쓴다.
 * `size`는 뱃지가 차지하는 한 변이다. 같은 도형을 검게 한 겹 아래로 밀어 깔아 배경 원화 위에서도 윤곽이 서게 한다.
 */
export class GuildBadgeView extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, badge: GuildBadge, size: number) {
    super(scene, x, y);
    const radius = size / 2;
    const g = scene.add.graphics();
    const shape = scaled(GUILD_BADGE_SHAPE_POINTS[badge.shape], radius * 0.92);
    const offset = size * BADGE_STYLE.shadow;
    g.fillStyle(0x000000, BADGE_STYLE.shadowAlpha).fillPoints(shape.map((p) => ({ x: p.x! + offset * 0.4, y: p.y! + offset })), true);
    polygon(g, shape, GUILD_BADGE_COLORS[badge.shapeColor], 0x0a0e14, size * BADGE_STYLE.shapeInk);
    polygon(g, scaled(GUILD_BADGE_ICON_POINTS[badge.icon], radius * BADGE_STYLE.iconScale * 2 * 0.5, -size * BADGE_STYLE.iconLift), GUILD_BADGE_COLORS[badge.iconColor], 0x0a0e14, size * BADGE_STYLE.iconInk);
    this.add(g);
    this.setSize(size, size);
  }
}

export const addGuildBadge = (scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, badge: GuildBadge, size: number): GuildBadgeView => {
  const view = new GuildBadgeView(scene, x, y, badge, size);
  scene.add.existing(view);
  parent?.add(view);
  return view;
};
