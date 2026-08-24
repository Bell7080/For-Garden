import Phaser from "phaser";
import type { Stats } from "../core/types";
import { STAT_RADAR_MAX } from "../config/statRadar";
import { combatPower } from "../core/combatPower";
import { COLOR, textStyle } from "./theme";

/** 레이더에 표시하는 축은 항상 같은 순서와 상한을 사용한다. */
const AXES = [
  ["hp", "체력"], ["def", "방어"], ["res", "저항"], ["atk", "공격"], ["ap", "주문"],
] as const;

/**
 * 축 이름의 크기와 색.
 *
 * 정보창처럼 그래프가 주인공인 자리에서는 축 이름이 곧 "무엇을 보는 그래프인지"를 말한다.
 * 그래서 굵게 키우고 능력치마다 색을 준다. 팝업처럼 곁들이로 놓일 때는 기본값(작고 흐린
 * 회색)이라 그래프 면을 방해하지 않는다.
 */
export interface StatRadarLabelStyle {
  size?: number;
  /** 축별 색(`#rrggbb`). 주지 않은 축은 기본 회색이다. */
  colors?: Partial<Record<(typeof AXES)[number][0], string>>;
  /** 축 이름 아래에 그 축의 실제 수치도 적는다. 축 이름과 같은 색을 쓴다. */
  values?: boolean;
  /**
   * 면 한가운데에 전투력을 옅게 깐다.
   *
   * 숫자를 판 위에 따로 세우지 않는 이유는, 전투력이 곧 이 면의 넓이이기 때문이다. 면 안에
   * 반투명하게 누워 있으면 면이 넓은 개체일수록 숫자도 함께 크고 진하게 읽힌다.
   */
  power?: boolean;
}

/** 정규화된 오각형 능력치 레이더 그래프 Phaser prefab이다. */
export class StatRadar extends Phaser.GameObjects.Container {
  private readonly graph: Phaser.GameObjects.Graphics;
  /** 축 이름 아래의 수치. 켜 두지 않으면 만들지 않는다. */
  private readonly valueTexts: Phaser.GameObjects.Text[] = [];
  /** 면 안에 옅게 눕는 전투력. */
  private readonly powerText?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, radius = 112, label: StatRadarLabelStyle = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.graph = scene.add.graphics();
    this.add(this.graph);

    if (label.power) {
      // 면보다 먼저 그린다. 면의 채움이 숫자 위로 덮여야 숫자가 면 **안에** 잠긴 것처럼 보인다.
      this.powerText = scene.add
        .text(0, 0, "", textStyle({ role: "display", size: Math.round(radius * 0.32), color: COLOR.accentText }))
        .setOrigin(0.5)
        .setAlpha(0.32);
      // 그래프보다 **아래**에 깐다. 면의 채움이 숫자 위로 덮여야 숫자가 면 안에 잠긴다.
      this.addAt(this.powerText, 0);
    }

    // 축 라벨은 그래프 밖으로 일정하게 밀어 최대 자릿수 숫자와 겹치지 않게 한다.
    AXES.forEach(([key, name], index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      const color = label.colors?.[key];
      const size = label.size ?? 17;
      const style = color
        ? textStyle({ role: "display", size, color })
        : textStyle({ role: "body", size, color: COLOR.inkDim });
      const lx = Math.cos(angle) * (radius + 31);
      const ly = Math.sin(angle) * (radius + 25);
      this.add(scene.add.text(lx, ly, name, style).setOrigin(0.5));
      if (!label.values) return;
      // 수치는 축 이름보다 **한 칸 더 바깥**에 같은 색으로 선다. "아래"로 밀면 위쪽 축의 수가
      // 그래프 면 안으로 들어가 선과 겹친다. 바깥으로 밀면 어느 축이든 면을 건드리지 않는다.
      const valueStyle = color
        ? textStyle({ role: "display", size: Math.round(size * 0.9), color })
        : textStyle({ role: "display", size: Math.round(size * 0.9), color: COLOR.ink });
      // 이름 위아래로 쌓는다. 옆으로 밀면 이름과 수가 한 줄에 붙어 "방어228"처럼 읽히고,
      // 바깥으로만 밀면 옆 축에서는 그게 곧 옆으로 미는 것과 같다. 맨 위 축만 위로 올린다.
      const step = size + 8;
      this.valueTexts.push(this.addValue(scene, lx, ly + (index === 0 ? -step : step), valueStyle));
    });
    this.draw({ hp: 0, def: 0, res: 0, atk: 0, ap: 0 } as Stats, radius);
  }

  /** 수치 한 칸. 어두운 그림자를 깔아 그래프 선 위에서도 획이 묻히지 않게 한다. */
  private addValue(scene: Phaser.Scene, x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const text = scene.add.text(x, y, "", style).setOrigin(0.5).setShadow(2, 4, "#05070a", 5, false, true);
    this.add(text);
    return text;
  }

  /** 각 수치를 공용 상한으로 제한·정규화한 뒤 비교 가능한 면을 그린다. */
  draw(stats: Stats, radius = 112): void {
    this.graph.clear();
    const point = (index: number, scale: number) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      return new Phaser.Math.Vector2(Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale);
    };
    for (const scale of [1, 0.5]) {
      const ring = AXES.map((_, index) => point(index, scale));
      this.graph.lineStyle(2, COLOR.panelEdge, 0.65).strokePoints(ring, true);
    }
    AXES.forEach((_, index) => this.graph.lineBetween(0, 0, point(index, 1).x, point(index, 1).y));
    const ratios = AXES.map(([key]) => Math.min(1, Math.max(0, stats[key] / STAT_RADAR_MAX[key])));
    const values = ratios.map((ratio, index) => point(index, ratio));
    this.graph.fillStyle(COLOR.accent, 0.24).fillPoints(values, true);
    this.graph.lineStyle(3, COLOR.accent, 0.95).strokePoints(values, true);
    values.forEach(({ x, y }) => this.graph.fillStyle(COLOR.accent, 1).fillCircle(x, y, 4));
    AXES.forEach(([key], index) => this.valueTexts[index]?.setText(stats[key].toLocaleString()));
    // 면이 넓을수록 숫자도 함께 커진다. 전투력은 곧 이 면의 넓이라, 크기가 값을 한 번 더 말한다.
    const fill = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
    this.powerText?.setText(combatPower(stats).toLocaleString()).setScale(0.8 + fill * 0.34);
  }
}
