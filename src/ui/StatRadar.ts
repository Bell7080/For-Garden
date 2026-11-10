import Phaser from "phaser";
import type { Stats } from "../core/types";
import { STAT_RADAR_MAX } from "../config/statRadar";
import { combatPower } from "../core/combatPower";
import { COLOR, textStyle } from "./theme";
import { t, type TextKey } from "../i18n";
import { motionPolicy } from "../core/settings";
import { settingsManager } from "../managers/SettingsManager";
import { HOLO_SHIMMER, holoBreathe, holoSweepPhase, holoWobble, polygonSpans } from "./holoShimmer";

/** 레이더에 표시하는 축은 항상 같은 순서와 상한을 사용한다. */
const AXES = [
  ["hp", "stat.hp"], ["def", "stat.def.short"], ["res", "stat.res.short"], ["atk", "stat.atk.short"], ["ap", "stat.ap.short"],
] as const satisfies ReadonlyArray<readonly [string, TextKey]>;

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
  /**
   * 홀로그램 결로 그린다 — 주사선·훑는 빛띠·일렁이는 꼭짓점, 두껍게 떠오르는 수치, 또렷한 전투력.
   * 정보창처럼 그래프가 주인공인 자리만 켠다. 곁들이로 놓이는 팝업은 조용한 기본 결을 쓴다.
   */
  holo?: boolean;
}

/** 홀로그램 결의 색. 면은 강조색(금빛), 격자와 주사선은 투영 장비의 옅은 청록이다. */
const HOLO_GRID = 0x8fe8ff;
const HOLO_EDGE = 0xfff0c8;

/** 정규화된 오각형 능력치 레이더 그래프 Phaser prefab이다. */
export class StatRadar extends Phaser.GameObjects.Container {
  private readonly graph: Phaser.GameObjects.Graphics;
  /** 축 이름 아래의 수치. 켜 두지 않으면 만들지 않는다. */
  private readonly valueTexts: Phaser.GameObjects.Text[] = [];
  /** 면 안에 옅게 눕는 전투력. */
  private readonly powerText?: Phaser.GameObjects.Text;
  private readonly powerLabel?: Phaser.GameObjects.Text;
  private readonly holo: boolean;
  private readonly axisColors: number[] = [];
  private stats: Stats = { hp: 0, def: 0, res: 0, atk: 0, ap: 0 } as Stats;
  private radius: number;
  /** 0이면 면이 가운데 한 점, 1이면 제 크기다. 처음 펼쳐질 때만 0에서 오른다. */
  private grow = 1;
  private revealTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, radius = 112, label: StatRadarLabelStyle = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.holo = label.holo === true;
    this.radius = radius;
    this.graph = scene.add.graphics();
    this.add(this.graph);

    if (label.power && this.holo) {
      // 홀로그램 결에서는 전투력을 면 **위**에 또렷하게 세운다 — 면 아래에 잠기면 밝은 면에 묻혀
      // 무엇이 적혀 있는지 읽히지 않았다. 위에 작은 이름표를 달아 무엇의 수인지도 말한다.
      this.powerLabel = scene.add
        .text(0, -radius * 0.2, t("info.stats.power"), textStyle({ role: "emphasis", size: Math.round(radius * 0.13), color: "#cfefff" }))
        .setOrigin(0.5)
        .setStroke("#05070a", 5)
        .setAlpha(0.9);
      this.powerText = scene.add
        .text(0, radius * 0.04, "", textStyle({ role: "display", size: Math.round(radius * 0.34), color: "#ffe9b0" }))
        .setOrigin(0.5)
        .setStroke("#2a1a05", 8)
        .setShadow(0, 0, COLOR.accentText, 14, true, true);
    } else if (label.power) {
      // 면보다 먼저 그린다. 면의 채움이 숫자 위로 덮여야 숫자가 면 **안에** 잠긴 것처럼 보인다.
      this.powerText = scene.add
        .text(0, 0, "", textStyle({ role: "display", size: Math.round(radius * 0.32), color: COLOR.accentText }))
        .setOrigin(0.5)
        .setAlpha(0.32);
      // 그래프보다 **아래**에 깐다. 면의 채움이 숫자 위로 덮여야 숫자가 면 안에 잠긴다.
      this.addAt(this.powerText, 0);
    }

    // 축 라벨은 그래프 밖으로 일정하게 밀어 최대 자릿수 숫자와 겹치지 않게 한다.
    AXES.forEach(([key, nameKey], index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      const color = label.colors?.[key];
      const size = label.size ?? 17;
      const style = color
        ? textStyle({ role: "display", size, color })
        : textStyle({ role: "body", size, color: COLOR.inkDim });
      const lx = Math.cos(angle) * (radius + 31);
      const ly = Math.sin(angle) * (radius + 25);
      this.add(scene.add.text(lx, ly, t(nameKey), style).setOrigin(0.5));
      if (!label.values) return;
      // 수치는 축 이름보다 **한 칸 더 바깥**에 같은 색으로 선다. "아래"로 밀면 위쪽 축의 수가
      // 그래프 면 안으로 들어가 선과 겹친다. 바깥으로 밀면 어느 축이든 면을 건드리지 않는다.
      const valueStyle = color
        ? textStyle({ role: "display", size: Math.round(size * 0.9), color })
        : textStyle({ role: "display", size: Math.round(size * 0.9), color: COLOR.ink });
      // 이름 위아래로 쌓는다. 옆으로 밀면 이름과 수가 한 줄에 붙어 "방어228"처럼 읽히고,
      // 바깥으로만 밀면 옆 축에서는 그게 곧 옆으로 미는 것과 같다. 맨 위 축만 위로 올린다.
      const step = size + 8;
      const value = this.addValue(scene, lx, ly + (index === 0 ? -step : step), valueStyle);
      if (this.holo) {
        // 수치가 판에서 튀어나와야 한다 — 크고 두껍게, 검은 획 위에 제 색 빛을 두른다.
        value.setFontSize(Math.round(size * 1.12)).setStroke("#05070a", 7).setShadow(0, 0, color ?? COLOR.ink, 12, true, true);
      }
      this.valueTexts.push(value);
    });
    if (this.holo) {
      // 축 이름도 검은 획을 둘러 밝은 배경 원화 위에서 떨어져 나오게 한다.
      for (const child of this.list) if (child instanceof Phaser.GameObjects.Text && !this.valueTexts.includes(child) && child !== this.powerText) child.setStroke("#05070a", 5);
      AXES.forEach(([key]) => this.axisColors.push(Phaser.Display.Color.HexStringToColor(label.colors?.[key] ?? "#d8b978").color));
      if (this.powerLabel) this.add(this.powerLabel);
      if (this.powerText) this.add(this.powerText);
      this.startShimmer();
    }
    this.draw({ hp: 0, def: 0, res: 0, atk: 0, ap: 0 } as Stats, radius);
  }

  /** 일렁임은 화면에 실제로 보일 때만 다시 그린다. 움직임 줄이기에서는 멈춘 결만 남는다. */
  private startShimmer(): void {
    const tick = (): void => {
      if (!this.active || !this.shownDeep()) return;
      if (motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0) return;
      this.paint(this.scene.time.now);
    };
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.scene?.events.off(Phaser.Scenes.Events.UPDATE, tick));
  }

  private shownDeep(): boolean {
    let node: Phaser.GameObjects.Container | null = this;
    while (node) {
      if (!node.visible || node.alpha <= 0) return false;
      node = node.parentContainer;
    }
    return true;
  }

  /**
   * 면이 가운데에서 펼쳐지며 수치가 0에서 차오른다. 정보창이 처음 열릴 때 스테이터스가 조립되는 한 박자다.
   */
  reveal(delayMs: number, durationMs: number): void {
    this.revealTween?.stop();
    this.revealTween = undefined;
    if (durationMs <= 0) { this.grow = 1; this.paint(this.scene.time.now); return; }
    this.grow = 0;
    this.paint(this.scene.time.now);
    this.revealTween = this.scene.tweens.addCounter({
      from: 0, to: 1, delay: delayMs, duration: durationMs, ease: "Cubic.Out",
      onUpdate: (tween) => { this.grow = tween.getValue() ?? 1; this.paint(this.scene.time.now); },
      onComplete: () => { this.grow = 1; this.paint(this.scene.time.now); },
    });
  }

  /**
   * 그 축의 수치가 화면 어디에 서 있는가(월드 좌표). 레벨업 때 오른 몫이 그 수치 옆에서 튀어나온다.
   * 수치를 세우지 않은 판이면 `undefined`.
   */
  valueAnchor(key: keyof Stats): { x: number; y: number } | undefined {
    const index = AXES.findIndex(([axis]) => axis === key);
    const text = this.valueTexts[index];
    if (!text) return undefined;
    const point = text.getWorldTransformMatrix().transformPoint(text.width * (0.5 - text.originX), 0);
    return { x: point.x, y: point.y };
  }

  /** 수치 한 칸. 어두운 그림자를 깔아 그래프 선 위에서도 획이 묻히지 않게 한다. */
  private addValue(scene: Phaser.Scene, x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const text = scene.add.text(x, y, "", style).setOrigin(0.5).setShadow(2, 4, "#05070a", 5, false, true);
    this.add(text);
    return text;
  }

  /** 각 수치를 공용 상한으로 제한·정규화한 뒤 비교 가능한 면을 그린다. */
  draw(stats: Stats, radius = 112): void {
    this.stats = stats;
    this.radius = radius;
    if (this.holo) { this.paint(this.scene.time.now); return; }
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

  /** 홀로그램 결 한 장. `timeMs`가 주사선·빛띠·일렁임의 박자를 정한다. */
  private paint(timeMs: number): void {
    const radius = this.radius;
    const stats = this.stats;
    const still = motionPolicy(settingsManager.get()).nonEssentialRepeatFactor === 0;
    const g = this.graph;
    g.clear();
    const point = (index: number, scale: number): Phaser.Math.Vector2 => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / AXES.length;
      return new Phaser.Math.Vector2(Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale);
    };
    const breathe = still ? 1 : holoBreathe(timeMs);
    // 격자 — 바깥 고리만 조금 진하고 안쪽 둘은 옅다. 바큇살도 가늘게.
    ([[1, 0.42], [0.66, 0.2], [0.33, 0.16]] as const).forEach(([scale, alpha]) => {
      g.lineStyle(2, HOLO_GRID, alpha * breathe).strokePoints(AXES.map((_, index) => point(index, scale)), true);
    });
    g.lineStyle(1.5, HOLO_GRID, 0.22 * breathe);
    AXES.forEach((_, index) => g.lineBetween(0, 0, point(index, 1).x, point(index, 1).y));

    const ratios = AXES.map(([key]) => Math.min(1, Math.max(0, stats[key] / STAT_RADAR_MAX[key])));
    const values = ratios.map((ratio, index) => point(index, Math.max(0.04, ratio * this.grow) * (still ? 1 : holoWobble(index, timeMs))));
    const flat = values.flatMap(({ x, y }) => [x, y]);
    g.fillStyle(COLOR.accent, 0.2 * breathe).fillPoints(values, true);
    // 주사선 — 면 안쪽에만 긋는다.
    const ys = values.map(({ y }) => y);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    g.lineStyle(1, HOLO_EDGE, HOLO_SHIMMER.scan.alpha * breathe);
    for (let y = top + HOLO_SHIMMER.scan.gap / 2; y < bottom; y += HOLO_SHIMMER.scan.gap) {
      for (const [a, b] of polygonSpans(flat, y)) g.lineBetween(a, y, b, y);
    }
    // 훑는 빛띠 — 아래에서 위로 지나가며 면을 한 번씩 밝힌다.
    if (!still && bottom - top > 4) {
      const height = bottom - top;
      const center = bottom - holoSweepPhase(timeMs) * (height * (1 + HOLO_SHIMMER.sweep.band * 2)) + height * HOLO_SHIMMER.sweep.band;
      const half = (height * HOLO_SHIMMER.sweep.band) / 2;
      for (let y = Math.max(top, center - half); y < Math.min(bottom, center + half); y += 2) {
        const fade = 1 - Math.abs(y - center) / half;
        g.lineStyle(2, HOLO_EDGE, HOLO_SHIMMER.sweep.alpha * fade);
        for (const [a, b] of polygonSpans(flat, y)) g.lineBetween(a, y, b, y);
      }
    }
    // 테두리 — 넓게 번지는 빛 한 겹 위에 또렷한 선.
    g.lineStyle(10, COLOR.accent, 0.16 * breathe).strokePoints(values, true);
    g.lineStyle(3, HOLO_EDGE, 0.95).strokePoints(values, true);
    // 꼭짓점은 동그라미가 아니라 축 색의 작은 마름모다.
    values.forEach(({ x, y }, index) => {
      const size = 7;
      g.fillStyle(this.axisColors[index] ?? COLOR.accent, 1);
      g.fillPoints([new Phaser.Math.Vector2(x, y - size), new Phaser.Math.Vector2(x + size * 0.7, y), new Phaser.Math.Vector2(x, y + size), new Phaser.Math.Vector2(x - size * 0.7, y)], true);
    });
    g.setAlpha(1);
    AXES.forEach(([key], index) => this.valueTexts[index]?.setText(Math.round(stats[key] * this.grow).toLocaleString()));
    this.powerText?.setText(Math.round(combatPower(stats) * this.grow).toLocaleString());
  }
}
