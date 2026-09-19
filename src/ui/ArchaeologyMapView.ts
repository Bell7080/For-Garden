import Phaser from "phaser";
import { BUTTON_DRAG_CANCEL_DISTANCE } from "./Button";
import { isArchaeologyMapDrag } from "../core/archaeologyMap";
import type { ArchaeologySiteDefinition } from "../data/archaeologySites";
import { ARCHAEOLOGY_MAP_LAYOUT, clampArchaeologyMapOffset } from "./archaeologyMapLayout";
import { COLOR } from "./theme";

export interface ArchaeologyMapSiteState { siteId: string; unlocked: boolean; completed: boolean }
export interface ArchaeologyMapViewOptions { top: number; bottom: number; sites: readonly ArchaeologySiteDefinition[]; states: readonly ArchaeologyMapSiteState[]; focusSiteId?: string; activeSiteId?: string; onSelect: (site: ArchaeologySiteDefinition) => void }

/** 원정의 검증된 포인터 ID/누적 이동 패턴만 재사용하고 콘텐츠 상태는 별도로 소유하는 양축 지도다. */
export class ArchaeologyMapView extends Phaser.GameObjects.Container {
  private readonly world: Phaser.GameObjects.Container;
  private pointerId?: number; private start = { x: 0, y: 0 }; private lastPoint = { x: 0, y: 0 }; private dragged = false;
  private pressed?: ArchaeologySiteDefinition;
  /** 생성 프레임의 포인터 입력과 초기 중앙 배치를 섞지 않기 위한 한 프레임짜리 잠금이다. */
  private restoring = true;

  constructor(scene: Phaser.Scene, private readonly options: ArchaeologyMapViewOptions) {
    super(scene, 0, options.top); scene.add.existing(this);
    const viewportHeight = options.bottom - options.top;
    this.world = scene.add.container(0, 0); this.add(this.world);
    const mask = scene.make.graphics({ x: 0, y: options.top }).fillStyle(0xffffff).fillRect(0, 0, scene.scale.width, viewportHeight);
    this.setMask(mask.createGeometryMask()); this.once("destroy", () => mask.destroy());
    const states = new Map(options.states.map((state) => [state.siteId, state]));
    const paths = scene.add.graphics().lineStyle(5, COLOR.accent, 0.3); const byId = new Map(options.sites.map((site) => [site.id, site]));
    options.sites.forEach((site) => site.connectionIds.forEach((id) => { const next = byId.get(id); if (next) paths.lineBetween(site.x, site.y, next.x, next.y); })); this.world.add(paths);
    options.sites.forEach((site) => {
      const state = states.get(site.id); const unlocked = state?.unlocked ?? false; const active = site.id === options.activeSiteId;
      const node = scene.add.container(site.x, site.y);
      node.add(scene.add.circle(0, 0, ARCHAEOLOGY_MAP_LAYOUT.nodeSize / 2, active ? COLOR.sortie : unlocked ? COLOR.accent : COLOR.panel, active ? 0.95 : unlocked ? 0.8 : 0.55).setStrokeStyle(active ? 8 : 4, COLOR.accent, active ? 0.9 : 0.35));
      node.add(scene.add.text(0, 0, active ? "▶" : state?.completed ? "✓" : unlocked ? "◆" : "◇", { fontSize: "42px", color: "#e7f7f4" }).setOrigin(0.5)); this.world.add(node);
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
  }
  private begin(pointer: Phaser.Input.Pointer): void { if (this.restoring || this.pointerId !== undefined) return; this.pointerId = pointer.id; this.start = this.lastPoint = { x: pointer.worldX, y: pointer.worldY }; this.dragged = false; }
  private move(pointer: Phaser.Input.Pointer): void { if (pointer.id !== this.pointerId) return; const next = { x: pointer.worldX, y: pointer.worldY }; this.dragged ||= isArchaeologyMapDrag(this.start, next, BUTTON_DRAG_CANCEL_DISTANCE); this.setOffset(this.world.x + next.x - this.lastPoint.x, this.world.y + next.y - this.lastPoint.y); this.lastPoint = next; }
  private end(pointer: Phaser.Input.Pointer): void { if (pointer.id !== this.pointerId) return; const site = this.pressed; const select = !this.dragged && site; this.cancel(); if (select) this.options.onSelect(select); }
  private cancel(): void { this.pointerId = undefined; this.pressed = undefined; this.dragged = false; }
  private setOffset(x: number, y: number): void { const next = clampArchaeologyMapOffset(x, y, this.scene.scale.width, this.options.bottom - this.options.top); this.world.setPosition(next.x, next.y); }
}
