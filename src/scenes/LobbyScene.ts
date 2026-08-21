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
import { RailButton } from "../ui/RailButton";
import { TopBar } from "../ui/TopBar";
import { chipPoints, drawHairline, drawLayer, drawVignette, HOLO, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { gameApi } from "../api/FakeServer";
import { bondDialogue } from "../data/bonds";
import { DAILY_RESTORATION } from "../data/stages";

/** 확대된 애착 렐릭의 골반 아래가 내비게이션 뒤로 자연스럽게 이어지는 기준선. */
const STAGE_FLOOR = 1660;

/** 교류의 강조색. 출격의 주황과 마주 보는 자리라 성격이 다른 색을 쓴다. */
const EXCHANGE_BLUE = 0x6fa8d6;
/** 출격의 강조색. 금색보다 붉게 기울여 "나가서 싸운다"는 신호를 준다. */
const SORTIE_ORANGE = 0xe8913c;

/**
 * 애착 렐릭이 들어가야 하는 상자.
 *
 * 로비의 주인공이므로 최대한 키우되, 꼬리까지 포함한 외곽 상자 대신 중심 관절을 화면 중앙에 둔다.
 * **가로 폭**으로 지나친 확대만 막고, 긴 꼬리 끝은 안전 영역 밖으로 자연스럽게 흘려보낸다.
 * 아래쪽도 화면 밖으로 조금 이어서 발끝이 내비게이션 뒤에 숨도록 한다.
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
  /** 같은 방문 중 반복 터치의 대사 변형 순번이며 보상 중복 판정은 서버 날짜가 담당한다. */
  private interactionIndex = 0;
  private interactionPending = false;

  constructor() {
    super("lobby");
  }

  create(): void {
    setDebugScene("lobby");

    this.buildPlaza();
    new TopBar(this, 40, { onSettings: () => this.notReady("설정") });
    this.buildPromo();
    this.buildSideRail();

    // 원정 — 지도 위를 가리던 일일 복원을 로비의 독립된 일일 콘텐츠 입구로 옮긴다.
    // 자리와 기울기는 출격과 한 벌이라 같은 원근을 쓴다.
    const expeditionButton = new Button(this, BASE_WIDTH - 300, NAV_TOP - 400, {
      width: 340,
      height: 112,
      label: "원정",
      sub: this.expeditionStatus(),
      fontSize: 36,
      variant: "primary",
      perspective: "left",
      tilt: -6,
      onClick: () => {
        expeditionButton.setEnabled(false);
        // 입장 소비와 보상 지급은 기존처럼 API가 한 처리 단위로 저장하며 로비는 결과만 표시한다.
        void gameApi.enterDailyRestoration().then((result) => {
          expeditionButton.setSub(`잡초 +${result.weedsEarned} · 남은 ${result.entriesRemaining}/${DAILY_RESTORATION.maxEntriesPerUtcDay}`);
          expeditionButton.setEnabled(result.entriesRemaining > 0);
        }).catch(() => expeditionButton.setSub("오늘의 원정 완료"));
      },
    });

    // 출격 — 로비에서 가장 큰 버튼이다. 주황빛 강조로 다른 입구와 구분한다.
    new Button(this, BASE_WIDTH - 290, NAV_TOP - 245, {
      width: 520,
      height: 170,
      label: "출  격",
      sub: "SORTIE",
      fontSize: 52,
      variant: "primary",
      perspective: "left",
      tilt: -6,
      accentColor: SORTIE_ORANGE,
      accentTextColor: "#f2b070",
      onClick: () => this.scene.start("stageMap"),
    });

    // 교류 — 맞은편이라 기울기와 원근을 뒤집어 `\` 방향으로 눕힌다.
    new Button(this, 300, NAV_TOP - 400, {
      width: 340,
      height: 112,
      label: "교류",
      sub: "EXCHANGE",
      fontSize: 36,
      variant: "primary",
      perspective: "right",
      tilt: 6,
      accentColor: EXCHANGE_BLUE,
      accentTextColor: "#9fd0f0",
      onClick: () => this.notReady("교류"),
    });

    new BottomNav(this, "lobby");
    void this.showFavorite();
  }

  /** 저장된 UTC 일일 입장 횟수를 로비 원정 버튼의 짧은 상태 문구로 바꾼다. */
  private expeditionStatus(): string {
    const remaining = Math.max(0, DAILY_RESTORATION.maxEntriesPerUtcDay - session.dailyContent.restorationEntries);
    return `일일 복원 · 남은 ${remaining}/${DAILY_RESTORATION.maxEntriesPerUtcDay}`;
  }

  /** 연구소에서 옮긴 채광 설비·식물 원화를 로비 광장 배경으로 사용한다. */
  private buildPlaza(): void {
    const cx = BASE_WIDTH / 2;
    addSceneBackground(this, BACKGROUND.lobby);
    // 가장자리를 눌러 화면 가운데의 렐릭에 눈이 먼저 가게 한다.
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: -26, strength: 0.62 });
    // 하단 조작부의 글자 대비를 유지하되 원화는 은은하게 이어 보이도록 반투명 바닥만 얹는다.
    this.add
      .rectangle(cx, (STAGE_FLOOR + NAV_TOP) / 2, BASE_WIDTH, NAV_TOP - STAGE_FLOOR, COLOR.void, 0.24)
      .setDepth(-29);
    drawHairline(this, cx, STAGE_FLOOR, BASE_WIDTH, { color: COLOR.accent, alpha: 0.14 }).setDepth(-28);

    this.add
      .text(cx, 196, "이터널 시티 · 중앙 광장", textStyle({ role: "body", size: 26, color: COLOR.inkDim }))
      .setOrigin(0.5, 0)
      .setAlpha(0.85);
  }

  /**
   * 오른쪽 세로 줄.
   *
   * 늘 쓰지만 화면의 주인공은 아닌 편의 기능들이다. 캐릭터를 가리지 않도록 가장자리에 세우고
   * 크기도 출격·교류보다 한참 작게 둔다.
   */
  private buildSideRail(): void {
    const x = BASE_WIDTH - 106;
    const rail = [
      { icon: "shop", label: "상점" },
      { icon: "mail", label: "우편" },
      { icon: "friends", label: "친구" },
    ] as const;
    rail.forEach((item, i) => {
      new RailButton(this, x, 640 + i * 152, { icon: item.icon, label: item.label, onClick: () => this.notReady(item.label) });
    });
  }

  /** 왼쪽 위, 프로필 줄 바로 아래의 홍보 칸. 기간 상품과 공지가 들어갈 자리다. */
  private buildPromo(): void {
    const width = 300;
    const height = 132;
    const x = 30 + width / 2;
    const y = 250;
    drawLayer(this, x, y, chipPoints(width, height, {
      bevel: { topLeft: height * 0.42, topRight: 0, bottomRight: height * 0.42, bottomLeft: 0 },
    }), { fill: 0x1a1f27, alpha: HOLO.glass, edge: COLOR.accent, edgeAlpha: 0.5 });
    this.add.text(x, y - 26, "월간 화석 패스", textStyle({ role: "display", size: 28 })).setOrigin(0.5);
    this.add.text(x, y + 16, "준비 중", textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0.5);
    const hit = this.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerup", () => this.notReady("월간 화석 패스"));
  }

  /** 애착 렐릭을 광장 한가운데 세우고, 전용 원화가 없을 때만 임시 색으로 구분한다. */
  private async showFavorite(): Promise<void> {
    const def = getRelic(session.favorite);
    const asset = portraitAssetFor(def.portraitAssetId);
    const content = asset.content;
    // 원화 폭과 상자 높이 중 더 빡빡한 제한을 골라 과도하게 확대되는 것만 막는다.
    const height = Math.min(
      LOBBY_BOX.bottom - LOBBY_BOX.top,
      ((LOBBY_BOX.right - LOBBY_BOX.left) * (content.bottom - content.top)) / (content.right - content.left),
    );
    this.favorite = await spawnPuppet(this, asset, {
      // 꼬리가 긴 렉시아도 그림 외곽이 아니라 `중심1` 관절이 광장 중앙에 오도록 맞춘다.
      focusX: { anchor: "core", x: (LOBBY_BOX.left + LOBBY_BOX.right) / 2 },
      // 위를 상자 천장에 맞추면 남는 만큼만 아래로 내려가 발끝이 화면 밖으로 살짝 나간다.
      groundY: LOBBY_BOX.top + height,
      height,
      // 전용 원화가 연결된 두 캐릭터는 원본 색을 유지한다.
      tint: portraitUsesRelicTint(def.portraitAssetId) ? mixWhite(tintFor(def.id), 0.55) : undefined,
      depth: -20,
    });
    enableHitOnClick(this, this.favorite);
    this.favorite.on("pointerup", () => this.interactWithFavorite(def.id));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.favorite?.destroy());

    // 캐릭터 하단 이름/종 설명은 제거해 로비가 원화 감상 화면처럼 보이게 한다.
  }

  /** Puppet hit 반응과 함께 짧은 대사 및 서버가 확정한 일일 유대 결과를 표시한다. */
  private interactWithFavorite(relicId: string): void {
    if (this.interactionPending) return;
    this.interactionPending = true;
    void gameApi.interactInLobby(relicId).then((result) => {
      const progress = result.relicProgress[relicId];
      const dialogue = bondDialogue(relicId, progress.bondLevel, this.interactionIndex++);
      const reward = result.bondXpEarned > 0 ? `\n유대 EXP +${result.bondXpEarned}${result.bondLevelsGained ? ` · LEVEL UP +${result.bondLevelsGained}` : ""}` : "";
      this.showLine(getRelic(relicId).name, dialogue.text, reward, dialogue.id);
    }).finally(() => { this.interactionPending = false; });
  }

  /**
   * 로비 대사.
   *
   * 화면을 최대한 덜 가리도록 이름줄과 대사줄만 덮는 얇은 띠를 쓴다. 대신 그 띠는 충분히
   * 불투명해서 배경이 아무리 밝아도 글자가 뭉개지지 않는다. 경계는 판때기가 아니라 위아래
   * 선 두 줄이 잡고, 이름 옆으로 이어지는 짧은 선이 이름과 대사를 가른다.
   */
  private showLine(name: string, line: string, reward: string, dialogueId: string): void {
    const cy = 900;
    const left = 96;
    const width = BASE_WIDTH - left * 2;
    const layer = this.add.container(0, 0).setDepth(500);

    layer.add(drawLayer(this, BASE_WIDTH / 2, cy + 4, slantedRect(width, 176, 18), {
      fill: 0x05070a,
      alpha: 0.94,
      shadow: false,
    }));
    // 위는 밝게, 아래는 옅게 그어 빛이 위에서 내려오는 것처럼 보이게 한다.
    layer.add(drawHairline(this, BASE_WIDTH / 2, cy - 82, width - 10, { color: COLOR.accent, alpha: 0.8 }));
    layer.add(drawHairline(this, BASE_WIDTH / 2, cy + 90, width - 10, { color: COLOR.accent, alpha: 0.3 }));

    // 이름 왼쪽의 두꺼운 막대. 누가 말하는지를 한 글자보다 먼저 알린다.
    const bar = this.add.rectangle(left + 30, cy - 44, 9, 46, COLOR.accent, 0.95).setOrigin(0, 0.5);
    layer.add(bar);
    const nameText = this.add
      .text(left + 54, cy - 66, name, textStyle({ role: "display", size: 38, color: COLOR.accentText }))
      .setOrigin(0, 0);
    layer.add(nameText);
    // 이름과 대사 사이를 가르는 긴 선. 띠의 폭을 그대로 그어 두 줄의 성격을 나눈다.
    layer.add(drawHairline(this, BASE_WIDTH / 2, cy - 16, width - 60, { color: COLOR.accent, alpha: 0.45 }));

    const text = this.add
      .text(left + 30, cy + 4, `“${line}”${reward}`, textStyle({ role: "body", size: 34, color: COLOR.ink, lineSpacing: 8, wrap: width - 60 }))
      .setOrigin(0, 0);
    // 대사 ID는 번역/분석 추적용으로 객체에 남기되 플레이어 화면에는 노출하지 않는다.
    text.setData("dialogueId", dialogueId);
    layer.add(text);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, y: -22, duration: 240, ease: "Sine.easeOut" });
    this.tweens.add({ targets: layer, alpha: 0, y: -64, delay: 2200, duration: 420, onComplete: () => layer.destroy() });
  }

  private notReady(label: string): void {
    const toast = this.add
      .text(BASE_WIDTH / 2, NAV_TOP - 300, `${label} — 준비 중`, textStyle({ role: "emphasis", size: 30, color: COLOR.accentText }))
      .setOrigin(0.5)
      .setDepth(500);
    this.tweens.add({ targets: toast, alpha: 0, duration: 1200, onComplete: () => toast.destroy() });
  }
}
