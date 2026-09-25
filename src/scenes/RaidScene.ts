import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import type { RaidContributionEntryDto, RaidDto, RaidListResponse } from "../api/contracts";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { RAID_BOSS_POOL, RAID_DIFFICULTY, RAID_SUMMON_DIFFICULTIES, type RaidDifficulty } from "../data/raid";
import { getRelic } from "../data/relics";
import { setDebugRaidStage, setDebugScene } from "../debug";
import { t } from "../i18n";
import { portraitAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "../ui/Button";
import { FaceFrame } from "../ui/FaceFrame";
import { addBackButton } from "../ui/IconButton";
import { addSectionTitle } from "../ui/SectionTitle";
import { PopupLayer } from "../ui/PopupLayer";
import { addEnemyPortraitTap, EnemyInfoPopup } from "../ui/EnemyInfoPopup";
import { raidBossDef, raidBossGrowth, raidKillTicks } from "../core/raid";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { RANKING_LIST, RANKING_VISIBLE_RANKS, rankingMedal, rankingRowY } from "../ui/expeditionRankingLayout";
import { chipPoints, drawGlassFade, drawHairline, drawLayer, drawShapeEdge, drawVignette, HOLO, HoloBar, slantedRect } from "../ui/holo";
import {
  RAID_ACTIONS, RAID_BOARD, RAID_BOARD_PLATE, RAID_BOSS_SPOT, RAID_HEADER, RAID_HP_BAR, RAID_HP_BAR_COLOR, RAID_LIST, RAID_LIST_CHROME,
  RAID_BOSS_PICK, RAID_DIFFICULTY_PICK, raidBoardViewport, raidBossPickHeight, raidLayerStack, raidPickHeight,
} from "../ui/raidLayout";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import { relicCollection } from "../managers/RelicCollectionManager";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import type { PartySceneData } from "../data/partyContent";
import { addRaidBossPickLayer, addRaidDifficultyPickLayer, addRaidLayer, raidTagLabel } from "../ui/RaidLayer";
import { playRaidSummonCinematic } from "../ui/RaidSummonCinematic";
import { addCategoryTab } from "../ui/CategoryTab";
import { addFramedIcon } from "../ui/itemFrame";
import { CURRENCY_ICON_BY_WALLET } from "../ui/currencyIcons";
import { currencyRecordToRewardItems, openRewardPopup } from "../ui/RewardPopup";
import { consumeSceneEntry } from "./sceneEntry";

/**
 * 지난번에 받은 레이드 목록. 씬이 다시 설 때 이것으로 먼저 그려 빈 목록이 한 박자 서지 않게 한다.
 * 화면이 들고 있을 뿐 판정에는 쓰지 않는다 — 조작은 전부 서버 응답을 다시 받는다.
 */
let lastRaidList: RaidListResponse | undefined;

/** 목록의 두 탭. 진행 중인 판을 치고, 끝난 판을 정산한다. */
export type RaidListTab = "active" | "completed";

/**
 * 레이드 씬이 여는 자리. 판 ID가 있으면 그 판(보스 전신·남은 체력·기여)이고, 없으면 목록이다.
 * 목록은 마지막으로 보던 탭으로 연다 — 정산하러 완료 탭에 갔다가 판을 보고 돌아오면 그 탭이다.
 */
export interface RaidSceneData { raidId?: string; tab?: RaidListTab }

/**
 * 레이드 — **함께 미는 보스전**의 화면이다.
 *
 * 들어가면 **층이 쌓이는 목록**이 먼저 뜬다. 맨 위가 시스템이 하루 한 마리 여는 월드 폭주,
 * 그 아래가 친구와 내가 토벌권으로 연 판이다. 아래 탭이 진행 중인 판과 끝난 판을 가르고, 끝난 판은
 * 거기서 **정산**해야 보상이 들어온다 — 참여한 판만, 내가 민 몫과 판 전체가 깎인 몫에 비례한다.
 *
 * 층을 누르면 그 판이 선다. 순위표가 아니라 판 하나라 위에서부터 보스 · 남은 체력 · 기여 목록
 * 순으로 쌓인다. 가장 크게 서는 것은 내 등수가 아니라 **얼마나 남았나**다.
 *
 * 화면은 서버 응답(`RaidDto`) 하나만 읽고 남은 체력도 기여 순서도 정산도 다시 계산하지 않는다 —
 * 두 곳이 따로 세면 보여 준 값과 확정된 값이 갈린다.
 */
export class RaidScene extends Phaser.Scene {
  private readonly popups = new PopupLayer(this, 2000);
  private bossPortrait?: PuppetCreature;
  private hpBar?: HoloBar;
  private content?: Phaser.GameObjects.Container;
  private listMask?: Phaser.GameObjects.Rectangle;
  private sortieButton?: Button;
  private bossMask?: Phaser.GameObjects.Rectangle;
  /** 원화를 누르면 여는 적 정보창. 보상 창과 같은 층 위에 얹힌다. */
  private bossInfo?: EnemyInfoPopup;
  /** 목록의 층이 흐르는 컨테이너와 그 마스크. 스크롤은 컨테이너의 y 하나로 움직인다. */
  private layers?: Phaser.GameObjects.Container;
  private layerMask?: Phaser.GameObjects.Graphics;
  private scrollY = 0;
  private minScroll = 0;
  /** 이번 손이 목록을 끌었는가. 끌다 놓은 자리의 층이 열리지 않게 한다. */
  private dragged = false;
  /** 정산·소환이 도는 동안 같은 손이 두 번 들어가지 않게 한다. */
  private busy = false;

  constructor() {
    super("raid");
  }

  private raidId?: string;
  private tab: RaidListTab = "active";
  private tabRow?: Phaser.GameObjects.Container;

  init(data?: RaidSceneData): void {
    this.raidId = typeof data?.raidId === "string" ? data.raidId : undefined;
    this.tab = data?.tab === "completed" ? "completed" : "active";
    this.scrollY = 0;
    this.busy = false;
    consumeSceneEntry(this);
  }

  create(): void {
    setDebugScene("raid");
    setDebugRaidStage(this.raidId ? "season" : "list");
    addSceneBackground(this, BACKGROUND.sortieRaid);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });
    // 씬이 다시 시작될 때 원화와 마스크가 남지 않게 한 곳에서 걷는다.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    if (!this.raidId) {
      this.add.text(RAID_HEADER.titleX, RAID_HEADER.titleY, t("raid.title"), textStyle({ role: "display", size: 54, color: COLOR.sortieText })).setOrigin(0, 0);
      this.buildListChrome();
      addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.sortie));
      void this.refreshList();
      playSceneEntrance(this);
      return;
    }
    // 판에서 나가는 길은 로비가 아니라 **레이드 목록**이다 — 편성에서 판으로 돌아오는 것과 같은
    // 규칙이다(한 단계 앞으로).
    addBackButton(this, () => startScene(this, "raid", { tab: this.tab } satisfies RaidSceneData));
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
     * 겹쳐서 만드는 분리는 깊이를 남긴다. 판은 정보창의 칸(`addInfoPanel`)과 같은 남색 유리다.
     */
    const plate = RAID_BOARD_PLATE;
    const plateShape = slantedRect(plate.width, plate.bottom - plate.top);
    this.add.existing(drawLayer(this, BASE_WIDTH / 2, (plate.top + plate.bottom) / 2,
      plateShape, { fill: 0x0b0f15, alpha: 0.6, edge: COLOR.accent, edgeAlpha: 0.4 },
    )).setDepth(9);
    this.add.existing(drawShapeEdge(this, BASE_WIDTH / 2, (plate.top + plate.bottom) / 2, plateShape, "bottom", { color: COLOR.accent, alpha: 0.22, inset: 10 })).setDepth(9);
    void this.refresh();
    playSceneEntrance(this);
  }

  /**
   * 판의 보스가 이 화면의 유일한 주 피사체다.
   *
   * **성장은 다시 계산하지 않는다** — 원화는 정적 정의의 것이고, 실제로 맞는 수치는 서버가
   * 재현할 때 `raidBossDef`가 구한다. 화면이 레벨을 다시 구하면 두 수가 갈린다.
   */
  private async loadBossPortrait(raid: RaidDto): Promise<void> {
    const asset = portraitAssetFor(getRelic(raid.bossRelicId).portraitAssetId);
    // 자리는 배치표 하나가 갖는다 — 원정 기록 화면이 폰토스를 세우는 것과 같은 경로다.
    const puppet = await spawnPuppet(this, asset, { x: RAID_BOSS_SPOT.centerX, groundY: RAID_BOSS_SPOT.groundY, height: RAID_BOSS_SPOT.height, depth: 5 });
    if (!this.scene.isActive()) { puppet.destroy(); return; }
    puppet.disableInteractive();
    /*
     * **화면 밑동까지 온전히 선다.** 목록과의 분리는 그 앞에 깔리는 반투명 판(`RAID_BOARD_PLATE`)이
     * 맡으므로 원화는 자르지 않고, 마스크는 화면 밖으로 나가는 몫만 정리한다.
     *
     * Puppet은 컨테이너 변환을 물려받지 않으므로 마스크도 화면 좌표로 만든다(상점 무대와 같다).
     */
    this.bossMask?.destroy();
    this.bossMask = this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0xffffff).setVisible(false);
    puppet.setMask(this.bossMask.createGeometryMask());
    this.bossPortrait?.destroy();
    this.bossPortrait = puppet;
  }

  /**
   * 목록 화면의 뼈대 — 층이 흐르는 창, 밑동의 어둠, 그 위의 탭.
   *
   * 밑동은 단단한 판이 아니라 아래로 갈수록 짙어지는 그라데이션이다(교류 목록과 같다) — 판을 깔면
   * 화면 아래가 통째로 상자가 되어 배경 원화가 잘려 보인다.
   */
  private buildListChrome(): void {
    const { top, bottom } = RAID_LIST.viewport;
    this.layers = this.add.container(BASE_WIDTH / 2, 0).setDepth(10);
    this.layerMask = this.make.graphics({});
    this.layerMask.fillStyle(0xffffff, 1).fillRect(0, top, BASE_WIDTH, bottom - top);
    this.layers.setMask(this.layerMask.createGeometryMask());
    const fadeHeight = BASE_HEIGHT - bottom;
    drawGlassFade(this, BASE_WIDTH / 2, BASE_HEIGHT - fadeHeight / 2, BASE_WIDTH, fadeHeight, { topAlpha: 0, bottomAlpha: 0.9 }).setDepth(38);
    drawHairline(this, BASE_WIDTH / 2, bottom, BASE_WIDTH, { color: COLOR.accent, alpha: 0.18 }).setDepth(38);

    this.tabRow = this.add.container(0, 0).setDepth(40);
    this.renderTabs();

    const inViewport = (pointer: Phaser.Input.Pointer): boolean => pointer.worldY >= top && pointer.worldY <= bottom;
    let dragging = false; let origin = 0; let startY = 0;
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      this.dragged = false;
      if (!inViewport(pointer) || this.minScroll >= 0) return;
      dragging = true; origin = this.scrollY - pointer.y; startY = pointer.y;
    };
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      if (!dragging || !pointer.isDown) return;
      if (Math.abs(pointer.y - startY) > 12) this.dragged = true;
      this.scrollTo(origin + pointer.y);
    };
    const onUp = (): void => { dragging = false; };
    const onWheel = (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => { if (inViewport(pointer)) this.scrollTo(this.scrollY - dy); };
    this.input.on("pointerdown", onDown); this.input.on("pointermove", onMove);
    this.input.on("pointerup", onUp); this.input.on("pointerupoutside", onUp); this.input.on("wheel", onWheel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", onDown); this.input.off("pointermove", onMove);
      this.input.off("pointerup", onUp); this.input.off("pointerupoutside", onUp); this.input.off("wheel", onWheel);
    });
  }

  private scrollTo(value: number): void {
    this.scrollY = Phaser.Math.Clamp(value, this.minScroll, 0);
    this.layers?.setY(this.scrollY);
  }

  /**
   * 레이드 목록 — 층이 쌓이는 판이다.
   *
   * 진행 중 탭에는 칠 수 있는 판 전부가, 완료 탭에는 **참여한** 끝난 판이 선다(서버가 거른다). 층을
   * 누르면 그 레이드의 판으로 들어가고, 끝난 판의 정산은 층의 버튼이 곧바로 받는다.
   */
  /**
   * 두 탭. **탭을 바꿔도 화면을 다시 시작하지 않는다** — 씬을 새로 세우면 목록이 서버 응답을
   * 기다리는 동안 비었다가 다시 차, 탭 하나에 화면 전체가 새로고침된 것처럼 깜빡였다. 이미 받은
   * 목록을 그 탭으로 다시 거르기만 한다.
   */
  private renderTabs(): void {
    const row = this.tabRow;
    if (!row) return;
    row.removeAll(true);
    const tabs = RAID_LIST_CHROME.tabs;
    (["active", "completed"] as const).forEach((tab, index) => {
      addCategoryTab(this, row, {
        x: tabs.left + tabs.width / 2 + index * (tabs.width + tabs.gap), y: tabs.y,
        width: tabs.width, height: tabs.height,
        label: t(`raid.tab.${tab}`), selected: this.tab === tab,
        onSelect: () => {
          if (this.tab === tab) return;
          this.tab = tab;
          this.scrollY = 0;
          this.renderTabs();
          if (lastRaidList) this.renderList(lastRaidList);
        },
      });
    });
  }

  private async refreshList(): Promise<void> {
    // 지난번에 받은 목록이 있으면 **먼저 그것으로 세운다** — 판에서 목록으로 돌아올 때마다 빈
    // 목록이 한 박자 섰다가 차오르면 화면이 새로 열리는 것처럼 읽힌다. 새 응답이 오면 다시 그린다
    // (얼굴 띠는 구운 텍스처를 그대로 쓰므로 다시 그려도 깜빡이지 않는다).
    if (lastRaidList) this.renderList(lastRaidList);
    let response: RaidListResponse;
    try {
      response = await gameApi.getRaids(1);
    } catch (error) {
      if (!this.scene.isActive()) return;
      if (!lastRaidList) this.renderError();
      return;
    }
    if (!this.scene.isActive()) return;
    lastRaidList = response;
    this.renderList(response);
  }

  private renderList(response: RaidListResponse): void {
    this.resetContent();
    // 목록에서는 머리의 토벌권과 밑동의 소환 줄이 이 층에 선다 — 밑동의 어둠·탭보다 위다.
    this.content?.setDepth(41);
    this.renderTickets(response.tickets);
    this.renderSummonRow(response.tickets);
    const raids = response.raids.filter((raid) => raid.status === this.tab);
    // 진행 중인 판의 보스는 곧 칠 수 있으므로 편성과 함께 미리 읽어 둔다.
    if (this.tab === "active") prefetchBattlePuppets(relicCollection.validParty, [...new Set(raids.map(({ bossRelicId }) => bossRelicId))]);
    const layers = this.layers;
    if (!layers) return;
    layers.removeAll(true);
    const stack = raidLayerStack(raids.map(({ kind }) => kind));
    raids.forEach((raid, index) => addRaidLayer(this, layers, raid, stack.centers[index]!, {
      onTap: () => { if (!this.dragged) this.openRaid(raid.id); },
      onSettle: () => { if (!this.dragged) void this.settle(raid.id); },
    }));
    const viewportHeight = RAID_LIST.viewport.bottom - RAID_LIST.viewport.top;
    this.minScroll = Math.min(0, viewportHeight - stack.height);
    this.scrollTo(this.scrollY);
  }

  private openRaid(raidId: string): void {
    startScene(this, "raid", { raidId, tab: this.tab } satisfies RaidSceneData);
  }

  /**
   * 머리 오른쪽의 두 토벌권. 그림이 이미 무엇인지 말하므로 이름을 적지 않고 수량만 겹친다.
   */
  private renderTickets(tickets: RaidListResponse["tickets"]): void {
    const content = this.content;
    if (!content) return;
    const { y, size, gap, right } = RAID_LIST_CHROME.tickets;
    const entries = [["item-raid-select-ticket", tickets.select], ["item-raid-ticket", tickets.normal]] as const;
    entries.forEach(([key, count], index) => {
      addFramedIcon(this, content, right - size / 2 - index * (size + gap), y, size, key, { amount: count.toLocaleString(), plain: true });
    });
  }

  /**
   * 밑동의 소환 줄 — **선택 소환(왼쪽)과 소환(오른쪽)이 같은 양식으로 나란히 선다.** 그 토벌권이
   * 없으면 그 버튼만 꺼진 채 선다(자리를 비우면 버튼 수에 따라 줄이 흔들린다).
   *
   * 소환은 **누르면 곧바로** 토벌권을 쓴다 — 보스도 난이도도 서버가 굴린다. 고르고 싶은 손은
   * 선택 소환이 맡는다.
   */
  private renderSummonRow(tickets: RaidListResponse["tickets"]): void {
    const content = this.content;
    if (!content) return;
    const { y, height, fontSize, select, normal } = RAID_LIST_CHROME.summon;
    const button = (slot: { centerX: number; width: number }, label: string, enabled: boolean, onClick: () => void): void => {
      const entry = new Button(this, slot.centerX, y, {
        width: slot.width, height, label, fontSize, variant: "primary",
        accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText, onClick,
      });
      entry.setEnabled(enabled);
      content.add(entry);
    };
    button(select, t("raid.summon.select"), tickets.select > 0, () => this.openBossPickPopup());
    button(normal, t("raid.summon.button"), tickets.normal > 0, () => void this.summon(undefined));
  }

  /**
   * 선택 소환의 첫 창 — 보스가 **층**으로 늘어선다(목록의 층과 같은 문법). 하나를 누르면 이 창을
   * 닫지 않고 그 위에 난이도 창이 겹쳐 뜬다 — 난이도를 보다 보스를 바꾸고 싶은 손이 한 번에
   * 돌아온다.
   */
  private openBossPickPopup(): void {
    if (this.busy) return;
    const bosses = [...RAID_BOSS_POOL];
    const height = raidBossPickHeight(bosses.length);
    this.popups.open({ width: RAID_BOSS_PICK.width + 80, height, title: t("raid.summon.select"), dim: true, closeOnBackdrop: true }, (body, close) => {
      let y = -height / 2 + RAID_BOSS_PICK.top + RAID_BOSS_PICK.height / 2;
      bosses.forEach((relicId) => {
        addRaidBossPickLayer(this, body, relicId, y, () => this.openDifficultyPopup(relicId, close));
        y += RAID_BOSS_PICK.height + RAID_BOSS_PICK.gap;
      });
    });
  }

  /**
   * 선택 소환의 둘째 창 — 고른 보스의 얼굴 위에 **난이도마다 제 색**을 입힌 층이 선다. 고르면
   * 두 창을 함께 닫고 곧바로 연다.
   */
  private openDifficultyPopup(bossRelicId: string, closeBossPick: () => void): void {
    const height = raidPickHeight(RAID_DIFFICULTY_PICK, RAID_SUMMON_DIFFICULTIES.length);
    this.popups.open({ width: RAID_DIFFICULTY_PICK.width + 80, height, title: getRelic(bossRelicId).name, dim: true, dimAlpha: 0.35, closeOnBackdrop: true }, (body, close) => {
      let y = -height / 2 + RAID_DIFFICULTY_PICK.top + RAID_DIFFICULTY_PICK.height / 2;
      RAID_SUMMON_DIFFICULTIES.forEach((difficulty: RaidDifficulty) => {
        addRaidDifficultyPickLayer(this, body, bossRelicId, difficulty, y, () => {
          close();
          closeBossPick();
          void this.summon({ bossRelicId, difficulty });
        });
        y += RAID_DIFFICULTY_PICK.height + RAID_DIFFICULTY_PICK.gap;
      });
    });
  }

  /**
   * 토벌권 차감과 판 생성은 서버가 한 처리로 확정하고, 그 결과로 **소환 연출**을 튼다 — 보스는
   * 서버가 정하므로(토벌권은 무작위) 연출은 응답을 받은 뒤에야 누가 나올지 안다. 연출을 닫으면
   * 연 판으로 들어간다.
   */
  private async summon(select: { bossRelicId: string; difficulty: RaidDifficulty } | undefined): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const requestId = globalThis.crypto?.randomUUID?.() ?? `raid-summon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await gameApi.summonRaid({ requestId, ...select });
      if (!this.scene.isActive()) return;
      setDebugRaidStage("summon");
      playRaidSummonCinematic(this, {
        bossRelicId: result.raid.bossRelicId, difficulty: result.raid.difficulty, level: result.raid.bossLevel, depth: 3000,
        onReveal: () => setDebugRaidStage("summonReveal"),
        onDone: () => startScene(this, "raid", { raidId: result.raid.id, tab: "active" } satisfies RaidSceneData),
      });
    } catch {
      if (!this.scene.isActive()) return;
      this.busy = false;
      void this.refreshList();
    }
  }

  /**
   * 끝난 판의 정산 — 서버가 몫을 다시 계산해 한 처리로 지급한다. 받은 것은 영수증 한 장이 말하고,
   * 목록(또는 판)은 새 응답으로 다시 그린다.
   */
  private async settle(raidId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const requestId = globalThis.crypto?.randomUUID?.() ?? `raid-settle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const result = await gameApi.settleRaid({ requestId, raidId });
      if (!this.scene.isActive()) return;
      this.busy = false;
      const redraw = (): void => { if (this.raidId) this.render(result.raid); else void this.refreshList(); };
      redraw();
      openRewardPopup(this, this.popups, {
        title: t("raid.settle.title"),
        items: currencyRecordToRewardItems(Object.fromEntries(result.granted.map(({ currency, amount }) => [currency, amount]))),
      });
    } catch {
      if (!this.scene.isActive()) return;
      this.busy = false;
      if (this.raidId) void this.refresh(); else void this.refreshList();
    }
  }

  /** 서버 스냅샷 하나로 머리글·게이지·목록·조작을 한 번에 다시 그린다. 판이 없으면 목록으로 간다. */
  private async refresh(): Promise<void> {
    try {
      const raid = (await gameApi.getRaids(RANKING_VISIBLE_RANKS)).raids.find(({ id }) => id === this.raidId);
      if (!this.scene.isActive()) return;
      // 걷힌 판(정산을 마치고 오래 지난 판)으로 돌아온 진입은 목록으로 되돌린다.
      if (!raid) { startScene(this, "raid", { tab: this.tab } satisfies RaidSceneData); return; }
      if (!this.bossPortrait) this.setupBoss(raid);
      this.render(raid);
    } catch (error) {
      if (!this.scene.isActive()) return;
      this.renderError();
    }
  }

  /**
   * 판의 보스 원화와 그 입구. 원화를 누르면 적 정보창이 열린다 — 출격 전에 스킬과 능력치를
   * 들여다볼 수 있어야 무엇을 데려갈지 편성 화면 한 곳에 판단이 몰리지 않는다.
   */
  private setupBoss(raid: RaidDto): void {
    prefetchBattlePuppets(relicCollection.validParty, [raid.bossRelicId]);
    void this.loadBossPortrait(raid);
    this.bossInfo = new EnemyInfoPopup(this, new PopupLayer(this, 2200));
    addEnemyPortraitTap(this, RAID_BOSS_SPOT.tap, () => this.bossPortrait, () => this.bossInfo?.show({
      def: raidBossDef(getRelic(raid.bossRelicId), raid.difficulty), ...raidBossGrowth(raid.difficulty),
    }));
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

  private render(raid: RaidDto): void {
    this.resetContent();
    const content = this.content;
    if (!content) return;
    content.add(this.add.text(RAID_HEADER.titleX, RAID_HEADER.titleY, raidTagLabel(raid), textStyle({ role: "display", size: 54, color: COLOR.sortieText })).setOrigin(0, 0));
    // 끝나는 시각과 남은 도전은 제목 아래 두 줄로만 말한다 — 조작을 바꾸는 수만 남긴다.
    const ends = new Date(raid.endsAt);
    const endsLabel = `${String(ends.getMonth() + 1).padStart(2, "0")}-${String(ends.getDate()).padStart(2, "0")} ${String(ends.getHours()).padStart(2, "0")}:${String(ends.getMinutes()).padStart(2, "0")}`;
    content.add(this.add.text(RAID_HEADER.titleX + 4, RAID_HEADER.seasonY, raid.status === "completed" ? t(raid.defeated ? "raid.boss.defeated" : "raid.layer.ended") : t("raid.endsAt", { time: endsLabel }), textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0));
    content.add(new Button(this, BASE_WIDTH - 190, RAID_HEADER.titleY + 24, { width: 228, height: 82, label: t("raid.reward.title"), fontSize: 26, onClick: () => this.openRewardPopup(raid) }));
    if (raid.status === "active") {
      content.add(this.add.text(RAID_HEADER.titleX + 4, RAID_HEADER.attemptsY, t("raid.attempts", { remaining: Math.max(0, raid.attemptsLimit - raid.attemptsUsed), limit: raid.attemptsLimit }), textStyle({ role: "emphasis", size: 25, color: COLOR.sortieText })).setOrigin(0, 0));
    }

    this.renderHpBar(content, raid);
    this.renderBoard(content, raid.entries);
    this.renderActions(content, raid);
  }

  /**
   * 남은 체력.
   *
   * **게이지가 말하는 것은 깎아 낸 몫이 아니라 남은 몫이다** — 협력전에서 다음에 할 일을
   * 정하는 수는 "얼마나 더 밀어야 하나"이기 때문이다. 다 밀었으면 게이지 대신 토벌 완료가 선다.
   */
  private renderHpBar(content: Phaser.GameObjects.Container, raid: RaidDto): void {
    const bar = RAID_HP_BAR;
    const hpLabel = this.add.text(bar.centerX - bar.width / 2, bar.labelY, raid.defeated ? t("raid.boss.defeated") : t("raid.boss.remaining"), textStyle({ role: "emphasis", size: 25, color: raid.defeated ? COLOR.accentText : COLOR.inkDim })).setOrigin(0, 0.5);
    content.add(hpLabel);
    // 게이지 한 칸이 보스 한 번 처치다 — 남은 체력 숫자만으로는 몇 번 더 잡으면 끝나는지 읽히지 않는다.
    content.add(this.add.text(hpLabel.x + hpLabel.width + 18, bar.labelY, t("raid.boss.kills", { done: raid.killsDone, kills: raid.kills }), textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(0, 0.5));
    content.add(this.add.text(bar.centerX + bar.width / 2, bar.labelY, t("raid.detail.name", { name: getRelic(raid.bossRelicId).name, level: raid.bossLevel }), textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(1, 0.5));
    // 빈 자리를 짙게 눌러 두고 외곽을 흰 선으로 둘러, 밝은 배경 원화 위에서도 어디까지가 이
    // 게이지인지 보이게 한다 — 읽어야 하는 진행도의 공용 규칙이다.
    this.hpBar = new HoloBar(this, bar.centerX, bar.y, bar.width, bar.height, {
      color: RAID_HP_BAR_COLOR, trackAlpha: 0.82, outline: true, ticks: raidKillTicks(raid.kills, bar.ticks),
      // 화면에서 가장 크게 서는 게이지라 그림자 한 겹으로 배경 원화에서 띄우고, 남은 몫
      // 둘레로만 같은 색 빛이 옅게 번진다 — 양식은 그대로 두고 깊이만 한 겹 더한다.
      shadow: { offsetY: 7, alpha: 0.6 }, glow: { spread: 7, alpha: 0.26 },
    });
    this.hpBar.setValue(raid.totalHp > 0 ? raid.remainingHp / raid.totalHp : 0);
    this.hpBar.objects.forEach((object) => object.setDepth(12));
    content.add(this.add.text(bar.centerX - bar.width / 2, bar.valueY, `${raid.remainingHp.toLocaleString()} / ${raid.totalHp.toLocaleString()}`, textStyle({ role: "display", size: 28, color: COLOR.ink })).setOrigin(0, 0.5));
    content.add(this.add.text(bar.centerX + bar.width / 2, bar.valueY, t("raid.contribution.mine") + " " + raid.myDamage.toLocaleString(), textStyle({ role: "emphasis", size: 26, color: COLOR.accentText })).setOrigin(1, 0.5));
  }

  /**
   * 기여 목록.
   *
   * 순위표와 **같은 줄 한 장**(`RANKING_LIST`)을 쓴다 — 같은 모양의 목록이 화면마다 다른 줄
   * 높이로 서면 같은 정보가 두 양식으로 읽힌다. 다만 여기서 세는 것은 점수가 아니라 피해다.
   */
  private renderBoard(content: Phaser.GameObjects.Container, entries: readonly RaidContributionEntryDto[]): void {
    content.add(addSectionTitle(this, RAID_BOARD.titleX, RAID_BOARD.titleY, t("raid.contribution.title")));
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
   * 하단 조작 — 한 자리에 하나다. 진행 중인 판은 출격, 끝난 판은 **정산**이 같은 자리에 선다.
   * 전리품 상점은 로비 출격판 밑변에 걸친 라벨이 맡는다.
   */
  private renderActions(content: Phaser.GameObjects.Container, raid: RaidDto): void {
    const { sortie, y } = RAID_ACTIONS;
    const common = { width: sortie.width, height: sortie.height, fontSize: 36, variant: "primary" as const, accentColor: COLOR.sortie, accentTextColor: COLOR.sortieText };
    if (raid.status === "completed") {
      // 참여하지 않았거나 이미 받은 판은 받을 것이 없다 — 눌러도 아무 일이 없는 칸은 세우지 않는다.
      if (raid.settlement.length === 0 || raid.settled) return;
      content.add(new Button(this, sortie.centerX, y, { ...common, label: t("raid.settle.button"), onClick: () => void this.settle(raid.id) }));
      return;
    }
    // 도전이 남지 않았으면 들어갈 수 없다 — 눌러도 아무 일이 없는 칸은 준비 상태를 과장한다.
    const canSortie = raid.attemptsUsed < raid.attemptsLimit;
    this.sortieButton = new Button(this, sortie.centerX, y, {
      ...common, label: t("raid.sortie"),
      onClick: () => startScene(this, "party", { content: "raid", raidId: raid.id, bossRelicId: raid.bossRelicId, difficulty: raid.difficulty } satisfies PartySceneData),
    });
    this.sortieButton.setEnabled(canSortie);
    content.add(this.sortieButton);
  }

  /**
   * 보상 창 — 판이 끝나면 받는 **정산**의 내역이다.
   *
   * 몫은 셋이다: 내가 민 몫(두 판의 합이 목표에 닿을수록), 판 전체가 깎인 몫, 토벌 몫. 여기서는
   * 계산하지 않고 서버가 실은 합계와 그 재료(내 기여·전체 진행·토벌 여부)만 나란히 세운다. 한 판을
   * 칠 때마다 곧바로 받는 골드는 결과판이 말한다.
   */
  private openRewardPopup(raid: RaidDto): void {
    const width = 780;
    const rows = [
      [t("raid.contribution.mine"), raid.myDamage.toLocaleString()],
      [t("raid.reward.progress"), t("raid.world.percent", { percent: raid.totalHp > 0 ? Math.floor(raid.dealtDamage / raid.totalHp * 100) : 0 })],
      [t("raid.reward.kill"), t(raid.defeated ? "raid.reward.killYes" : raid.status === "completed" ? "raid.reward.killFailed" : "raid.reward.killNo")],
    ] as const;
    const rowHeight = 64;
    const frame = 132;
    const height = 200 + frame + 40 + rows.length * rowHeight + 110;
    this.popups.open({ width, height, title: t("raid.reward.title"), dim: true, closeOnBackdrop: true }, (body) => {
      let y = -height / 2 + 110;
      const participated = raid.settlement.length > 0;
      const max = RAID_DIFFICULTY[raid.difficulty].settlement;
      const amount = participated ? raid.settlement.reduce((sum, entry) => sum + entry.amount, 0) : max.mine + max.total + max.kill;
      const label = raid.settled ? t("raid.settle.done") : !participated ? t("raid.settle.max")
        : raid.status === "completed" ? t("raid.settle.ready") : t("raid.settle.expected");
      body.add(this.add.text(0, y, label, textStyle({ role: "emphasis", size: 27, color: COLOR.accentText })).setOrigin(0.5));
      y += 30 + frame / 2;
      addFramedIcon(this, body, 0, y, frame, CURRENCY_ICON_BY_WALLET[raid.settlement[0]?.currency ?? "raidSigil"], { amount: amount.toLocaleString() });
      y += frame / 2 + 60;
      rows.forEach(([name, value]) => {
        body.add(this.add.text(-width / 2 + 90, y, name, textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5));
        body.add(this.add.text(width / 2 - 90, y, value, textStyle({ role: "display", size: 28, color: COLOR.ink })).setOrigin(1, 0.5));
        y += rowHeight;
      });
      body.add(this.add.text(0, y + 24, t("raid.reward.note"), textStyle({ role: "body", size: 22, color: COLOR.inkDim, align: "center", wrap: width - 120 })).setOrigin(0.5));
    });
  }

  /** 불러오지 못했으면 그 자리를 비운다 — 실패를 문장으로 세워도 지금 할 일이 바뀌지 않는다. */
  private renderError(): void {
    this.resetContent();
  }


  /** 마스크와 원화는 표시 목록 밖에서 살아 있으므로 씬이 내려갈 때 함께 걷는다. */
  private dispose(): void {
    this.layerMask?.destroy();
    this.layerMask = undefined;
    this.layers = undefined;
    this.listMask?.destroy();
    this.listMask = undefined;
    this.bossMask?.destroy();
    this.bossMask = undefined;
    this.bossPortrait?.destroy();
    this.bossPortrait = undefined;
  }
}
