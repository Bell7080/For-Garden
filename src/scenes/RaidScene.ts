import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { RaidContributionEntryDto, RaidSeasonResponse } from "../api/contracts";
import { GameApiError } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { RAID_SEASON_BOSS } from "../data/raid";
import { getRelic } from "../data/relics";
import { setDebugRaidStage, setDebugScene } from "../debug";
import { t } from "../i18n";
import { portraitAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "../ui/Button";
import { FaceFrame } from "../ui/FaceFrame";
import { addBackButton } from "../ui/IconButton";
import { addSectionTitle } from "../ui/SectionTitle";
import { PopupLayer } from "../ui/PopupLayer";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { RANKING_LIST, RANKING_VISIBLE_RANKS, rankingMedal, rankingRowY } from "../ui/expeditionRankingLayout";
import { chipPoints, drawGlassFade, drawLayer, drawVignette, HOLO, HoloBar, slantedRect } from "../ui/holo";
import { RAID_ACTIONS, RAID_BOARD, RAID_BOARD_PLATE, RAID_BOSS_SPOT, RAID_HEADER, RAID_HP_BAR, RAID_HP_BAR_COLOR, raidBoardViewport } from "../ui/raidLayout";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import { relicCollection } from "../managers/RelicCollectionManager";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import type { PartySceneData } from "../data/partyContent";

/**
 * 레이드 — **함께 미는 보스전**의 화면이다.
 *
 * 순위표가 아니라 시즌 판이라 위에서부터 보스 · 남은 체력 · 기여 목록 순으로 쌓인다. 가장
 * 크게 서는 것은 내 등수가 아니라 **얼마나 남았나**이고, 목록은 그 아래에서 흐른다.
 *
 * 화면은 서버 응답(`RaidSeasonResponse`) 하나만 읽고 남은 체력도 기여 순서도 다시 계산하지
 * 않는다 — 두 곳이 따로 세면 보여 준 값과 확정된 값이 갈린다.
 */
export class RaidScene extends Phaser.Scene {
  private readonly popups = new PopupLayer(this, 2000);
  private bossPortrait?: PuppetCreature;
  private hpBar?: HoloBar;
  private content?: Phaser.GameObjects.Container;
  private listMask?: Phaser.GameObjects.Rectangle;
  private sortieButton?: Button;
  private bossMask?: Phaser.GameObjects.Rectangle;

  constructor() {
    super("raid");
  }

  create(): void {
    // 시즌 보스는 하나뿐이라 화면에 들어온 순간 편성과 함께 읽어 둔다.
    prefetchBattlePuppets(relicCollection.validParty, [RAID_SEASON_BOSS.relicId]);
    setDebugScene("raid");
    setDebugRaidStage("season");
    addSceneBackground(this, BACKGROUND.sortieRaid);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });
    this.add.text(RAID_HEADER.titleX, RAID_HEADER.titleY, t("raid.title"), textStyle({ role: "display", size: 54, color: COLOR.sortieText })).setOrigin(0, 0);
    // 씬이 다시 시작될 때 원화와 마스크가 남지 않게 한 곳에서 걷는다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));
    void this.loadBossPortrait();
    /*
     * 원화의 아래쪽이 잠기는 띠. 남은 체력 줄의 배경도 이 한 겹이 함께 맡는다.
     *
     * **짙게 깔지 않는다.** 0.88로 두었을 때는 띠가 끝나는 선이 화면 한가운데를 가로로 긋고,
     * 그 자리에서 마스크까지 원화를 끊어 하체가 통째로 잘려 나간 것처럼 보였다. 목록과의
     * 분리는 아래의 판 한 겹이 맡으므로 이 띠는 잠기는 느낌만 낸다.
     */
    const fade = RAID_BOSS_SPOT.fade;
    this.add.existing(drawGlassFade(this, BASE_WIDTH / 2, (fade.top + fade.bottom) / 2, BASE_WIDTH, fade.bottom - fade.top, { bottomAlpha: 0.52 })).setDepth(8);
    /*
     * **기여 목록은 제 판 위에 선다.** 보스를 끊는 대신 반투명 유리 한 겹을 그 앞에 깔면
     * 원화는 판 너머로 비치면서도 목록과 분리된다 — 잘라서 만드는 분리는 단면을 남기지만
     * 겹쳐서 만드는 분리는 깊이를 남긴다.
     */
    const plate = RAID_BOARD_PLATE;
    this.add.existing(drawLayer(this, BASE_WIDTH / 2, (plate.top + plate.bottom) / 2,
      slantedRect(plate.width, plate.bottom - plate.top), { fill: HOLO.glass, alpha: 0.72, edge: COLOR.accent, edgeAlpha: 0.4 },
    )).setDepth(9);
    void this.refresh();
    playSceneEntrance(this);
  }

  /**
   * 시즌 보스 한 마리가 이 화면의 유일한 주 피사체다.
   *
   * **성장은 다시 계산하지 않는다** — 원화는 정적 정의의 것이고, 실제로 맞는 수치는 서버가
   * 재현할 때 `raidBossDef`가 구한다. 화면이 레벨을 다시 구하면 두 수가 갈린다.
   */
  private async loadBossPortrait(): Promise<void> {
    const asset = portraitAssetFor(RAID_SEASON_BOSS.relicId);
    // 자리는 배치표 하나가 갖는다 — 원정 기록 화면이 폰토스를 세우는 것과 같은 경로다.
    const puppet = await spawnPuppet(this, asset, { x: RAID_BOSS_SPOT.centerX, groundY: RAID_BOSS_SPOT.groundY, height: RAID_BOSS_SPOT.height, depth: 5 });
    if (!this.scene.isActive()) { puppet.destroy(); return; }
    puppet.disableInteractive();
    /*
     * **화면 밑동까지 온전히 선다.**
     *
     * 띠의 아랫변에서 끊던 때는 그 선과 짙은 그라데이션이 겹쳐 **하체가 통째로 잘려 나간
     * 것처럼** 보였다. 목록과의 분리는 그 앞에 깔리는 반투명 판(`RAID_BOARD_PLATE`)이 맡으므로
     * 원화는 자르지 않고, 마스크는 화면 밖으로 나가는 몫만 정리한다.
     *
     * Puppet은 컨테이너 변환을 물려받지 않으므로 마스크도 화면 좌표로 만든다(상점 무대와 같다).
     */
    this.bossMask?.destroy();
    this.bossMask = this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff).setVisible(false);
    puppet.setMask(this.bossMask.createGeometryMask());
    this.bossPortrait?.destroy();
    this.bossPortrait = puppet;
  }


  /** 서버 스냅샷 하나로 머리글·게이지·목록·조작을 한 번에 다시 그린다. */
  private async refresh(): Promise<void> {
    try {
      const season = await gameApi.getRaidSeason(RANKING_VISIBLE_RANKS);
      if (!this.scene.isActive()) return;
      this.render(season);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.renderError(error instanceof GameApiError ? error.message : t("raid.contribution.empty"));
    }
  }

  /** 동적 영역만 갈아 끼운다. 배경·제목·보스 원화는 create가 끝까지 소유한다. */
  private resetContent(): void {
    this.listMask?.destroy();
    this.listMask = undefined;
    this.hpBar?.objects.forEach((object) => object.destroy());
    this.hpBar = undefined;
    this.content?.destroy();
    this.content = this.add.container(0, 0).setDepth(12);
  }

  private render(season: RaidSeasonResponse): void {
    this.resetContent();
    const content = this.content;
    if (!content) return;

    // 초기화 시각과 남은 도전은 제목 아래 두 줄로만 말한다 — 조작을 바꾸는 수만 남긴다.
    content.add(this.add.text(RAID_HEADER.titleX + 4, RAID_HEADER.seasonY, t("raid.season.resetsAt", { date: season.resetsAt.slice(0, 10) }), textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0));
    content.add(new Button(this, BASE_WIDTH - 190, RAID_HEADER.titleY + 24, { width: 228, height: 82, label: t("raid.reward.title"), fontSize: 26, onClick: () => this.openRewardPopup(season) }));
    content.add(this.add.text(RAID_HEADER.titleX + 4, RAID_HEADER.attemptsY, t("raid.attempts", { remaining: Math.max(0, season.attemptsLimit - season.attemptsUsed), limit: season.attemptsLimit }), textStyle({ role: "emphasis", size: 25, color: COLOR.sortieText })).setOrigin(0, 0));

    this.renderHpBar(content, season);
    this.renderBoard(content, season.entries);
    this.renderActions(content, season);
  }

  /**
   * 남은 체력.
   *
   * **게이지가 말하는 것은 깎아 낸 몫이 아니라 남은 몫이다** — 협력전에서 다음에 할 일을
   * 정하는 수는 "얼마나 더 밀어야 하나"이기 때문이다. 다 밀었으면 게이지 대신 토벌 완료가 선다.
   */
  private renderHpBar(content: Phaser.GameObjects.Container, season: RaidSeasonResponse): void {
    const bar = RAID_HP_BAR;
    content.add(this.add.text(bar.centerX - bar.width / 2, bar.labelY, season.defeated ? t("raid.boss.defeated") : t("raid.boss.remaining"), textStyle({ role: "emphasis", size: 25, color: season.defeated ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5));
    content.add(this.add.text(bar.centerX + bar.width / 2, bar.labelY, getRelic(season.bossRelicId).name, textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(1, 0.5));
    // 빈 자리를 짙게 눌러 두고 외곽을 흰 선으로 둘러, 밝은 배경 원화 위에서도 어디까지가 이
    // 게이지인지 보이게 한다 — 읽어야 하는 진행도의 공용 규칙이다.
    this.hpBar = new HoloBar(this, bar.centerX, bar.y, bar.width, bar.height, {
      color: RAID_HP_BAR_COLOR, trackAlpha: 0.82, outline: true, ticks: bar.ticks,
      // 화면에서 가장 크게 서는 게이지라 그림자 한 겹으로 배경 원화에서 띄우고, 남은 몫
      // 둘레로만 같은 색 빛이 옅게 번진다 — 양식은 그대로 두고 깊이만 한 겹 더한다.
      shadow: { offsetY: 7, alpha: 0.6 }, glow: { spread: 7, alpha: 0.26 },
    });
    this.hpBar.setValue(season.totalHp > 0 ? season.remainingHp / season.totalHp : 0);
    this.hpBar.objects.forEach((object) => object.setDepth(12));
    content.add(this.add.text(bar.centerX - bar.width / 2, bar.valueY, `${season.remainingHp.toLocaleString()} / ${season.totalHp.toLocaleString()}`, textStyle({ role: "display", size: 28, color: COLOR.ink })).setOrigin(0, 0.5));
    content.add(this.add.text(bar.centerX + bar.width / 2, bar.valueY, t("raid.contribution.mine") + " " + season.myDamage.toLocaleString(), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(1, 0.5));
  }

  /**
   * 기여 목록.
   *
   * 순위표와 **같은 줄 한 장**(`RANKING_LIST`)을 쓴다 — 같은 모양의 목록이 화면마다 다른 줄
   * 높이로 서면 같은 정보가 두 양식으로 읽힌다. 다만 여기서 세는 것은 점수가 아니라 피해다.
   */
  private renderBoard(content: Phaser.GameObjects.Container, entries: readonly RaidContributionEntryDto[]): void {
    content.add(addSectionTitle(this, RAID_BOARD.centerX - RANKING_LIST.rowWidth / 2, RAID_BOARD.titleY, t("raid.contribution.title")));
    if (entries.length === 0) {
      content.add(this.add.text(RAID_BOARD.centerX, RAID_BOARD.viewport.top + 80, t("raid.contribution.empty"), textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
      return;
    }
    const viewport = raidBoardViewport();
    const list = this.add.container(RAID_BOARD.centerX, RAID_BOARD.viewport.top);
    // GeometryMask는 컨테이너 이동을 물려받지 않으므로 화면 좌표로 만든다.
    this.listMask = this.add.rectangle(RAID_BOARD.centerX, viewport.centerY, RANKING_LIST.rowWidth, viewport.height, 0xffffff).setVisible(false);
    list.setMask(this.listMask.createGeometryMask());
    content.add(list);
    entries.forEach((entry, index) => this.renderRow(list, entry, rankingRowY(index)));

    // 끌기와 휠이 같은 한계를 쓴다. 줄이 창보다 짧으면 minY가 0이라 아무 일도 일어나지 않는다.
    const minY = Math.min(0, viewport.height - (entries.length * (RANKING_LIST.rowHeight + RANKING_LIST.rowGap) - RANKING_LIST.rowGap));
    let offset = 0; let dragY = 0;
    const move = (delta: number): void => { offset = Phaser.Math.Clamp(offset + delta, minY, 0); list.y = RAID_BOARD.viewport.top + offset; };
    const hit = this.add.rectangle(RAID_BOARD.centerX, viewport.centerY, RANKING_LIST.rowWidth, viewport.height, 0xffffff, 0)
      .setInteractive({ draggable: true, useHandCursor: true });
    hit.on("dragstart", (pointer: Phaser.Input.Pointer) => { dragY = pointer.y; });
    hit.on("drag", (pointer: Phaser.Input.Pointer) => { move(pointer.y - dragY); dragY = pointer.y; });
    hit.on("wheel", (_pointer: Phaser.Input.Pointer, _dx: number, dy: number) => move(-dy * 0.65));
    content.add(hit);
    content.sendToBack(hit);
  }

  /** 한 줄. 1·2·3등의 금·은·동과 내 줄의 강조는 순위표와 같은 표를 읽는다. */
  private renderRow(list: Phaser.GameObjects.Container, entry: RaidContributionEntryDto, y: number): void {
    const medal = rankingMedal(entry.rank);
    const row = this.add.container(0, y).setScale(entry.isMe ? 1.04 : 1);
    const accent = medal?.edge ?? (entry.isMe ? COLOR.accent : COLOR.panelEdge);
    row.add(drawLayer(this, 0, 0, chipPoints(RANKING_LIST.rowWidth, RANKING_LIST.rowHeight), {
      fill: medal?.fill ?? (entry.isMe ? 0x263844 : 0x171d25),
      alpha: HOLO.glass,
      edge: accent,
      edgeAlpha: medal ? 0.95 : entry.isMe ? 0.65 : 0.22,
      glow: medal ? { color: medal.edge, strength: 0.26, height: 0.7 } : undefined,
    }));
    const rankColor = medal?.text ?? (entry.isMe ? COLOR.accentText : COLOR.ink);
    row.add(this.add.text(RANKING_LIST.rankX, 0, `${entry.rank}`, textStyle({ role: "display", size: medal ? 44 : 34, color: rankColor })).setOrigin(0.5));
    if (entry.favoriteRelicId) {
      row.add(new FaceFrame(this, RANKING_LIST.faceX, 0, { portraitAssetId: getRelic(entry.favoriteRelicId).portraitAssetId, size: RANKING_LIST.faceSize, color: accent }));
    }
    row.add(this.add.text(RANKING_LIST.nameX, 0, entry.displayName, textStyle({ role: "emphasis", size: 30, color: medal?.text ?? (entry.isMe ? COLOR.accentText : COLOR.ink) })).setOrigin(0, 0.5));
    row.add(this.add.text(RANKING_LIST.scoreX, 0, entry.damage.toLocaleString(), textStyle({ role: "display", size: 32, color: rankColor })).setOrigin(1, 0.5));
    list.add(row);
  }

  /**
   * 하단 조작.
   *
   * **주 조작은 출격 하나이고, 상점은 판 밖 곁들임 줄로 물러난다.** 출격판 밖의 전리품 상점과
   * 같은 자리(`POPUP_SIDE_SLOT`)·같은 라벨 버튼이라 두 화면의 문이 같은 생김새로 선다 —
   * 출격과 나란히 같은 크기로 세우면 상점이 이 화면의 둘째 콘텐츠로 읽힌다.
   *
   * 여기에도 문을 단 것은 **증표를 쓰는 자리가 너무 멀었기 때문이다.** 토벌 증표는 이 화면
   * 에서만 쌓이는데, 쓰려면 레이드를 나가 로비의 출격판을 다시 열어야 했다. 반대 방향은
   * 여전히 막혀 있지 않다 — 출격판 밖의 입구가 그대로 남아 원정 증표를 쓰러 레이드를 거칠
   * 일은 없다.
   */
  private renderActions(content: Phaser.GameObjects.Container, season: RaidSeasonResponse): void {
    const { sortie, y } = RAID_ACTIONS;
    // 도전이 남지 않았거나 이미 누운 보스에는 들어갈 수 없다 — 눌러도 아무 일이 없는 칸은
    // 준비 상태를 과장한다.
    const canSortie = !season.defeated && season.attemptsUsed < season.attemptsLimit;
    this.sortieButton = new Button(this, sortie.centerX, y, { width: sortie.width, height: sortie.height, label: t("raid.sortie"), fontSize: 36, variant: "primary", accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick: () => startScene(this, "party", { content: "raid" } satisfies PartySceneData) });
    this.sortieButton.setEnabled(canSortie);
    content.add(this.sortieButton);
  }


  /**
   * 기여 보상.
   *
   * **누적 피해가 문턱을 넘긴 단계만 수령된다** — 화면이 넘겼다고 말해도 서버가 다시 검사하며,
   * 여기서는 지금 받을 수 있는 것과 다음 문턱까지 얼마가 남았는지만 보여 준다.
   */
  private openRewardPopup(season: RaidSeasonResponse): void {
    const rows = season.rewardStages;
    const next = rows.find((stage) => season.myDamage < stage.threshold);
    // 창 높이는 손으로 적지 않고 전시할 줄 수에서 거꾸로 구한다.
    const height = 240 + rows.length * 108 + (season.defeatRewardClaimable || season.defeatRewardClaimed ? 108 : 0);
    this.popups.open({ width: 820, height, title: t("raid.reward.title"), dim: true }, (body, close) => {
      body.add(this.add.text(0, -height / 2 + 108, next
        ? t("raid.reward.next", { remaining: (next.threshold - season.myDamage).toLocaleString() })
        : t("raid.contribution.mine") + " " + season.myDamage.toLocaleString(),
        textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5));
      const top = -height / 2 + 176;
      rows.forEach((stage, index) => {
        const y = top + index * 108 + 54;
        body.add(this.add.text(-340, y, `${stage.threshold.toLocaleString()}`, textStyle({ role: "emphasis", size: 27, color: COLOR.ink })).setOrigin(0, 0.5));
        body.add(this.add.text(-100, y, `${stage.reward.name} ${stage.reward.amount}`, textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0, 0.5));
        if (stage.claimed) {
          body.add(this.add.text(340, y, t("raid.reward.claimed"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
          return;
        }
        const button = new Button(this, 250, y, { width: 176, height: 72, label: t("raid.reward.claim"), fontSize: 26, onClick: () => { close(); void this.claim(stage.id); } });
        button.setEnabled(season.myDamage >= stage.threshold);
        body.add(button);
      });
      if (season.defeatRewardClaimable || season.defeatRewardClaimed) {
        const y = top + rows.length * 108 + 54;
        body.add(this.add.text(-340, y, t("raid.boss.defeated"), textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0, 0.5));
        if (season.defeatRewardClaimed) body.add(this.add.text(340, y, t("raid.reward.claimed"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(1, 0.5));
        else body.add(new Button(this, 250, y, { width: 176, height: 72, label: t("raid.reward.claim"), fontSize: 26, onClick: () => { close(); void this.claim("defeat"); } }));
      }
    });
  }

  /** 지급은 서버가 한 처리로 확정하고, 화면은 새 시즌 응답으로 그대로 다시 그린다. */
  private async claim(stageId: string): Promise<void> {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `raid-claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await gameApi.claimRaidReward({ requestId, stageId });
      if (!this.scene.isActive()) return;
      this.render(result.season);
    } catch {
      if (!this.scene.isActive()) return;
      void this.refresh();
    }
  }

  private renderError(message: string): void {
    this.resetContent();
    this.content?.add(this.add.text(BASE_WIDTH / 2, RAID_BOARD.viewport.top + 120, message, textStyle({ role: "body", size: 27, color: COLOR.ink, align: "center", wrap: 700 })).setOrigin(0.5));
  }

  /** 마스크와 원화는 표시 목록 밖에서 살아 있으므로 씬이 내려갈 때 함께 걷는다. */
  private dispose(): void {
    this.listMask?.destroy();
    this.listMask = undefined;
    this.bossMask?.destroy();
    this.bossMask = undefined;
    this.bossPortrait?.destroy();
    this.bossPortrait = undefined;
  }
}
