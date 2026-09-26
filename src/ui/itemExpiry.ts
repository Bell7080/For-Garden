import Phaser from "phaser";
import { nextExpiringLot, remainingLabel, remainingParts } from "../core/itemLots";
import { t } from "../i18n";
import { session } from "../state/session";
import { slantedRect, toPoints } from "./holo";
import { textStyle } from "./theme";

/**
 * 가방 한 칸에서 **가장 먼저 사라질 묶음**의 수와 남은 시간 — 가방 칸·안내창·스테미나 창이 같은 값을
 * 쓴다. 기한이 없는 칸은 없다. 시각은 기기 시계로 재지만, 걷는 일은 서버가 한다
 * (`FakeServer.settleItemExpiry`) — 여기서는 보여 주기만 한다.
 */
export function soonestItemExpiry(itemId: string, now = new Date()): { count: number; time: string; expiresAt: string } | undefined {
  const lot = nextExpiringLot(session.itemInventory.find((stack) => stack.itemId === itemId));
  if (!lot || Date.parse(lot.expiresAt) <= now.getTime()) return undefined;
  return { count: lot.quantity, time: remainingLabel(lot.expiresAt, now), expiresAt: lot.expiresAt };
}

/**
 * 안내창의 자세한 남은 시간 — 하루 넘게 남으면 「2일 5시간」, 하루 안이면 「5시간 7분」, 한 시간 안이면
 * 「7분 9초」. 두 단위만 적는다(셋을 적으면 한 줄이 길어지고 가장 큰 단위가 이미 무게를 말한다).
 */
export function remainingDetail(expiresAt: string, now = new Date()): string {
  const { days, hours, minutes, seconds } = remainingParts(expiresAt, now);
  if (days > 0) return t("inventory.expiry.days", { days, hours });
  if (hours > 0) return t("inventory.expiry.hours", { hours, minutes });
  return t("inventory.expiry.minutes", { minutes, seconds });
}

/** 표식의 결. 붉은 판이지만 짙게 눌러 액자 그림보다 먼저 읽히지 않게 한다. */
export const EXPIRY_TAG = { height: 30, padX: 12, slant: 7, fontSize: 19, fill: 0x7a1f26, fillAlpha: 0.86, edge: 0xe07a7a, ink: "#ffd9d9" } as const;

/**
 * 기한 표식 — 가방 칸 왼쪽 위에 앉는 작은 **빗긴 붉은 판**(`7D` · `24H` · `60M`).
 *
 * 붉은 글자만 띄우던 때는 액자 그림과 겹쳐 읽히지 않았고, 판을 밝게 칠하면 수량보다 먼저 눈에 걸린다 —
 * 짙은 붉은 판 + 옅은 분홍 글자로 「기한이 있다」까지만 말한다. **초마다 다시 적어** 창을 열어 둔 채
 * 경계를 넘어도(`2D` → `48H`는 없다 · `1D` → `24H`) 제 한 마디로 바뀐다. 기한이 지나면 스스로 감춘다
 * (걷는 일은 서버가 다음 응답에서 한다). 원점은 판의 **왼쪽 위**다.
 */
export function addExpiryTag(scene: Phaser.Scene, x: number, y: number, expiresAt: string): Phaser.GameObjects.Container {
  const E = EXPIRY_TAG;
  const tag = scene.add.container(x, y);
  const plate = scene.add.graphics();
  const label = scene.add.text(0, E.height / 2, "", textStyle({ role: "display", size: E.fontSize, color: E.ink })).setOrigin(0.5, 0.5);
  tag.add([plate, label]);
  let shown = "";
  const repaint = (): void => {
    if (Date.parse(expiresAt) <= Date.now()) { tag.setVisible(false); return; }
    const text = remainingLabel(expiresAt, new Date());
    if (text === shown) return;
    shown = text;
    label.setText(text);
    // 판은 글자 폭이 바뀔 때만 같은 Graphics에 다시 그린다.
    const width = label.width + E.padX * 2;
    label.setX(width / 2);
    const points = toPoints(slantedRect(width, E.height, E.slant)).map((point) => new Phaser.Geom.Point(point.x + width / 2, point.y + E.height / 2));
    plate.clear().fillStyle(E.fill, E.fillAlpha).fillPoints(points, true);
    plate.lineStyle(2, E.edge, 0.7).lineBetween(points[0].x, points[0].y, points[1].x, points[1].y);
  };
  repaint();
  const timer = scene.time.addEvent({ delay: 1000, loop: true, callback: repaint });
  tag.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove(false));
  return tag;
}
