import Phaser from "phaser";
import { HoloBar } from "./holo";
import { formatEffectRemaining } from "./excavationAdOfferModel";
import { squeezeTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";
import { t } from "../i18n";

/**
 * 발굴 효과의 색 — 보관 게이지의 늘어난 몫과 광고 버튼 아래 남은 시간 줄이 같은 값을 읽는다.
 * 발굴 판의 옛 토큰(`COLOR.excavationProduction`·`excavationStorage`)은 어두운 판의 면 색이라, 줄로 그으면
 * 배경 원화 위에서 가라앉는다. 같은 계열을 한 톤 밝힌 값이다.
 */
export const EXCAVATION_EFFECT_TONE = { production: 0x6fd6dc, storage: 0xb79af0 } as const;
/** 같은 색의 글자 표기. */
export const EXCAVATION_EFFECT_TEXT = { production: "#6fd6dc", storage: "#b79af0" } as const;

/** 보관 게이지의 자리 — 발굴 현황의 SD 발밑과 누적 판 사이 좁은 띠. x는 판 가운데가 0이다. */
export const STORAGE_GAUGE_LAYOUT = {
  /** 머리줄(보관량 63% · 가득 차기까지 2:57:00)의 세로 중심. */
  headY: -160,
  /** 게이지의 세로 중심. */
  barY: -122,
  width: 700,
  height: 22,
  /** 보관 2배가 켜졌을 때 기본 몫과 늘어난 몫 사이의 틈. */
  seam: 12,
  /** 기본 보관 시간을 한 칸 한 시간으로 나눈 눈금 수(8시간 → 칸 8, 선 7). */
  ticks: 7,
  titleSize: 22,
  percentSize: 36,
  etaSize: 20,
} as const;

/**
 * 발굴 보관량 게이지 한 장.
 *
 * 예전에는 가운데 작은 「보관량 63%」 글자 아래 가는 줄 하나였고, 보관 2배가 켜지면 같은 줄이 한 줄 더 쌓였다 —
 * 두 줄이 같은 폭이라 「늘어났다」가 아니라 「하나 더 있다」로 읽혔다. 지금은 왼쪽에 이름과 큰 %가, 오른쪽에
 * **가득 차기까지 남은 시간**이 서고(행동을 정하는 수다 — 언제 다시 들어와야 하는가), 게이지는 한 시간 한 칸으로
 * 눈금이 나뉜다. 보관 2배가 켜지면 같은 한 줄이 둘로 갈려 왼쪽이 기본 몫, 오른쪽이 늘어난 몫(효과 색)이다.
 */
export class ExcavationStorageGauge {
  private readonly percent: Phaser.GameObjects.Text;
  private readonly cap?: Phaser.GameObjects.Text;
  private readonly eta: Phaser.GameObjects.Text;
  private readonly base: HoloBar;
  private readonly extension?: HoloBar;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, opts: { extended: boolean; limitRatio: number; reduceMotion: boolean }) {
    const L = STORAGE_GAUGE_LAYOUT;
    const left = -L.width / 2;
    const title = scene.add.text(left, L.headY, t("excavation.storage"), textStyle({ role: "emphasis", size: L.titleSize, color: COLOR.inkDim })).setOrigin(0, 0.5).setStroke("#05070a", 5);
    this.percent = scene.add.text(left + title.width + 12, L.headY, "", textStyle({ role: "display", size: L.percentSize, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 6).setScale(1, 1.08);
    parent.add([title, this.percent]);
    if (opts.extended) {
      // 늘어난 한도는 %의 분모로 붙는다 — 100을 넘는 수가 왜 넘는지 그 자리에서 읽힌다.
      this.cap = scene.add.text(0, L.headY + 4, `/ ${Math.round(opts.limitRatio * 100)}%`, textStyle({ role: "emphasis", size: L.titleSize, color: EXCAVATION_EFFECT_TEXT.storage })).setOrigin(0, 0.5).setStroke("#05070a", 5);
      parent.add(this.cap);
    }
    this.eta = scene.add.text(-left, L.headY, "", textStyle({ role: "emphasis", size: L.etaSize, color: COLOR.ink })).setOrigin(1, 0.5).setStroke("#05070a", 5);
    parent.add(this.eta);
    const bar = (x: number, width: number, color: number, phase: number): HoloBar =>
      new HoloBar(scene, x, L.barY, width, L.height, { color, trackAlpha: 0.82, outline: true, ticks: L.ticks, shadow: { offsetY: 5, alpha: 0.6 }, glow: { alpha: 0.32 }, shimmer: { still: opts.reduceMotion, phase } }).addTo(parent);
    if (opts.extended) {
      const half = (L.width - L.seam) / 2;
      this.base = bar(-(half + L.seam) / 2, half, COLOR.accent, 0);
      this.extension = bar((half + L.seam) / 2, half, EXCAVATION_EFFECT_TONE.storage, 0.5);
    } else {
      this.base = bar(0, L.width, COLOR.accent, 0);
    }
  }

  /** `fill`은 기본 보관 시간을 1로 둔 몫이다. `reveal`은 늘어난 몫이 펼쳐지는 연출의 진행(0~1). */
  setFill(fill: number, reveal = 1): void {
    this.base.setValue(Math.max(0, Math.min(1, fill)));
    this.extension?.setValue(Math.max(0, Math.min(1, fill - 1)) * reveal);
    this.percent.setText(`${Math.round(Math.max(0, fill) * 100)}%`);
    if (this.cap) this.cap.setX(this.percent.x + this.percent.displayWidth + 8);
  }

  /** 가득 차기까지 남은 초. 0이면 가득, `undefined`면 쌓이는 것이 없다. */
  setEta(seconds: number | undefined): void {
    const L = STORAGE_GAUGE_LAYOUT;
    if (seconds === undefined) this.eta.setText(t("excavation.noProduction")).setColor(COLOR.inkDim);
    else if (seconds <= 0) this.eta.setText(t("excavation.storageFull")).setColor(COLOR.accentText);
    else this.eta.setText(t("excavation.untilFull", { time: formatEffectRemaining(seconds * 1000) })).setColor(COLOR.ink);
    // 머리줄 왼쪽(이름 + %)과 부딪히지 않게 남은 폭 안으로만 누른다.
    const leftEnd = (this.cap ? this.cap.x + this.cap.width : this.percent.x + this.percent.displayWidth) + 24;
    this.eta.setScale(1);
    squeezeTextToWidth(this.eta, L.width / 2 - leftEnd);
  }
}
