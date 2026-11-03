/**
 * 보물상자 원화의 등급별 색 — 원화는 한 벌(닫힘·열림)뿐이고, 등급마다 **상자 몸통**(복숭아빛 판)과 **띠**(크림빛 테)만
 * 다른 색으로 다시 칠한다. 윤곽선(짙은 갈색)·열쇠 구멍·안의 보물은 그대로 둔다.
 *
 * 몸통과 띠는 색상·채도·밝기로 가른다. 붓결 때문에 경계가 거칠어 딱 자르면 얼룩이 남으므로, 문턱 근처는 가중치로
 * 원래 색과 섞는다. 열린 원화는 보물 칸(`protect`) 안에서 아주 진한 붉은빛(딸기)을 몸통으로 보지 않는다.
 *
 * Phaser를 읽지 않는 순수 함수다 — 화면은 캔버스 픽셀을 넘기기만 한다.
 */
export interface ChestTone {
  /** 색상(도), 채도 배율, 밝기 배율. */
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}
export interface ChestGradeLook {
  readonly body?: ChestTone;
  readonly band?: ChestTone;
  /** 상자 뒤 빛무리·반짝임의 색. */
  readonly glow: number;
}

/** 0 원래 복숭아빛 → 1 민트 → 2 하늘 → 3 보라에 금빛 띠 → 4 황금에 은빛 띠. */
export const CHEST_GRADE_LOOKS: readonly ChestGradeLook[] = [
  { glow: 0xffc7a8 },
  { body: { hue: 158, saturation: 0.55, lightness: 1 }, glow: 0x9fe8cc },
  { body: { hue: 205, saturation: 0.7, lightness: 0.98 }, glow: 0x9fd2ff },
  { body: { hue: 272, saturation: 0.62, lightness: 0.95 }, band: { hue: 48, saturation: 0.75, lightness: 1 }, glow: 0xd2b4ff },
  { body: { hue: 40, saturation: 0.92, lightness: 0.92 }, band: { hue: 200, saturation: 0.25, lightness: 1.06 }, glow: 0xffe27a },
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}
function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s <= 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const t = h / 360;
  return [hueToRgb(p, q, t + 1 / 3), hueToRgb(p, q, t), hueToRgb(p, q, t - 1 / 3)];
}
const ramp = (value: number, from: number, to: number): number => Math.max(0, Math.min(1, (value - from) / (to - from)));

/** 몸통일 가중치 — 복숭아·분홍·그늘진 자줏빛. */
export function chestBodyWeight(h: number, s: number, l: number): number {
  const hueWeight = h >= 300 || h <= 22 ? 1 : h < 150 ? 1 - ramp(h, 22, 32) : ramp(h, 272, 300);
  return hueWeight * ramp(s, 0.1, 0.2) * ramp(l, 0.3, 0.38) * (1 - ramp(l, 0.88, 0.94));
}
/** 띠일 가중치 — 밝은 크림빛. */
export function chestBandWeight(h: number, s: number, l: number): number {
  const hueWeight = ramp(h, 26, 32) * (1 - ramp(h, 60, 66));
  return hueWeight * ramp(s, 0.25, 0.35) * ramp(l, 0.68, 0.74);
}

export interface ChestRecolorOptions {
  /** 이 칸 안에서는 아주 진한 빛(채도 0.7 이상)을 몸통으로 보지 않는다 — 열린 상자의 보물. */
  readonly protect?: { x: number; y: number; width: number; height: number };
}

/** RGBA 픽셀을 그 자리에서 다시 칠한다. 0등급은 아무것도 바꾸지 않는다. */
export function recolorChestPixels(data: Uint8ClampedArray, width: number, look: ChestGradeLook, options: ChestRecolorOptions = {}): void {
  if (!look.body && !look.band) return;
  const protect = options.protect;
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 8) continue;
    const r = data[index] / 255, g = data[index + 1] / 255, b = data[index + 2] / 255;
    const [h, s, l] = rgbToHsl(r, g, b);
    let bodyWeight = look.body ? chestBodyWeight(h, s, l) : 0;
    if (protect && bodyWeight > 0) {
      const pixel = index / 4, x = pixel % width, y = Math.floor(pixel / width);
      if (x >= protect.x && x < protect.x + protect.width && y >= protect.y && y < protect.y + protect.height) bodyWeight *= 1 - ramp(s, 0.62, 0.72);
    }
    const bandWeight = look.band ? chestBandWeight(h, s, l) : 0;
    const weight = Math.max(bodyWeight, bandWeight);
    if (weight <= 0) continue;
    const tone = bodyWeight >= bandWeight ? look.body! : look.band!;
    const [nr, ng, nb] = hslToRgb(tone.hue, Math.min(1, tone.saturation * (0.5 + s * 0.8)), Math.min(1, l * tone.lightness));
    data[index] = Math.round((r + (nr - r) * weight) * 255);
    data[index + 1] = Math.round((g + (ng - g) * weight) * 255);
    data[index + 2] = Math.round((b + (nb - b) * weight) * 255);
  }
}
