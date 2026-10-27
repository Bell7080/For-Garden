import { CONTENT_STAMINA_COSTS } from "../data/contentCosts";
import Phaser from "phaser";
import { TAP_DRAG_SLOP } from "../core/tapGuard";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import {
  ANCIENT_FLOORS_PER_BLOCK, ancientBlockBackdrop, ancientBlockFloors, ancientBlockOf, ancientChallengeFloor, ancientHighestCleared,
  ancientLastBrowsableBlock, groupAncientPeers, isAncientGate,
} from "../core/ancientStrata";
import { getAncientStrataFloor } from "../core/ancientStrataBattle";
import { ancientStageId, ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { motionPolicy } from "../core/settings";
import { isStageUnlocked, session } from "../state/session";
import { Button } from "../ui/Button";
import { addBackButton } from "../ui/IconButton";
import { NodeEnemyPreview } from "../ui/NodeEnemyPreview";
import { EnemyInfoPopup } from "../ui/EnemyInfoPopup";
import { PopupLayer } from "../ui/PopupLayer";
import { ancientBackground, useBackgroundTexture } from "../ui/backgrounds";
import {
  ANCIENT_CHROME, ANCIENT_MAP, ANCIENT_PEERS, ancientNodePoint, ancientNodeSize, ancientPeerDirection, ancientPeerFaceX, ancientScrollLimits,
} from "../ui/ancientStrataLayout";
import { gameApi } from "../api/FakeServer";
import { socialApi } from "../api/FakeSocialServer";
import { guildApi } from "../api/guildApi";
import { RELICS } from "../data/relics";
import { addCategoryTab } from "../ui/CategoryTab";
import { DuelRankingPopup } from "../ui/DuelRankingPopup";
import { FaceFrame } from "../ui/FaceFrame";
import { drawGlyph } from "../ui/glyphs";
import { RailButton } from "../ui/RailButton";
import { encounterRoleIcon } from "../ui/encounterRolePresentation";
import { chipPoints, drawLayer, drawVignette } from "../ui/holo";
import { playSceneEntrance, startScene } from "../ui/screenTransition";
import { stageChapterNavigationLayout } from "../ui/stageChapterLayout";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";

/** 제목·구간 버튼·뒤로가기가 앉는 깊이. 비네트(40)보다 위다. */
const CHROME_DEPTH = 50;
/** 드래그를 스크롤로 볼지 탭으로 볼지 가르는 거리. */
const DRAG_SLOP = TAP_DRAG_SLOP;
/** 길의 점선 한 토막과 틈. */
const DASH = { on: 22, off: 16 } as const;
/** 가장 깊이 깬 층. */
function highestCleared(): number {
  return ancientHighestCleared(session.cleared, ANCIENT_STRATA_MAX_FLOOR);
}
/** 지금 도전하는 층(가장 깊이 깬 층의 다음 층). */
function currentFloor(): number {
  return ancientChallengeFloor(highestCleared(), ANCIENT_STRATA_MAX_FLOOR);
}

/** 지도 노드 옆에 서는 한 사람 — 친구와 길드원이 같은 모양으로 들어온다. */
interface AncientPeer { id: string; name: string; level: number; relicId: string; highestCleared: number }
type PeerTab = "friends" | "guild";
/** 마지막으로 고른 전환 — 화면을 다시 열어도 같은 쪽을 본다(기기 저장까지는 하지 않는다). */
let lastPeerTab: PeerTab = "friends";
/** 시련 아이디 → 노드 밑 짧은 이름표의 키. */
const NODE_STYLE = {
  cleared: { fill: 0x10151b, alpha: 0.86, edgeAlpha: 0.45 },
  locked: { fill: 0x0a0d11, alpha: 0.74, edgeAlpha: 0.3 },
  gate: { fill: 0x2a2230 },
} as const;

/**
 * 고대 지층 — 끝없이 내려가는 지층 탐사.
 *
 * 열 층이 한 구간(한 장의 지도)이고, 구간마다 원화가 바뀐다(`ancientBlockBackdrop`). 층은 위에서 아래로
 * 내려가며 노드가 가운데 축 양옆을 번갈아 오가는 긴 길이다. 노드에서 200층의 실제 적·배율을 미리 볼 수 있으며,
 * 공용 서버 전투 검증과 초회 정산을 사용한다.
 * 출격판에서 진입하며 첫 층은 쉬움 1-10 클리어 후 열린다.
 */
export class AncientStrataScene extends Phaser.Scene {
  private block = 0;
  private map?: Phaser.GameObjects.Container;
  private range!: Phaser.GameObjects.Text;
  private previousButton!: Button;
  private startButton!: Button;
  private selectedFloor?: number;
  private nextButton!: Button;
  private enemyPreview?: NodeEnemyPreview;
  private enemyInfo?: EnemyInfoPopup;
  private selectedNodeY?: number;
  private dragging = false;
  private dragMoved = 0;
  private dragOrigin = 0;
  private limits = ancientScrollLimits();
  private popups!: PopupLayer;
  private peerLayer?: Phaser.GameObjects.Container;
  private peerTabs?: Phaser.GameObjects.Container;
  private peers: Record<PeerTab, AncientPeer[]> = { friends: [], guild: [] };

  constructor() {
    super("ancientStrata");
  }

  create(): void {
    setDebugScene("ancientStrata");
    this.block = Math.floor((currentFloor()-1)/ANCIENT_FLOORS_PER_BLOCK);
    this.dragging = false;
    this.selectedNodeY = undefined;
    this.enemyPreview?.destroy();
    this.enemyPreview = new NodeEnemyPreview(this, { title: "", enemies: [], growth: [], top: ANCIENT_MAP.window.top,
      bottom: ANCIENT_MAP.window.bottom, depth: 100, onEnemyClick: () => undefined });
    this.popups = new PopupLayer(this, 2200);
    this.enemyInfo = new EnemyInfoPopup(this, this.popups);
    this.peers = { friends: [], guild: [] };
    this.add.rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, COLOR.void).setDepth(-30);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { depth: 40, strength: 0.5 });

    this.add.text(BASE_WIDTH / 2, 190, t("ancient.title"), textStyle({ role: "display", size: 52 })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.range = this.add.text(BASE_WIDTH / 2, 262, "", textStyle({ role: "body", size: 30, color: COLOR.inkDim })).setOrigin(0.5).setDepth(CHROME_DEPTH);
    this.selectedFloor=undefined;
    this.startButton=new Button(this,BASE_WIDTH/2,BASE_HEIGHT-190,{width:390,height:94,label:t("stageMap.sortie"),fontSize:32,cost:{icon:"currency-stamina",amount:CONTENT_STAMINA_COSTS.ancientFloor,affordable:session.wallet.stamina>=CONTENT_STAMINA_COSTS.ancientFloor},onClick:()=>{
      if(this.selectedFloor===undefined||!isStageUnlocked(ancientStageId(this.selectedFloor)))return;
      session.selectedStageId=ancientStageId(this.selectedFloor);
      startScene(this,"party",{content:"stage"});
    }}).setDepth(CHROME_DEPTH).setEnabled(false);

    const navigation = stageChapterNavigationLayout(BASE_WIDTH, BASE_HEIGHT);
    this.previousButton = new Button(this, navigation.previous.x, navigation.previous.y, {
      width: navigation.previous.width, height: navigation.previous.height, label: t("ancient.prev"), fontSize: 28,
      onClick: () => this.showBlock(this.block - 1),
    }).setDepth(CHROME_DEPTH);
    this.nextButton = new Button(this, navigation.next.x, navigation.next.y, {
      width: navigation.next.width, height: navigation.next.height, label: t("ancient.next"), fontSize: 28,
      onClick: () => this.showBlock(this.block + 1),
    }).setDepth(CHROME_DEPTH);
    addBackButton(this, () => startScene(this, "lobby", LOBBY_RETURN.sortie)).setDepth(CHROME_DEPTH);
    this.paintRankChip();
    this.paintPeerTabs();

    this.buildMap();
    void this.loadPeers();
    this.enableDragScroll();
    // 화면이 한 뼘 아래에서 떠오르며 들어온다 — 조각마다 트윈을 걸지 않으므로 `create`의 맨 끝이다.
    playSceneEntrance(this);
  }

  private showBlock(block: number): void {
    if (block < 0 || block > this.lastBlock() || block === this.block) return;
    this.enemyPreview?.dismiss();
    this.selectedFloor=undefined;this.startButton.setEnabled(false).setLabel(t("stageMap.sortie"));
    this.selectedNodeY = undefined;
    this.block = block;
    this.map?.destroy(true);
    this.buildMap();
  }

  /** 넘겨 볼 수 있는 마지막 구간 — 지금 도전하는 구간과 그다음 한 구간까지다. */
  private lastBlock(): number {
    return ancientLastBrowsableBlock(currentFloor(), ANCIENT_STRATA_MAX_FLOOR);
  }

  /** 이 구간의 원화·길·노드를 한 컨테이너에 세운다. 컨테이너를 굴리면 모두 함께 움직인다. */
  private buildMap(): void {
    const { first, last } = ancientBlockFloors(this.block);
    this.range.setText(`B${first} – B${last}`);
    this.previousButton.setEnabled(this.block > 0);
    this.nextButton.setEnabled(this.block < this.lastBlock());
    this.limits = ancientScrollLimits();
    const cx = BASE_WIDTH / 2;
    const map = this.add.container(0, this.limits.max);
    this.map = map;
    const challenge = currentFloor();
    const motion = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;

    // 원화는 컨테이너와 함께 굴러 화면이 어디를 비추든 비지 않는 길이로 키운다.
    const art = this.add.image(cx, this.limits.artTop, "__DEFAULT").setOrigin(0.5, 0);
    useBackgroundTexture(this, art, ancientBackground(ancientBlockBackdrop(this.block)), (image) => {
      image.setScale(Math.max(BASE_WIDTH / image.width, this.limits.artHeight / image.height));
    });
    map.add(art);
    map.add(this.add.rectangle(cx, this.limits.artTop + this.limits.artHeight / 2, BASE_WIDTH, this.limits.artHeight, COLOR.void, 0.3));

    const points = Array.from({ length: ANCIENT_FLOORS_PER_BLOCK }, (_, index) => ancientNodePoint(index, cx));
    // 지나온 길은 실선으로 채우고, 아직 가지 않은 길은 점선으로 남긴다 — 어디까지 내려왔는지가 선 하나로 읽힌다.
    const walked = this.add.graphics().lineStyle(8, COLOR.accent, 0.85);
    const ahead = this.add.graphics().lineStyle(6, COLOR.accent, 0.4);
    // 위·아래로 이어지는 토막은 끝없이 내려간다는 표식이다.
    const head = { x: points[0].x, y: points[0].y - ANCIENT_MAP.stub };
    const tail = { x: points[points.length - 1].x, y: points[points.length - 1].y + ANCIENT_MAP.stub };
    [head, ...points, tail].forEach((point, index, all) => {
      if (index === 0) return;
      // index번째 점까지 닿았는가 — 머리 토막은 이 구간의 첫 층, 꼬리 토막은 다음 구간의 첫 층이 기준이다.
      const reachedFloor = first + index - 1;
      if (reachedFloor <= challenge) walked.lineBetween(all[index - 1].x, all[index - 1].y, point.x, point.y);
      else this.dashedLine(ahead, all[index - 1], point);
    });
    map.add([ahead, walked]);

    points.forEach((point, index) => {
      const floor = first + index;
      const definition = getAncientStrataFloor(floor);
      const gate = isAncientGate(floor);
      const size = ancientNodeSize(floor);
      const cleared = floor < challenge || (floor === challenge && session.cleared.has(ancientStageId(floor)));
      const current = floor === challenge && !cleared;
      const locked = floor > challenge;
      const bevel = size * 0.3;
      const shape = chipPoints(size, size, { bevel: { topLeft: bevel, topRight: 0, bottomRight: bevel, bottomLeft: 0 } });
      if (current) {
        // 지금 층만 판 둘레가 숨 쉰다 — 같은 실루엣을 한 뼘 키워 깔아 깎인 모서리가 어긋나지 않는다.
        const glowSize = size + 30;
        const glow = drawLayer(this, point.x, point.y, chipPoints(glowSize, glowSize, { bevel: { topLeft: glowSize * 0.3, topRight: 0, bottomRight: glowSize * 0.3, bottomLeft: 0 } }), {
          fill: COLOR.accent, alpha: 0.28, edge: COLOR.accent, edgeAlpha: 0,
        });
        map.add(glow);
        if (motion) this.tweens.add({ targets: glow, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      const style = cleared ? NODE_STYLE.cleared : locked ? NODE_STYLE.locked : undefined;
      map.add(drawLayer(this, point.x, point.y, shape, {
        fill: current ? COLOR.accent : gate ? NODE_STYLE.gate.fill : style?.fill ?? 0x141920,
        alpha: current ? 0.96 : style?.alpha ?? 0.94,
        edge: gate || current ? COLOR.accent : COLOR.panelEdge,
        edgeAlpha: current ? 1 : style?.edgeAlpha ?? 0.9,
      }));
      // 관문은 그 층에 서는 정예의 얼굴을 액자로 품는다 — 열 층마다 누가 막아서는지가 지도에서 먼저 읽힌다.
      const leader = definition.enemies[0];
      if (gate && leader) {
        const face = new FaceFrame(this, point.x, point.y, { portraitAssetId: leader.portraitAssetId, size: size * 0.74, color: COLOR.accent, ...(locked ? { tint: 0x5a5a5a } : {}) });
        map.add(face);
      }
      // 관문의 층 이름은 얼굴 아래 원화 위에 서므로 지금 층이어도 진한 글자가 아니라 강조색이다.
      const labelColor = current ? (gate ? COLOR.accentText : "#1a1d21") : cleared || locked ? COLOR.inkDim : COLOR.ink;
      const labelY = gate ? point.y + size / 2 + 22 : point.y;
      const label = this.add.text(point.x, labelY, `B${floor}`, textStyle({ role: "emphasis", size: gate ? 36 : 32, color: labelColor }))
        .setOrigin(0.5, gate ? 0 : 0.5);
      if (gate) label.setStroke("#05070a", 6);
      map.add(label);
      // 깬 층은 체크, 아직 닿지 않은 층은 자물쇠가 오른쪽 위 모서리에 작게 선다.
      const corner = { x: point.x + size / 2 - 6, y: point.y - size / 2 + 6 };
      if (cleared) map.add(drawGlyph(this, "check", corner.x, corner.y, 30, COLOR.accent, 1, 4));
      else if (locked) map.add(drawGlyph(this, "lock", corner.x, corner.y, 28, COLOR.inkDimHex, 0.9));
      // 정예·무리 층은 적 정보창과 같은 역할 아이콘을 왼쪽 위에 단다 — 일반 층은 아무것도 달지 않는다.
      const role = leader?.encounterRole;
      if (role && role !== "normal" && !gate && this.textures.exists(encounterRoleIcon(role))) {
        map.add(this.add.image(point.x - size / 2 + 4, point.y - size / 2 + 4, encounterRoleIcon(role)).setDisplaySize(38, 38).setTint(locked ? COLOR.inkDimHex : 0xf3d9a4));
      }
      // 노드 밑의 짧은 이름표가 그 층의 시련을 말한다(자세한 수치는 노드를 눌러 연다).
      const trialY = gate ? labelY + 46 : point.y + size / 2 + 12;
      map.add(this.add.text(point.x, trialY, t(`ancient.trialTag.${definition.trialId}`), textStyle({ role: "emphasis", size: 22, color: locked ? COLOR.inkDim : COLOR.accentText }))
        .setOrigin(0.5, 0).setStroke("#05070a", 5).setAlpha(locked ? 0.75 : 1));
      if (gate) map.add(this.add.text(point.x, point.y - size / 2 - 10, t("ancient.gate"), textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0.5, 1).setStroke("#05070a", 6));
      if (current) {
        const tag = this.add.text(point.x, point.y - size / 2 - (gate ? 48 : 12), t("rewardTable.current"), textStyle({ role: "display", size: 26, color: COLOR.accentText }))
          .setOrigin(0.5, 1).setStroke("#05070a", 6);
        map.add(tag);
        if (motion) this.tweens.add({ targets: tag, y: tag.y - 8, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      }
      const hit = this.add.rectangle(point.x, point.y, size + 24, size + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => {
        // 지도를 끌던 손가락이 노드 위에서 떨어져도 안내가 뜨지 않게 한다.
        if (this.dragMoved > DRAG_SLOP) return;
        const multiplier = definition.multipliers;
        this.selectedNodeY = point.y;
        this.selectedFloor=floor;
        const unlocked=isStageUnlocked(ancientStageId(floor));
        this.startButton.setEnabled(unlocked).setLabel(unlocked?t("stageMap.sortie"):t("ancient.requirement",{stage:floor===1?"1-10":`B${floor-1}`}));
        this.enemyPreview?.showAt(point.y + map.y, { title: `B${floor}`,
          situation: `${t(`ancient.trial.${definition.trialId}`)}${floor>120?`\n${t("ancient.deepTrial")}`:""}\n${t("ancient.depthMultiplier")} · ${t("stat.hp")} ×${multiplier.hp.toFixed(2)} · ${t("stat.atk")}/${t("stat.ap")} ×${multiplier.attack.toFixed(2)} · ${t("stat.def")}/${t("stat.res")} ×${multiplier.defense.toFixed(2)}`,
          enemies: definition.enemies, growth: definition.enemies.map(() => ({ level: definition.level, breakthrough: definition.breakthrough })),
          elite: definition.encounterKind === "elite",
          sections: { informationLabel:t("ancient.trials"),informationAlwaysOpen:true,rewards: definition.firstClearRewards, rewardsClaimed: session.cleared.has(`ancient:${floor}`) },
          onEnemyClick: (enemy, growth) => this.enemyInfo?.show({ def: enemy, ...growth }),
        });
      });
      map.add(hit);
    });
    this.peerLayer = this.add.container(0, 0);
    map.add(this.peerLayer);
    this.paintPeers();
  }

  /** 왼쪽 위 순위 칩 — 결투장과 같은 칩이고, 오른쪽에 내 등수가 선다. 누르면 결투장과 같은 순위표가 열린다. */
  private paintRankChip(): void {
    const { rankChip, rankText } = ANCIENT_CHROME;
    const source = {
      title: t("ancient.ranking.title"),
      load: async () => {
        const ranking = await gameApi.getAncientRanking();
        const row = (entry: (typeof ranking.entries)[number]) => ({ rank: entry.rank, displayName: entry.displayName, score: entry.floor, isMe: entry.isMe, favoriteRelicId: entry.favoriteRelicId });
        return { entries: ranking.entries.map(row), me: ranking.me ? row(ranking.me) : null };
      },
      formatScore: (floor: number) => `B${floor}`,
    };
    new RailButton(this, rankChip.x, rankChip.y, {
      icon: "arena-tier", label: t("duel.link.ranking"), size: rankChip.size,
      onClick: () => new DuelRankingPopup(this, this.popups, "bronze", gameApi, source).open(),
    }).setDepth(CHROME_DEPTH);
    const text = this.add.text(rankText.x, rankChip.y, "", textStyle({ role: "display", size: 30, color: COLOR.accentText }))
      .setOrigin(0, 0.5).setStroke("#05070a", 6).setDepth(CHROME_DEPTH);
    // 순위를 읽지 못하면 그 자리를 비운다 — 상태 문구로 채우지 않는다.
    gameApi.getAncientRanking().then((ranking) => {
      if (!text.active) return;
      text.setText(ranking.me ? t("duel.rank.value", { rank: ranking.me.rank.toLocaleString() }) : t("duel.rank.none"));
    }).catch(() => undefined);
  }

  /** 오른쪽 위 「친구 / 길드」 전환 — 고른 쪽 사람들만 노드 옆에 선다. */
  private paintPeerTabs(): void {
    this.peerTabs?.destroy(true);
    const { right, y, width, height, gap } = ANCIENT_CHROME.socialTabs;
    const tabs = this.add.container(0, 0).setDepth(CHROME_DEPTH);
    this.peerTabs = tabs;
    (["friends", "guild"] as const).forEach((tab, index) => {
      const x = BASE_WIDTH - right - width / 2 - (1 - index) * (width + gap);
      addCategoryTab(this, tabs, {
        x, y, width, height, face: "down", selected: lastPeerTab === tab,
        label: t(tab === "friends" ? "rail.friends" : "rail.guild"),
        onSelect: () => {
          if (lastPeerTab === tab) return;
          lastPeerTab = tab;
          this.paintPeerTabs();
          this.paintPeers();
        },
      });
    });
  }

  /** 친구와 길드원을 함께 읽는다. 어느 한쪽이 실패해도(길드 없음 등) 다른 쪽은 선다. */
  private async loadPeers(): Promise<void> {
    const [friends, guild] = await Promise.allSettled([socialApi.getFriends(), guildApi.getMembers()]);
    if (!this.sys.isActive()) return;
    const known = (id: string): string => (RELICS.some((relic) => relic.id === id) ? id : "torika");
    this.peers = {
      friends: friends.status === "fulfilled" ? friends.value.friends.map((friend) => ({
        id: friend.id, name: friend.displayName, level: friend.level, relicId: known(friend.favoriteRelic.relicId),
        highestCleared: friend.competitiveStats.ancientFloor ?? 0,
      })) : [],
      guild: guild.status === "fulfilled" ? guild.value.members.filter((member) => !member.isMe).map((member) => ({
        id: member.userId, name: member.name, level: member.level, relicId: known(member.avatarRelicId),
        highestCleared: member.card?.ancientFloor ?? 0,
      })) : [],
    };
    this.paintPeers();
  }

  /** 이 구간에 서는 사람들의 얼굴 묶음을 노드 옆에 붙인다. 셋까지 겹쳐 서고 넘치는 몫은 `+N`이다. */
  private paintPeers(): void {
    const layer = this.peerLayer;
    if (!layer?.active) return;
    layer.removeAll(true);
    const { first, last } = ancientBlockFloors(this.block);
    const cx = BASE_WIDTH / 2;
    for (const [floor, group] of groupAncientPeers(this.peers[lastPeerTab], ANCIENT_STRATA_MAX_FLOOR)) {
      if (floor < first || floor > last || ancientBlockOf(floor) !== this.block) continue;
      const index = floor - first;
      const point = ancientNodePoint(index, cx);
      const size = ancientNodeSize(floor);
      const shown = group.slice(0, ANCIENT_PEERS.visible);
      // 뒤에 선 얼굴부터 깔아 첫 사람이 맨 앞에 선다.
      [...shown].reverse().forEach((peer, reversed) => {
        const slot = shown.length - 1 - reversed;
        layer.add(new FaceFrame(this, point.x + ancientPeerFaceX(index, size, slot), point.y, {
          portraitAssetId: RELICS.find((relic) => relic.id === peer.relicId)!.portraitAssetId, size: ANCIENT_PEERS.face,
          color: lastPeerTab === "guild" ? COLOR.exchange : COLOR.accent,
        }));
      });
      const direction = ancientPeerDirection(index);
      const lastX = ancientPeerFaceX(index, size, shown.length - 1);
      if (group.length > shown.length) {
        layer.add(this.add.text(point.x + lastX + direction * (ANCIENT_PEERS.face / 2 + 10), point.y, `+${group.length - shown.length}`,
          textStyle({ role: "display", size: 28, color: COLOR.ink })).setOrigin(direction > 0 ? 0 : 1, 0.5).setStroke("#05070a", 6));
      }
      // 첫 사람의 이름이 얼굴 묶음 밑에 선다 — 누구인지는 눌러서 모두 본다.
      const firstX = ancientPeerFaceX(index, size, 0);
      layer.add(this.add.text(point.x + (firstX + lastX) / 2, point.y + ANCIENT_PEERS.face / 2 + 6, shown[0].name,
        textStyle({ role: "emphasis", size: 20, color: COLOR.ink })).setOrigin(0.5, 0).setStroke("#05070a", 5));
      const span = Math.abs(lastX - firstX) + ANCIENT_PEERS.face + 20;
      const hit = this.add.rectangle(point.x + (firstX + lastX) / 2, point.y, span, ANCIENT_PEERS.face + 20, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => { if (this.dragMoved <= DRAG_SLOP) this.openPeerList(floor, group); });
      layer.add(hit);
    }
  }

  /** 한 층에 선 사람들을 이름·레벨과 함께 늘어놓는 작은 쪽지. */
  private openPeerList(floor: number, group: readonly AncientPeer[]): void {
    const rowHeight = 92;
    const height = 140 + group.length * rowHeight;
    this.popups.open({ width: 620, height, title: t("ancient.social.here", { floor: `B${floor}` }), dim: true, closeOnBackdrop: true }, (body) => {
      group.forEach((peer, index) => {
        const y = -height / 2 + 110 + index * rowHeight;
        body.add(new FaceFrame(this, -230, y, { portraitAssetId: RELICS.find((relic) => relic.id === peer.relicId)!.portraitAssetId, size: 72 }));
        body.add(this.add.text(-170, y, peer.name, textStyle({ role: "emphasis", size: 30, color: COLOR.ink })).setOrigin(0, 0.5));
        body.add(this.add.text(250, y, `LV.${peer.level}`, textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(1, 0.5));
      });
    });
  }

  /** 점선을 그린다. 실선 한 줄보다 「지나온 길」로 읽히고, 끝없이 이어지는 토막과 한 문법이다. */
  private dashedLine(graphics: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }): void {
    const length = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const dx = (to.x - from.x) / length;
    const dy = (to.y - from.y) / length;
    for (let at = 0; at < length; at += DASH.on + DASH.off) {
      const end = Math.min(at + DASH.on, length);
      graphics.lineBetween(from.x + dx * at, from.y + dy * at, from.x + dx * end, from.y + dy * end);
    }
  }

  /** 손가락으로 끌어 지도를 굴린다. 휠도 같은 경로다. */
  private enableDragScroll(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if(this.enemyPreview?.containsScreenPoint(pointer.worldX,pointer.worldY))return;
      if(this.startButton.getBounds().contains(pointer.worldX,pointer.worldY))return;
      this.enemyPreview?.dismiss();this.selectedFloor=undefined;this.selectedNodeY=undefined;this.startButton.setEnabled(false).setLabel(t("stageMap.sortie"));
      if (pointer.y < ANCIENT_MAP.window.top - 100 || pointer.y > ANCIENT_MAP.window.bottom + 40) return;
      this.dragging = true;
      this.dragMoved = 0;
      this.dragOrigin = (this.map?.y ?? 0) - pointer.y;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      this.dragMoved += Math.abs(pointer.velocity.y);
      this.scrollTo(this.dragOrigin + pointer.y);
    });
    this.input.on("pointerup", () => { this.dragging = false; });
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scrollTo((this.map?.y ?? 0) - dy));
  }

  private scrollTo(y: number): void {
    if (this.map) this.map.y = Phaser.Math.Clamp(y, this.limits.min, this.limits.max);
    if (this.selectedNodeY !== undefined && this.map) {
      const nodeY = this.selectedNodeY + this.map.y;
      this.enemyPreview?.trackNode(nodeY, nodeY >= ANCIENT_MAP.window.top && nodeY <= ANCIENT_MAP.window.bottom);
    }
  }
}
