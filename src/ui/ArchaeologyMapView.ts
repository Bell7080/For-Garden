import Phaser from "phaser";
import { BUTTON_DRAG_CANCEL_DISTANCE } from "./Button";
import { archaeologyNodeState, isArchaeologyMapDrag, type ArchaeologyNodeState } from "../core/archaeologyMap";
import { STRATA_SITE_COOLDOWN_MS } from "../data/strataLayers";
import type { ArchaeologySiteDefinition } from "../data/archaeologySites";
import { ARCHAEOLOGY_MAP_LAYOUT, clampArchaeologyMapOffset } from "./archaeologyMapLayout";
import { chipPoints, drawLayer, drawShapeOutline, HOLO, toPoints } from "./holo";
import { clockWedgeOnShape } from "./clockWedge";
import { drawGlyph } from "./glyphs";
import { formatCountdown } from "../core/formatCountdown";
import { t, type TextKey } from "../i18n";
import { COLOR, textStyle } from "./theme";
import { claimNavSwipe } from "./BottomNav";

export interface ArchaeologyMapSiteState {
  siteId: string;
  unlocked: boolean;
  completed: boolean;
  /** 그 유적이 다시 열리는 시각(ms). 지금 열려 있으면 `null`이다. */
  cooldownUntilMs?: number | null;
}
export interface ArchaeologyMapViewOptions {
  top: number; bottom: number;
  sites: readonly ArchaeologySiteDefinition[];
  states: readonly ArchaeologyMapSiteState[];
  focusSiteId?: string; activeSiteId?: string;
  onSelect: (site: ArchaeologySiteDefinition) => void;
  /** 노드가 실제로 선 화면 좌표와 상태. 자동화가 좌표를 손으로 적지 않게 한다. */
  onLayout?: (nodes: ReadonlyArray<{ siteId: string; x: number; y: number; state: ArchaeologyNodeState }>) => void;
}

/**
 * 노드 한 자리의 생김새.
 *
 * **다섯 상태가 색·진하기·표식 셋으로 갈린다.** 예전에는 동그라미 하나에 글자만 바꿔 두어,
 * 잠긴 자리와 이미 판 자리가 둘 다 흐린 원이라 무엇이 다른지 옆에 두고 봐야 알았다.
 * 지금은 화면 전체의 규칙대로 **깎인 칩**을 쓰고, 지금 갈 수 있는 자리만 강조색으로 선다.
 */
const NODE_STYLE: Readonly<Record<ArchaeologyNodeState, {
  fill: number; alpha: number; edge: number; edgeAlpha: number; mark: string; markColor: string; nameColor: string;
}>> = {
  active: { fill: 0x2a1a12, alpha: 0.95, edge: COLOR.sortie, edgeAlpha: 0.95, mark: "▶", markColor: COLOR.sortieText, nameColor: COLOR.sortieText },
  available: { fill: 0x121a1e, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.9, mark: "◆", markColor: COLOR.accentText, nameColor: COLOR.ink },
  cooling: { fill: 0x10161b, alpha: 0.86, edge: COLOR.strataFrameGlow, edgeAlpha: 0.6, mark: "◆", markColor: COLOR.inkDim, nameColor: COLOR.inkDim },
  completed: { fill: 0x121a1e, alpha: 0.7, edge: COLOR.accent, edgeAlpha: 0.45, mark: "✓", markColor: COLOR.accentText, nameColor: COLOR.inkDim },
  locked: { fill: 0x0d1013, alpha: 0.72, edge: COLOR.panelEdge, edgeAlpha: 0.5, mark: "", markColor: COLOR.inkDim, nameColor: COLOR.inkDim },
} as const;

/** 노드 이름표가 칩 밑변에서 내려오는 거리와 그 아래 상태 줄의 간격이다. */
const NODE_LABEL = { nameGap: 34, stateGap: 30, nameSize: 25, stateSize: 21 } as const;

/** 원정의 검증된 포인터 ID/누적 이동 패턴만 재사용하고 콘텐츠 상태는 별도로 소유하는 양축 지도다. */
export class ArchaeologyMapView extends Phaser.GameObjects.Container {
  private readonly world: Phaser.GameObjects.Container;
  private pointerId?: number; private start = { x: 0, y: 0 }; private lastPoint = { x: 0, y: 0 }; private dragged = false;
  private pressed?: ArchaeologySiteDefinition;
  /** 생성 프레임의 포인터 입력과 초기 중앙 배치를 섞지 않기 위한 한 프레임짜리 잠금이다. */
  private restoring = true;
  /** 매초 남은 시간을 고쳐 쓰는 대기 중 노드의 글자와 그 위를 덮는 부채꼴이다. */
  private readonly cooling: Array<{ until: number; text: Phaser.GameObjects.Text; wedge: Phaser.GameObjects.Graphics; shape: number[] }> = [];
  /** 노드마다 고른 상태. 자동화에 자리와 함께 알린다. */
  private readonly kinds = new Map<string, ArchaeologyNodeState>();

  constructor(scene: Phaser.Scene, private readonly options: ArchaeologyMapViewOptions) {
    super(scene, 0, options.top); scene.add.existing(this);
    const viewportHeight = options.bottom - options.top;
    this.world = scene.add.container(0, 0); this.add(this.world);
    const mask = scene.make.graphics({ x: 0, y: options.top }).fillStyle(0xffffff).fillRect(0, 0, scene.scale.width, viewportHeight);
    this.setMask(mask.createGeometryMask()); this.once("destroy", () => mask.destroy());
    const states = new Map(options.states.map((state) => [state.siteId, state]));
    const byId = new Map(options.sites.map((site) => [site.id, site]));

    /*
     * **줄기는 두 겹으로 긋는다.** 한 줄만 그으면 열세 자리가 얽힌 그물망에서 선이 배경 원화에
     * 묻혀 어디로 이어지는지 읽히지 않는다. 아래에 굵고 어두운 줄을, 그 위에 얇은 강조선을
     * 겹치면 밝은 곳에서도 선이 떠오른다. **이미 판 자리로 가는 줄만 밝다** — 아직 못 가는
     * 자리로 이어지는 줄까지 밝으면 지도 전체가 열린 것처럼 보인다.
     */
    const paths = scene.add.graphics();
    options.sites.forEach((site) => site.connectionIds.forEach((id) => {
      const next = byId.get(id);
      if (!next) return;
      const open = (states.get(site.id)?.unlocked ?? false) && (states.get(next.id)?.unlocked ?? false);
      paths.lineStyle(9, COLOR.void, 0.55).lineBetween(site.x, site.y, next.x, next.y);
      paths.lineStyle(3, COLOR.accent, open ? 0.5 : 0.18).lineBetween(site.x, site.y, next.x, next.y);
    }));
    this.world.add(paths);

    const size = ARCHAEOLOGY_MAP_LAYOUT.nodeSize;
    const shape = chipPoints(size, size, { bevel: { topLeft: size * 0.24, bottomRight: size * 0.24 } });
    options.sites.forEach((site) => {
      const state = states.get(site.id);
      const cooldownUntilMs = state?.cooldownUntilMs ?? null;
      const kind = archaeologyNodeState({
        siteId: site.id,
        unlocked: state?.unlocked ?? false,
        completed: state?.completed ?? false,
        cooling: cooldownUntilMs !== null,
        activeSiteId: options.activeSiteId,
      });
      this.kinds.set(site.id, kind);
      const style = NODE_STYLE[kind];
      const node = scene.add.container(site.x, site.y);
      node.add(drawLayer(scene, 0, 0, shape, { fill: style.fill, alpha: style.alpha, edge: style.edge, edgeAlpha: style.edgeAlpha, edgeWidth: kind === "active" ? 4 : 2 }));
      // **지금 갈 수 있는 자리만 사방을 두른다.** 나머지는 윗변 한 줄뿐이라, 두른 선 자체가
      // 「여기는 들어갈 수 있다」는 신호가 된다.
      if (kind === "active" || kind === "available") node.add(drawShapeOutline(scene, 0, 0, shape, { color: style.edge, alpha: 0.55 }));
      if (kind === "locked") node.add(drawGlyph(scene, "lock", 0, 0, size * 0.42, COLOR.inkDimHex, 0.85));
      else node.add(scene.add.text(0, 0, style.mark, textStyle({ role: "display", size: Math.round(size * 0.36), color: style.markColor })).setOrigin(0.5));
      node.add(scene.add.text(0, size / 2 + NODE_LABEL.nameGap, t(site.nameKey as TextKey), textStyle({ role: "display", size: NODE_LABEL.nameSize, color: style.nameColor })).setOrigin(0.5));
      this.world.add(node);

      if (kind === "cooling" && cooldownUntilMs !== null) {
        // 지나간 몫을 덮어 **다 덮이는 순간이 곧 다시 열리는 순간**이 되게 한다. 머리 위 상태
        // 칩과 같은 문법이라 여기서만 다른 방식으로 남은 시간을 말하지 않는다.
        const wedge = scene.add.graphics();
        node.add(wedge);
        const stateText = scene.add.text(0, size / 2 + NODE_LABEL.nameGap + NODE_LABEL.stateGap, "",
          textStyle({ role: "emphasis", size: NODE_LABEL.stateSize, color: COLOR.accentText })).setOrigin(0.5);
        node.add(stateText);
        this.cooling.push({ until: cooldownUntilMs, text: stateText, wedge, shape });
      }

      const hit = scene.add.rectangle(site.x, site.y, ARCHAEOLOGY_MAP_LAYOUT.hitSize, ARCHAEOLOGY_MAP_LAYOUT.hitSize, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.pressed = site; this.begin(pointer); }); this.world.add(hit);
    });
    const surface = scene.add.zone(scene.scale.width / 2, viewportHeight / 2, scene.scale.width, viewportHeight).setInteractive(); surface.on("pointerdown", (p: Phaser.Input.Pointer) => this.begin(p)); this.addAt(surface, 0);
    scene.input.on("pointermove", this.move, this); scene.input.on("pointerup", this.end, this); scene.input.on("gameout", this.cancel, this);
    this.once("destroy", () => { scene.input.off("pointermove", this.move, this); scene.input.off("pointerup", this.end, this); scene.input.off("gameout", this.cancel, this); });
    const focus = options.sites.find((site) => site.id === options.focusSiteId) ?? options.sites[0];
    // 컨테이너·마스크가 모두 생성된 뒤 딱 한 번 배치한다. 좌표 자체는 저장하지 않고 매 진입 시
    // 진행 의미에서 다시 계산하므로 해상도/카탈로그 변경 뒤 낡은 픽셀 위치가 복원되지 않는다.
    const restore = (): void => {
      if (!this.active) return;
      this.setOffset(scene.scale.width / 2 - focus.x, viewportHeight / 2 - focus.y);
      this.restoring = false;
    };
    scene.events.once(Phaser.Scenes.Events.POST_UPDATE, restore);
    this.once("destroy", () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, restore));
    // 남은 시간은 Phaser 시계에 묶어 둔다 — 탭이 백그라운드로 가면 함께 멎어 브라우저 타이머가 남지 않는다.
    const tick = scene.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateCooldowns() });
    this.once("destroy", () => tick.destroy());
    this.updateCooldowns();
  }

  /** 매초 남은 시간과 덮인 몫만 고쳐 쓴다. 노드를 다시 만들지 않는다. */
  private updateCooldowns(): void {
    const now = Date.now();
    for (const entry of this.cooling) {
      if (!entry.text.active) continue;
      const remaining = Math.max(0, entry.until - now);
      entry.text.setText(t("archaeology.map.cooling", { time: formatCountdown(remaining) }));
      const points = clockWedgeOnShape(toPoints(entry.shape), 1 - remaining / STRATA_SITE_COOLDOWN_MS);
      entry.wedge.clear();
      if (points.length >= 3) entry.wedge.fillStyle(COLOR.void, 0.62).fillPoints(points.map(({ x, y }) => new Phaser.Geom.Point(x, y)), true);
    }
  }

  /** 지도를 옮길 때마다 지금 노드가 선 화면 좌표를 다시 알린다. */
  private publishLayout(): void {
    this.options.onLayout?.(this.options.sites.map((site) => ({
      siteId: site.id, x: this.world.x + site.x, y: this.y + this.world.y + site.y,
      state: this.kinds.get(site.id) ?? "locked",
    })));
  }

  private begin(pointer: Phaser.Input.Pointer): void { if (this.restoring || this.pointerId !== undefined) return; this.pointerId = pointer.id; this.start = this.lastPoint = { x: pointer.worldX, y: pointer.worldY }; this.dragged = false; }
  private move(pointer: Phaser.Input.Pointer): void { if (pointer.id !== this.pointerId) return; claimNavSwipe(); const next = { x: pointer.worldX, y: pointer.worldY }; this.dragged ||= isArchaeologyMapDrag(this.start, next, BUTTON_DRAG_CANCEL_DISTANCE); this.setOffset(this.world.x + next.x - this.lastPoint.x, this.world.y + next.y - this.lastPoint.y); this.lastPoint = next; }
  private end(pointer: Phaser.Input.Pointer): void { if (pointer.id !== this.pointerId) return; const site = this.pressed; const select = !this.dragged && site; this.cancel(); if (select) this.options.onSelect(select); }
  private cancel(): void { this.pointerId = undefined; this.pressed = undefined; this.dragged = false; }
  private setOffset(x: number, y: number): void {
    const next = clampArchaeologyMapOffset(x, y, this.scene.scale.width, this.options.bottom - this.options.top);
    this.world.setPosition(next.x, next.y);
    this.publishLayout();
  }
}
