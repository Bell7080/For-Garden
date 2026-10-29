import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { getRelic } from "../data/relics";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { ACCOUNT_GUIDE } from "./accountIdPopupLayout";
import { DialogueBubble } from "./DialogueBubble";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { logError } from "../managers/ErrorReporter";

export interface AccountGuide {
  /** 한 마디 띄우고 한 번 뛴다. 같은 말을 다시 불러도 다시 선다. */
  say(key: TextKey): void;
}

/**
 * 계정 창(아이디·이메일)의 안내역 — 토리카가 판 윗변에 올라서서 말풍선으로 맞아 준다.
 *
 * 판 안에 설명문을 하나 더 쌓지 않고, 지금 탭이 무엇을 하는 자리인지를 **한 마디**로만 말한다.
 * SD를 누르면 한 번 뛰며 다른 말을 한다. 판이 사라지면 SD·그림자도 함께 놓는다.
 */
export function addAccountGuide(scene: Phaser.Scene, body: Phaser.GameObjects.Container, width: number, height: number): AccountGuide {
  const G = ACCOUNT_GUIDE;
  const top = -height / 2;
  const sdX = width / 2 - G.sd.inset;
  const depth = (body.parentContainer?.depth ?? 0) + 1;
  const bubble = new DialogueBubble(scene, {
    centerX: -width / 2 + G.bubble.inset + G.bubble.width / 2, width: G.bubble.width,
    y: top - G.bubble.lift, bodySize: G.bubble.bodySize, nameSize: G.bubble.nameSize, minHeight: G.bubble.minHeight, parent: body,
  });
  const name = getRelic("torika").name;
  let figure: PuppetCreature | undefined;
  let shadow: Phaser.GameObjects.Container | undefined;
  let hop: Phaser.Tweens.Tween | undefined;
  let restY = 0;
  let disposed = false;
  let poke = 0;
  let current: TextKey | undefined;

  const jump = (): void => {
    if (!figure) return;
    hop?.stop();
    figure.y = restY;
    hop = startPuppetHop(scene, figure, 0, { once: true });
  };
  const say = (key: TextKey): void => {
    if (disposed) return;
    current = key;
    bubble.say(name, t(key), { holdMs: G.bubble.holdMs });
    jump();
  };
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    hop?.stop();
    figure?.destroy();
    shadow?.destroy();
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  };
  body.once(Phaser.GameObjects.Events.DESTROY, cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);

  // SD는 판 밖으로 머리를 내밀어 서므로 판보다 넓게 받는다. 누르면 콕 찔린 듯 한 마디 한다.
  const hit = scene.add.rectangle(sdX, top - G.sd.height / 2 + G.sd.sink, G.sd.hitWidth, G.sd.height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerup", () => {
    const pokes = G.pokeKeys;
    const key = pokes[poke++ % pokes.length];
    say(key);
    // 찌르기 말이 끝나면 지금 탭의 말로 돌아온다 — 다음에 볼 때 무엇을 하는 자리인지 다시 말한다.
    const back = current;
    scene.time.delayedCall(G.pokeReturnMs, () => { if (!disposed && current === key && back) say(back); });
  });
  body.add(hit);

  void spawnPuppet(scene, sdAssetFor("torika"), {
    x: body.x + sdX, groundY: body.y + top + G.sd.sink, height: G.sd.height, depth,
  }).then((next) => {
    if (disposed) { next.destroy(); return; }
    next.setName("account-guide-torika");
    next.disableInteractive();
    figure = next;
    restY = next.y;
    shadow = addSdFootShadow(scene, body.x + sdX, body.y + top + G.sd.sink, G.sd.shadow).setDepth(depth - 0.1);
    jump();
  }).catch((error) => logError("puppet.display", "계정 안내 SD 표시 실패", error));

  return { say };
}
