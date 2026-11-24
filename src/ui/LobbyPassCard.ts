import Phaser from "phaser";
import { bindNotificationDot } from "./NotificationDot";
import { notificationManager } from "../managers/NotificationManager";
import type { GameApi, ProgressPassDto } from "../api/contracts";
import { t } from "../i18n";
import { chipPoints, drawLayer, drawShapeEdge, HOLO, HoloBar, toPoints } from "./holo";
import { addFramedIcon, itemFrameShape } from "./itemFrame";
import { grantTiles } from "./premiumModel";
import { formatCurrency } from "../core/formatCurrency";
import { LOBBY_PASS_CARD } from "./passPopupLayout";
import { passCardReward, passLevelOf, passReadyCount, passToOpen } from "./passPopupModel";
import { PROGRESS_PASS_TONE, progressPassProgressLabel } from "./PassPopup";
import { pressIn, pressOut } from "./pressFeedback";
import { COLOR, textStyle } from "./theme";
import { squeezeTextToWidth } from "./textFit";
import { playFadeIn } from "./screenTransition";
import { PRODUCTS } from "../data/shopCatalog";
import { session } from "../state/session";

/**
 * 마지막으로 받은 패스 목록 — 로비를 다시 세울 때마다 빈 판으로 서서 서버 답을 기다리지 않도록 계정마다 하나 기억한다.
 * 하단 탭으로 로비에 돌아오면 이 값으로 **곧바로** 그리고, 새 답이 오면 바뀐 것이 있을 때만 그 자리에서 갈아 끼운다.
 */
let remembered: { owner: string; passes: ProgressPassDto[]; index: number } | undefined;
/** 진행 중인 조회 — 로비가 연달아 서도(탭 왕복) 같은 조회를 겹쳐 보내지 않는다. */
let inflight: Promise<ProgressPassDto[]> | undefined;

function ownerKey(): string { return session.playerCard.uid ?? ""; }

/** 패스 이름은 상품 정의가 갖는다(언어마다 갈아 끼워진다) — 이름 하나를 읽으려 프리미엄 상품 목록 전체를 묻지 않는다. */
function passName(pass: ProgressPassDto): string {
  return PRODUCTS.find(({ id }) => id === pass.productId)?.name ?? pass.id;
}

/**
 * 로비 왼쪽 위의 **패스 카드** — 스토리·레벨·레이드 패스가 한 장씩 서고, 일정 간격으로 다음 패스가 오른쪽에서
 * 쓱 밀려 들어온다. 판 안 밑줄의 짧은 대시가 지금 몇 번째 패스인지 말한다.
 *
 * 한 장 안에 보상 액자(받을 것, 없으면 다음 보상) · 패스 이름 · 레벨 · 레벨 단위로 끊긴 게이지 · 받을 보상 수(없으면
 * 진행도)가 그 패스의 색으로 선다 —
 * 세 패스가 같은 칸을 번갈아 쓰므로 색과 이름이 먼저 갈려야 지금 무엇을 보는지 읽힌다. 받을 것이 있는 패스부터
 * 보여 주고, 누르면 지금 서 있는 패스로 패스 창이 열린다.
 */
export class LobbyPassCard {
  private readonly frame: Phaser.GameObjects.Container;
  private readonly slides: Phaser.GameObjects.Container;
  private readonly dots: Phaser.GameObjects.Graphics;
  private passes: ProgressPassDto[] = [];
  /** 지금 그린 패스 목록의 서명 — 다시 받은 답이 같으면 다시 그리지 않는다(새로고침처럼 깜빡이지 않게). */
  private signature = "";
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
    this.frame.add(drawLayer(scene, 0, 0, shape, { fill: 0x1a1f27, alpha: HOLO.glass }));
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
    bindNotificationDot(scene, this.frame, { x: C.width / 2 - 12, y: -C.height / 2 + 12 }, (listener) => notificationManager.subscribe("passReward", listener));
    this.frame.once(Phaser.GameObjects.Events.DESTROY, () => window.clearInterval(this.timer));
    const cached = remembered?.owner === ownerKey() ? remembered : undefined;
    if (cached) this.show(cached.passes, cached.index);
    // 처음 한 번은 기억한 것이 없다 — 빈 유리판을 먼저 세워 두지 않고, 답이 오면 판째 옅게 떠오른다.
    else this.frame.setAlpha(0);
    this.refresh();
  }

  /** 서버에서 패스를 다시 읽는다. 처음에는 받을 것이 있는 패스부터, 다시 읽을 때는 보던 패스에 머문다. */
  /** 창이 떠 있는 동안 감춘다 — 반투명 창 너머로 카드가 비쳐 창의 제목과 겹쳐 읽힌다. */
  setVisible(visible: boolean): void { this.frame.setVisible(visible); }

  refresh(): void {
    const request = inflight ?? this.api.getProgressPasses().then((list) => list.passes);
    inflight = request;
    const owner = ownerKey();
    void request.finally(() => { if (inflight === request) inflight = undefined; }).then((passes) => {
      if (!this.frame.active || owner !== ownerKey()) return;
      const first = this.passes.length === 0;
      const keep = this.passes[this.index]?.id;
      const target = first ? passToOpen(passes)?.id : keep;
      const index = Math.max(0, passes.findIndex(({ id }) => id === target));
      if (passSignature(passes) === this.signature) { this.passes = passes; this.remember(); return; }
      this.show(passes, index);
      if (first) playFadeIn(this.scene, [this.frame]);
    }).catch(() => undefined);
  }

  /** 패스 목록을 판에 세운다 — 지금 장을 갈아 끼우고 점 줄과 넘김 시계를 맞춘다. */
  private show(passes: ProgressPassDto[], index: number): void {
    this.passes = passes;
    this.signature = passSignature(passes);
    this.index = Math.min(Math.max(0, index), Math.max(0, passes.length - 1));
    this.current?.destroy();
    this.current = passes.length > 0 ? this.paintSlide(this.index) : undefined;
    this.paintDots();
    this.remember();
    window.clearInterval(this.timer);
    this.timer = undefined;
    if (this.passes.length > 1) this.timer = window.setInterval(() => this.advance(), LOBBY_PASS_CARD.cycleMs);
  }

  private remember(): void { remembered = { owner: ownerKey(), passes: this.passes, index: this.index }; }

  /** 다음 패스가 오른쪽에서 쓱 밀려 들어오고 지금 패스는 왼쪽으로 빠지며 옅어진다. */
  private advance(): void {
    if (!this.frame.active) { window.clearInterval(this.timer); return; }
    if (this.sliding || this.passes.length < 2 || !this.frame.visible) return;
    const C = LOBBY_PASS_CARD;
    const old = this.current;
    this.index = (this.index + 1) % this.passes.length;
    this.remember();
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

  /** 패스 한 장 — 왼쪽 띠와 번지는 색, 보상 액자, 이름·레벨, 게이지, 받을 보상(또는 진행도). */
  private paintSlide(index: number): Phaser.GameObjects.Container {
    const C = LOBBY_PASS_CARD;
    const scene = this.scene;
    const pass = this.passes[index]!;
    const tone = PROGRESS_PASS_TONE[pass.id];
    const toneText = `#${tone.toString(16).padStart(6, "0")}`;
    const slide = scene.add.container(0, 0);
    this.slides.add(slide);
    const fg = scene.add.container(0, 0);
    slide.setData("fg", fg);
    const left = -C.width / 2;

    // 패스 색이 왼쪽에서 번져 들어와 오른쪽 끝에서 사라진다. 다각형 채우기에는 그라데이션이 먹지 않아(첫 색 한 장으로
    // 칠해진다) 예전에는 판 폭의 85%에서 뚝 끊기는 보라 판이 유리 판 위에 한 장 더 얹힌 것처럼 보였다 — 판과 같은
    // 실루엣을 세로 띠로 잘라 진하기만 줄여 가며 겹친다.
    const wash = scene.add.graphics();
    const body = this.shape();
    const strips = 16;
    for (let i = 0; i < strips; i += 1) {
      const from = left + (C.width * i) / strips;
      const piece = clipToColumn(body, from, from + C.width / strips + 0.5);
      if (piece.length < 6) continue;
      wash.fillStyle(tone, 0.34 * Math.pow(1 - i / strips, 1.4)).fillPoints(toPoints(piece), true);
    }
    slide.add(wash);
    const stripe = scene.add.graphics();
    const lean = C.height * C.bevel;
    stripe.fillStyle(tone, 0.95).fillPoints(toPoints([left + lean, -C.height / 2, left + lean + C.stripe, -C.height / 2, left + C.stripe, C.height / 2, left, C.height / 2]), true);
    slide.add(stripe);
    slide.add(drawShapeEdge(scene, 0, 0, this.shape(), "top", { color: tone, alpha: 0.9, width: 3 }));

    // 보상 액자 — 지금 받을 것, 없으면 다음 마디의 보상. 무엇을 주는 패스인지를 그림 한 칸이 먼저 말한다.
    const reward = passCardReward(pass);
    const tile = reward ? grantTiles(reward.grants)[0] : undefined;
    const frameX = left + C.frame.left + C.frame.size / 2;
    if (reward?.state === "ready") {
      // 받을 것이 있으면 액자 실루엣 그대로 패스 색 빛이 숨 쉰다(덮개는 그 레이어의 모양을 쓴다).
      const glow = drawLayer(scene, frameX, C.frame.y, itemFrameShape(C.frame.size, C.frame.glow), { fill: tone, alpha: 0.55 });
      slide.add(glow);
      const breath = scene.tweens.add({ targets: glow, alpha: { from: 0.85, to: 0.25 }, duration: 760, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      slide.once(Phaser.GameObjects.Events.DESTROY, () => breath.remove());
    }
    const frame = addFramedIcon(scene, fg, frameX, C.frame.y, C.frame.size, tile?.icon ?? "", {
      plain: true,
      color: reward?.state === "ready" ? tone : undefined,
      iconAlpha: reward?.state === "done" ? 0.45 : 1,
      ...(tile ? { amount: formatCurrency(tile.amount) } : {}),
    });
    if (reward?.state === "done") frame.setAlpha(0.7);

    const contentLeft = C.contentLeft;
    const contentRight = C.contentRight;
    const level = passLevelOf(pass);
    const levelText = scene.add.text(contentRight, C.nameY + 2, t("lobby.pass.level", { level: level.level, max: level.max }), textStyle({ role: "emphasis", size: C.levelSize, color: toneText }))
      .setOrigin(1, 0.5).setStroke("#05070a", 4);
    const name = scene.add.text(contentLeft, C.nameY, passName(pass), textStyle({ role: "display", size: C.nameSize, color: COLOR.ink }))
      .setOrigin(0, 0.5).setStroke("#05070a", 5);
    squeezeTextToWidth(name, contentRight - levelText.width - 12 - contentLeft, 0.7);
    fg.add([name, levelText]);

    const barWidth = contentRight - contentLeft;
    const bar = new HoloBar(scene, contentLeft + barWidth / 2, C.gauge.y, barWidth, C.gauge.height, { color: tone, trackAlpha: 0.85, outline: true, ticks: Math.max(0, level.max - 1), slant: 0 });
    bar.setValue(level.fill);
    fg.add([...bar.objects]);

    const ready = passReadyCount(pass);
    const note = scene.add.text(contentLeft, C.noteY, ready > 0 ? t("lobby.pass.ready", { count: ready }) : progressPassProgressLabel(pass),
      textStyle({ role: "emphasis", size: C.noteSize, color: ready > 0 ? "#ffcf7a" : COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#05070a", 4);
    fg.add(squeezeTextToWidth(note, barWidth - this.pagerWidth() - 12, 0.7));
    slide.add(fg);
    if (ready > 0) {
      const breath = this.scene.tweens.add({ targets: note, alpha: { from: 1, to: 0.55 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      slide.once(Phaser.GameObjects.Events.DESTROY, () => breath.remove());
    }
    return slide;
  }

  /** 넘김 표식의 폭 — 패스가 하나뿐이면 서지 않는다. */
  private pagerWidth(): number {
    const P = LOBBY_PASS_CARD.pager;
    const count = this.passes.length;
    return count < 2 ? 0 : P.active + (count - 1) * P.dash + (count - 1) * P.gap;
  }

  /** 판 안 밑줄 오른쪽 끝의 넘김 표식 — 지금 패스만 길게, 그 색으로 선다. 판 밖 배경 위에 따로 뜨지 않는다. */
  private paintDots(): void {
    const C = LOBBY_PASS_CARD;
    const P = C.pager;
    this.dots.clear();
    if (this.passes.length < 2) return;
    let x = C.contentRight - this.pagerWidth();
    const lean = P.height * 0.5;
    this.passes.forEach((pass, index) => {
      const active = index === this.index;
      const w = active ? P.active : P.dash;
      const top = P.y - P.height / 2;
      const bottom = P.y + P.height / 2;
      this.dots.fillStyle(active ? PROGRESS_PASS_TONE[pass.id] : 0xffffff, active ? 1 : 0.32)
        .fillPoints(toPoints([x + lean, top, x + w, top, x + w - lean, bottom, x, bottom]), true);
      x += w + P.gap;
    });
  }
}

/** 판에 서는 값(레벨·받을 칸·진행도)만 모은 서명. */
function passSignature(passes: readonly ProgressPassDto[]): string {
  return JSON.stringify(passes.map((pass) => [pass.id, pass.owned, pass.progress, passReadyCount(pass), passLevelOf(pass).level, progressPassProgressLabel(pass)]));
}

/** 다각형(x, y 평탄 배열)을 세로 띠 [minX, maxX]로 자른다 — 볼록 도형이면 충분하다. */
function clipToColumn(shape: number[], minX: number, maxX: number): number[] {
  const clip = (points: number[], keep: (x: number) => boolean, edge: number): number[] => {
    const out: number[] = [];
    const count = points.length / 2;
    for (let i = 0; i < count; i += 1) {
      const ax = points[i * 2]!, ay = points[i * 2 + 1]!;
      const bx = points[((i + 1) % count) * 2]!, by = points[((i + 1) % count) * 2 + 1]!;
      if (keep(ax)) out.push(ax, ay);
      if (keep(ax) !== keep(bx)) out.push(edge, ay + ((by - ay) * (edge - ax)) / (bx - ax));
    }
    return out;
  };
  return clip(clip(shape, (x) => x >= minX, minX), (x) => x <= maxX, maxX);
}
