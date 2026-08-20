import Phaser from "phaser";
import type { PuppetCreature } from "../puppets/assets";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { getRelic } from "../data/relics";
import { enableHitOnClick, portraitAssetFor, portraitUsesRelicTint, spawnPuppet } from "../puppets/assets";
import { mixWhite, tintFor } from "../puppets/tints";
import { session } from "../state/session";
import { BottomNav, NAV_TOP } from "../ui/BottomNav";
import { Button } from "../ui/Button";
import { TopBar } from "../ui/TopBar";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";

/** 확대된 애착 렐릭의 골반 아래가 내비게이션 뒤로 자연스럽게 이어지는 기준선. */
const STAGE_FLOOR = 1660;

/**
 * 애착 렐릭이 들어가야 하는 상자.
 *
 * 로비의 주인공이므로 최대한 키우되 좌우와 정수리는 절대 자르지 않는다. 그래서 세로가 아니라
 * **가로 폭**이 크기를 정한다 — 상자 안에 온전히 들어가는 최대 높이를 캐릭터마다 계산한다.
 * 아래쪽만 화면 밖으로 조금 흘려보내 발끝이 내비게이션 뒤로 이어지게 한다.
 */
const LOBBY_BOX = { left: 26, right: BASE_WIDTH - 26, top: 190, bottom: BASE_HEIGHT + 40 } as const;

/**
 * 로비 — 메인 화면.
 *
 * 연구소 광장에 애착 렐릭이 서 있고, 그 위에 출격과 상점 같은 버튼이 얹힌다.
 * 앞으로 상점 · 프로필 · 우편 같은 것들이 붙을 자리라 버튼 자리를 미리 잡아 두었다.
 */
export class LobbyScene extends Phaser.Scene {
  private favorite?: PuppetCreature;

  constructor() {
    super("lobby");
  }

  create(): void {
    setDebugScene("lobby");

    this.buildPlaza();
    new TopBar(this);

    // 좌측 세로 버튼 줄 — 앞으로 늘어날 BM · 편의 기능 자리.
    const sideLabels = ["상점", "우편", "프로필"];
    sideLabels.forEach((label, i) => {
      new Button(this, 150, 320 + i * 150, {
        width: 220,
        height: 110,
        label,
        fontSize: 30,
        onClick: () => this.notReady(label),
      });
    });

    // 출격 — 로비에서 가장 큰 버튼이다.
    new Button(this, BASE_WIDTH - 300, NAV_TOP - 140, {
      width: 500,
      height: 160,
      label: "출  격",
      sub: "SORTIE",
      fontSize: 48,
      onClick: () => this.scene.start("stageMap"),
    });

    new BottomNav(this, "lobby");
    void this.showFavorite();
  }

  /** 연구소에서 옮긴 채광 설비·식물 원화를 로비 광장 배경으로 사용한다. */
  private buildPlaza(): void {
    const cx = BASE_WIDTH / 2;
    addSceneBackground(this, BACKGROUND.lobby);
    // 하단 조작부의 글자 대비를 유지하되 원화는 은은하게 이어 보이도록 반투명 바닥만 얹는다.
    this.add
      .rectangle(cx, (STAGE_FLOOR + NAV_TOP) / 2, BASE_WIDTH, NAV_TOP - STAGE_FLOOR, COLOR.void, 0.24)
      .setDepth(-29);
    this.add.rectangle(cx, STAGE_FLOOR, BASE_WIDTH, 3, COLOR.panelEdge).setDepth(-28);

    // 확대한 원화가 뒤로 지나가므로 지명은 얇은 어두운 판 위에 얹어 대비를 지킨다.
    this.add.rectangle(cx, 219, 470, 56, COLOR.void, 0.62);
    this.add
      .text(cx, 200, "이터널 시티 · 중앙 광장", textStyle({ size: 30, color: COLOR.inkDim }))
      .setOrigin(0.5, 0);
  }

  /** 애착 렐릭을 광장 한가운데 세우고, 전용 원화가 없을 때만 임시 색으로 구분한다. */
  private async showFavorite(): Promise<void> {
    const def = getRelic(session.favorite);
    const asset = portraitAssetFor(def.portraitAssetId);
    const content = asset.content;
    // 좌우가 잘리지 않는 최대 높이와 상자 높이 중 작은 쪽을 고른다.
    const height = Math.min(
      LOBBY_BOX.bottom - LOBBY_BOX.top,
      ((LOBBY_BOX.right - LOBBY_BOX.left) * (content.bottom - content.top)) / (content.right - content.left),
    );
    this.favorite = await spawnPuppet(this, asset, {
      x: (LOBBY_BOX.left + LOBBY_BOX.right) / 2,
      // 위를 상자 천장에 맞추면 남는 만큼만 아래로 내려가 발끝이 화면 밖으로 살짝 나간다.
      groundY: LOBBY_BOX.top + height,
      height,
      // 전용 원화가 연결된 두 캐릭터는 원본 색을 유지한다.
      tint: portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined,
      depth: -20,
    });
    enableHitOnClick(this, this.favorite);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.favorite?.destroy());

    // 캐릭터 하단 이름/종 설명은 제거해 로비가 원화 감상 화면처럼 보이게 한다.
  }

  private notReady(label: string): void {
    const toast = this.add
      .text(BASE_WIDTH / 2, NAV_TOP - 300, `${label} — 준비 중`, textStyle({ size: 30, color: COLOR.accentText }))
      .setOrigin(0.5)
      .setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, duration: 1200, onComplete: () => toast.destroy() });
  }
}
