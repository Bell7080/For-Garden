import Phaser from "phaser";
import type { GameApi, ProgressPassDto } from "../api/contracts";
import { t } from "../i18n";
import { chipPoints, drawLayer, drawShapeEdge, HOLO, HoloBar, toPoints } from "./holo";
import { LOBBY_PASS_CARD } from "./passPopupLayout";
import { passLevelOf, passReadyCount, passToOpen } from "./passPopupModel";
import { PROGRESS_PASS_TONE, progressPassProgressLabel } from "./PassPopup";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";

/**
 * 로비 왼쪽 위의 **패스 카드** — 스토리·레벨·레이드 패스가 한 장씩 서고, 일정 간격으로 다음 패스가 오른쪽에서
 * 쓱 밀려 들어온다. 아래 점 줄이 지금 몇 번째 패스인지 말한다.
 *
 * 한 장 안에 패스 이름 · 레벨 · 레벨 단위로 끊긴 게이지 · 받을 보상 수(없으면 진행도)가 그 패스의 색으로 선다 —
 * 세 패스가 같은 칸을 번갈아 쓰므로 색과 이름이 먼저 갈려야 지금 무엇을 보는지 읽힌다. 받을 것이 있는 패스부터
 * 보여 주고, 누르면 지금 서 있는 패스로 패스 창이 열린다.
 */
export class LobbyPassCard {
  private readonly frame: Phaser.GameObjects.Container;
  private readonly slides: Phaser.GameObjects.Container;
  private readonly dots: Phaser.GameObjects.Graphics;
  private passes: ProgressPassDto[] = [];
  private names = new Map<string, string>();
  private index = 0;
  private current?: Phaser.GameObjects.Container;
  /** 넘김 시계 — 씬 시계가 아니라 실제 시간이다. 씬 타이머는 프레임이 돌아야 깨어나 로비에서 깨어나지 않는 일이 있었다. */
  private timer?: number;
  private sliding = false;

  constructor(private readonly scene: Phaser.Scene, private readonly api: GameApi, private readonly onOpen: (passId: ProgressPassDto["id"] | undefined) => void) {
    const C = LOBBY_PASS_CARD;
    const x = C.left + C.width / 2;
    this.frame = scene.add.container(x, C.y);
    const shape = this.shape();
    this.frame.add(drawLayer(scene, 0, 0, shape, { fill: 0x10151d, alpha: Math.max(HOLO.glass, 0.82) }));
    // 기하 마스크로 자르지 않는다 — 로비 위에 뜨는 창 아래에서 마스크 그림이 창을 뚫고 비쳤다. 넘김은 짧게 미끄러지며
    // 옅어지고 짙어지는 것으로 충분하다.
    this.slides = scene.add.container(0, 0);
    this.frame.add(this.slides);
    this.dots = scene.add.graphics();
    this.frame.add(this.dots);

    const hit = scene.add.rectangle(0, 0, C.width, C.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(this.frame));
    hit.on("pointerout", () => pressOut(this.frame, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(this.frame); this.onOpen(this.passes[this.index]?.id); });
    this.frame.add(hit);
    this.frame.once(Phaser.GameObjects.Events.DESTROY, () => window.clearInterval(this.timer));
    this.refresh();
  }

  /** 서버에서 패스를 다시 읽는다. 처음에는 받을 것이 있는 패스부터, 다시 읽을 때는 보던 패스에 머문다. */
  /** 창이 떠 있는 동안 감춘다 — 반투명 창 너머로 카드가 비쳐 창의 제목과 겹쳐 읽힌다. */
  setVisible(visible: boolean): void { this.frame.setVisible(visible); }

  refresh(): void {
    void Promise.all([this.api.getProgressPasses(), this.api.getProducts("premium")]).then(([list, catalog]) => {
      if (!this.frame.active) return;
      const first = this.passes.length === 0;
      const keep = this.passes[this.index]?.id;
      this.passes = list.passes;
      this.names = new Map(catalog.products.map((product) => [product.id, product.name]));
      const target = first ? passToOpen(this.passes)?.id : keep;
      this.index = Math.max(0, this.passes.findIndex(({ id }) => id === target));
      this.current?.destroy();
      this.current = this.paintSlide(this.index);
      this.paintDots();
      window.clearInterval(this.timer);
      this.timer = undefined;
      if (this.passes.length > 1) this.timer = window.setInterval(() => this.advance(), LOBBY_PASS_CARD.cycleMs);
    }).catch(() => undefined);
  }

  /** 다음 패스가 오른쪽에서 쓱 밀려 들어오고 지금 패스는 왼쪽으로 빠지며 옅어진다. */
  private advance(): void {
    if (!this.frame.active) { window.clearInterval(this.timer); return; }
    if (this.sliding || this.passes.length < 2 || !this.frame.visible) return;
    const C = LOBBY_PASS_CARD;
    const old = this.current;
    this.index = (this.index + 1) % this.passes.length;
    const next = this.paintSlide(this.index).setAlpha(0);
    this.current = next;
    this.paintDots();
    this.sliding = true;
    // 판에 붙은 색(띠·번짐·윗선)은 제자리에서 옅어지고 짙어지기만 한다 — 옮기면 판 밖으로 삐져나온다. 글과 게이지만
    // 판 안쪽 여백 안에서 짧게 미끄러진다.
    const fg = (slide: Phaser.GameObjects.Container): Phaser.GameObjects.Container => slide.getData("fg") as Phaser.GameObjects.Container;
    fg(next).x = C.slideDistance;
    if (old) this.scene.tweens.add({ targets: old, alpha: 0, duration: C.slideMs * 0.7, ease: "Cubic.In", onComplete: () => old.destroy() });
    if (old) this.scene.tweens.add({ targets: fg(old), x: -C.slideDistance, duration: C.slideMs * 0.7, ease: "Cubic.In" });
    this.scene.tweens.add({ targets: next, alpha: 1, duration: C.slideMs, delay: C.slideMs * 0.25, ease: "Cubic.Out", onComplete: () => { this.sliding = false; } });
    this.scene.tweens.add({ targets: fg(next), x: 0, duration: C.slideMs, delay: C.slideMs * 0.25, ease: "Cubic.Out" });
  }

  private shape(): number[] {
    const C = LOBBY_PASS_CARD;
    const bevel = C.height * C.bevel;
    return chipPoints(C.width, C.height, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
  }

  /** 패스 한 장 — 왼쪽 띠와 번지는 색, 이름·레벨, 게이지, 받을 보상(또는 진행도). */
  private paintSlide(index: number): Phaser.GameObjects.Container {
    const C = LOBBY_PASS_CARD;
    const scene = this.scene;
    const pass = this.passes[index]!;
    const tone = PROGRESS_PASS_TONE[pass.id];
    const slide = scene.add.container(0, 0);
    this.slides.add(slide);
    const fg = scene.add.container(0, 0);
    slide.setData("fg", fg);
    const left = -C.width / 2;

    // 패스 색이 왼쪽에서 번져 들어온다 — 판은 같아도 어느 패스인지가 색으로 먼저 갈린다.
    const wash = scene.add.graphics();
    wash.fillGradientStyle(tone, 0x10151d, tone, 0x10151d, 0.34, 0, 0.34, 0);
    // 판의 깎인 모서리 안에서만 번진다(왼쪽 위 빗변을 피해 그린다).
    const lean0 = C.height * C.bevel;
    wash.fillPoints(toPoints([left + lean0, -C.height / 2, left + C.width * 0.85, -C.height / 2, left + C.width * 0.85, C.height / 2, left, C.height / 2, left, -C.height / 2 + lean0]), true);
    slide.add(wash);
    const stripe = scene.add.graphics();
    const lean = C.height * C.bevel;
    stripe.fillStyle(tone, 0.95).fillPoints(toPoints([left + lean, -C.height / 2, left + lean + C.stripe, -C.height / 2, left + C.stripe, C.height / 2, left, C.height / 2]), true);
    slide.add(stripe);
    slide.add(drawShapeEdge(scene, 0, 0, this.shape(), "top", { color: tone, alpha: 0.9, width: 3 }));

    const contentLeft = left + C.pad;
    const contentRight = C.width / 2 - C.pad + 6;
    const level = passLevelOf(pass);
    const levelText = scene.add.text(contentRight, C.nameY + 2, t("lobby.pass.level", { level: level.level, max: level.max }), textStyle({ role: "emphasis", size: C.levelSize, color: `#${tone.toString(16).padStart(6, "0")}` }))
      .setOrigin(1, 0.5).setStroke("#05070a", 4);
    const name = scene.add.text(contentLeft, C.nameY, this.names.get(pass.productId) ?? pass.id, textStyle({ role: "display", size: C.nameSize, color: COLOR.ink }))
      .setOrigin(0, 0.5).setStroke("#05070a", 5);
    squeezeTextToWidth(name, contentRight - levelText.width - 16 - contentLeft, 0.7);
    fg.add([name, levelText]);

    const barWidth = contentRight - contentLeft;
    const bar = new HoloBar(scene, contentLeft + barWidth / 2, C.gauge.y, barWidth, C.gauge.height, { color: tone, trackAlpha: 0.85, outline: true, ticks: Math.max(0, level.max - 1) });
    bar.setValue(level.fill);
    fg.add([...bar.objects]);

    const ready = passReadyCount(pass);
    const note = scene.add.text(contentLeft, C.noteY, ready > 0 ? t("lobby.pass.ready", { count: ready }) : progressPassProgressLabel(pass),
      textStyle({ role: "emphasis", size: C.noteSize, color: ready > 0 ? "#ffcf7a" : COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#05070a", 4);
    fg.add(squeezeTextToWidth(note, barWidth, 0.7));
    slide.add(fg);
    if (ready > 0) {
      const breath = this.scene.tweens.add({ targets: note, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      slide.once(Phaser.GameObjects.Events.DESTROY, () => breath.remove());
    }
    return slide;
  }

  /** 카드 아래 점 줄 — 지금 패스만 그 색으로 길게 선다. */
  private paintDots(): void {
    const D = LOBBY_PASS_CARD.dots;
    const count = this.passes.length;
    this.dots.clear();
    if (count < 2) return;
    const start = -((count - 1) * D.gap) / 2;
    this.passes.forEach((pass, index) => {
      const cx = start + index * D.gap;
      const active = index === this.index;
      const w = active ? D.size * 1.5 : D.size * 0.8;
      const h = active ? D.size : D.size * 0.8;
      this.dots.fillStyle(0x05070a, 0.7).fillPoints(toPoints([cx, D.y - h - 3, cx + w + 3, D.y, cx, D.y + h + 3, cx - w - 3, D.y]), true);
      this.dots.fillStyle(active ? PROGRESS_PASS_TONE[pass.id] : 0xffffff, active ? 1 : 0.7)
        .fillPoints(toPoints([cx, D.y - h, cx + w, D.y, cx, D.y + h, cx - w, D.y]), true);
    });
  }
}
