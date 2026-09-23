import Phaser from "phaser";
import { gameApi } from "../api/FakeServer";
import { BASE_WIDTH } from "../config/gameConfig";
import { bountyTierProgress, type BountyBattleInputDto, type BountyRoundIndex } from "../core/bountyRun";
import { formatCurrency } from "../core/formatCurrency";
import { moveFormationSlot } from "../core/formation";
import { BOUNTY, type BountyTierDef, bountyRoundLevel } from "../data/bounty";
import { getRelic } from "../data/relics";
import { setDebugScene } from "../debug";
import { t } from "../i18n";
import { relicCollection } from "../managers/RelicCollectionManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { session } from "../state/session";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { bountyFormationSlotCenterX, bountyTierRowCenterY, BOUNTY_LAYOUT } from "../ui/bountyLayout";
import { Button } from "../ui/Button";
import { FaceFrame } from "../ui/FaceFrame";
import { addFormationSlotPlate, addFormationSlotSelection } from "../ui/formationSlotChrome";
import { addFramedIcon } from "../ui/itemFrame";
import { addBackButton } from "../ui/IconButton";
import { drawLayer, drawVignette, slantedRect } from "../ui/holo";
import { PortraitCard } from "../ui/PortraitCard";
import { addSectionTitle } from "../ui/SectionTitle";
import { COLOR, textStyle } from "../ui/theme";
import { LOBBY_RETURN } from "./lobbyEntry";
import { prefetchBattlePuppets } from "../puppets/battlePrefetch";
import { BOUNTY_TIERS } from "../data/bounty";

/**
 * 현상수배 — **정예 셋과 1대1로 세 라운드를 치르는 골드 던전.**
 *
 * 화면이 하는 일은 둘뿐이다. **어느 등급으로 갈지** 고르고, **누가 몇 번째로 나갈지** 정한다.
 * 그 밖의 판단(해금·입장 횟수·보상)은 전부 서버가 확정한 값을 그리기만 한다 — 화면이 되짚으면
 * 서버가 거절한 입장을 열어 둔 채 보여 주게 된다.
 *
 * 편성 칸은 발굴·교류 파견·원정·스토리와 **같은 판 한 장**(`addFormationSlotPlate`)을 쓴다.
 * 다만 여기서는 칸이 **순서**를 뜻한다 — 1번 칸이 1라운드에 나간다. 두 칸을 차례로 누르면
 * 자리가 바뀌며, 바꾸는 규칙은 공용 순수 규칙(`moveFormationSlot`)을 그대로 지난다.
 */
export class BountyScene extends Phaser.Scene {
  private selectedTierId = "";
  private clearedTierIds: readonly string[] = [];
  private entriesRemaining: number = BOUNTY.maxEntriesPerUtcDay;
  /** 자리를 바꾸려고 먼저 고른 칸. 아직 없으면 null이다. */
  private pickedSlot: number | null = null;
  /** 입장 요청이 도는 동안 같은 손이 두 판을 열지 못하게 한다. */
  private entering = false;
  private body?: Phaser.GameObjects.Container;

  constructor() {
    super("bounty");
  }

  create(): void {
    // 세 라운드의 적이 등급마다 이미 정해져 있으므로 목록을 보는 동안 전부 읽어 둔다.
    prefetchBattlePuppets(relicCollection.validParty, BOUNTY_TIERS.flatMap((tier) => tier.rounds.map((round) => round.relicId)));
    setDebugScene("bounty");
    addSceneBackground(this, BACKGROUND.sortieBounty);
    drawVignette(this, BASE_WIDTH, this.scale.height, { strength: 0.7 });
    this.pickedSlot = null;
    this.entering = false;
    this.body = this.add.container(0, 0);
    addBackButton(this, () => this.scene.start("lobby", LOBBY_RETURN.sortie));
    this.refresh();
    // 서버가 오늘 날짜로 정규화한 해금·잔여 횟수가 도착하면 그때 목록을 다시 세운다.
    void gameApi.getBountyStatus().then((status) => {
      if (!this.scene.isActive()) return;
      this.clearedTierIds = status.clearedTierIds;
      this.entriesRemaining = status.entriesRemaining;
      this.refresh();
    }).catch(() => undefined);
  }

  /** 등급 줄·편성 칸·출격을 한 번에 다시 세운다. 조각만 갈아 끼우면 고른 줄과 칸이 갈린다. */
  private refresh(): void {
    const body = this.body;
    if (!body) return;
    body.removeAll(true);
    const rows = bountyTierProgress(this.clearedTierIds);
    // 고른 등급이 아직 없거나 잠겼으면 열려 있는 가장 높은 등급으로 내려온다.
    const openRows = rows.filter(({ unlocked }) => unlocked);
    if (!openRows.some(({ tier }) => tier.id === this.selectedTierId)) this.selectedTierId = openRows[openRows.length - 1]?.tier.id ?? rows[0].tier.id;

    body.add(addSectionTitle(this, BOUNTY_LAYOUT.title.x, BOUNTY_LAYOUT.title.y, t("bounty.title")));
    body.add(this.add.text(BOUNTY_LAYOUT.entries.x, BOUNTY_LAYOUT.entries.y, t("bounty.entries", { remaining: this.entriesRemaining, max: BOUNTY.maxEntriesPerUtcDay }),
      textStyle({ role: "emphasis", size: 30, color: COLOR.inkDim })).setOrigin(1, 0.5));

    rows.forEach(({ tier, unlocked, cleared }, index) => this.addTierRow(body, tier, index, unlocked, cleared));

    body.add(addSectionTitle(this, BOUNTY_LAYOUT.title.x, BOUNTY_LAYOUT.formation.titleY, t("bounty.formation.title"), { size: 30 }));
    this.addFormationSlots(body);

    const selected = rows.find(({ tier }) => tier.id === this.selectedTierId);
    const ready = selected !== undefined && selected.unlocked && this.entriesRemaining > 0 && relicCollection.validParty.length === 3;
    const sortie = new Button(this, BOUNTY_LAYOUT.sortie.x, BOUNTY_LAYOUT.sortie.y, {
      width: BOUNTY_LAYOUT.sortie.width, height: BOUNTY_LAYOUT.sortie.height,
      // 비용은 버튼 안에서 말한다 — 판 안에 액자를 넣으면 판이 두 겹이 된다.
      label: t("bounty.sortie", { stamina: BOUNTY.staminaCost }),
      onClick: () => { if (ready) void this.enter(); },
    });
    sortie.setAlpha(ready ? 1 : 0.42);
    body.add(sortie);
  }

  /** 등급 한 줄. 왼쪽에 이름과 보상, 오른쪽에 그 판에 서는 정예 셋의 얼굴이 순서대로 선다. */
  private addTierRow(body: Phaser.GameObjects.Container, tier: BountyTierDef, index: number, unlocked: boolean, cleared: boolean): void {
    const { width, height, faceSize, faceFirstX, faceGap } = BOUNTY_LAYOUT.tier;
    const centerY = bountyTierRowCenterY(index);
    const selected = tier.id === this.selectedTierId;
    const row = this.add.container(BASE_WIDTH / 2, centerY);
    row.add(drawLayer(this, 0, 0, slantedRect(width, height, 26), {
      fill: COLOR.panel, alpha: selected ? 0.92 : 0.72,
      edge: selected ? COLOR.accent : COLOR.inkDimHex, edgeAlpha: selected ? 0.9 : 0.4,
    }));
    row.add(this.add.text(-width / 2 + 40, -34, tier.name, textStyle({ role: "display", size: 38, color: unlocked ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
    // 보상은 재화 액자 한 장으로만 말한다. 이름을 옆에 적으면 그림이 이미 한 말을 되풀이한다.
    row.add(addFramedIcon(this, undefined, -width / 2 + 78, 40, 62, "currency-gold", { amount: formatCurrency(tier.rewardGold) }));
    // 깬 등급은 표식 대신 줄 자체가 강조색을 띤다 — 목록에 다른 종류의 표식을 더하지 않는다.
    if (cleared) row.add(this.add.text(-width / 2 + 40, 92, t("bounty.cleared"), textStyle({ role: "emphasis", size: 22, color: COLOR.accentText })).setOrigin(0, 1));

    tier.rounds.forEach((round, roundIndex) => {
      const def = getRelic(round.relicId);
      const face = new FaceFrame(this, width / 2 - faceFirstX + roundIndex * faceGap - faceGap * 2, -14, {
        portraitAssetId: def.portraitAssetId, size: faceSize,
      });
      if (!unlocked) face.setAlpha(0.45);
      row.add(face);
      row.add(this.add.text(width / 2 - faceFirstX + roundIndex * faceGap - faceGap * 2, faceSize / 2 + 14,
        t("bounty.round.level", { level: bountyRoundLevel(round) }),
        textStyle({ role: "emphasis", size: 22, color: unlocked ? COLOR.inkDim : COLOR.inkDim })).setOrigin(0.5, 0));
    });

    if (unlocked) {
      row.setSize(width, height).setInteractive({ useHandCursor: true })
        .on(Phaser.Input.Events.POINTER_UP, () => { this.selectedTierId = tier.id; this.refresh(); });
    } else {
      row.setAlpha(0.55);
    }
    body.add(row);
  }

  /**
   * 세 라운드에 나가는 순서.
   *
   * 칸을 누르면 그 칸이 들리고, 다른 칸을 누르면 둘이 자리를 바꾼다. 같은 칸을 다시 누르면
   * 내려놓는다 — 끄는 손짓을 흉내 내지 않는 이유는 이 화면에서 바꾸는 것이 자리가 아니라
   * **순서**이기 때문이다.
   */
  private addFormationSlots(body: Phaser.GameObjects.Container): void {
    const { slotWidth, slotHeight, centerY } = BOUNTY_LAYOUT.formation;
    const party = relicCollection.validParty;
    for (let slot = 0; slot < 3; slot += 1) {
      const box = { x: bountyFormationSlotCenterX(slot), y: centerY, width: slotWidth, height: slotHeight };
      const relicId = party[slot];
      if (this.pickedSlot === slot) addFormationSlotSelection(this, body, box);
      addFormationSlotPlate(this, body, box, { occupied: relicId !== undefined, groundOffset: slotHeight / 2 - 40, index: slot });
      if (relicId !== undefined) {
        const relic = getRelic(relicId);
        const card = new PortraitCard(this, box.x, box.y - 14, {
          width: slotWidth - 44, height: slotHeight - 78, relicId, label: relic.name, rarity: relic.rarity,
          level: relicProgression.getProgress(relicId).level,
          breakthroughGrade: relicProgression.getBreakthroughGrade(relicId),
        });
        body.add(card);
      }
      body.add(this.add.text(box.x, box.y + slotHeight / 2 + 26, t("bounty.formation.round", { round: slot + 1 }),
        textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(0.5, 0));
      const hit = this.add.rectangle(box.x, box.y, slotWidth, slotHeight, COLOR.void, 0.001).setInteractive({ useHandCursor: true });
      hit.on(Phaser.Input.Events.POINTER_UP, () => this.pickSlot(slot, party));
      body.add(hit);
    }
  }

  /** 두 칸을 차례로 누르면 순서를 바꾼다. 저장 실패는 매니저가 이전 순서로 되돌린다. */
  private pickSlot(slot: number, party: readonly string[]): void {
    if (party.length !== 3) return;
    if (this.pickedSlot === null || this.pickedSlot === slot) {
      this.pickedSlot = this.pickedSlot === slot ? null : slot;
      this.refresh();
      return;
    }
    const next = moveFormationSlot(party, this.pickedSlot, slot);
    this.pickedSlot = null;
    // 순서는 편성 그 자체이므로 화면이 배열을 직접 바꾸지 않고 수집 매니저 경계를 지난다.
    relicCollection.setParty(next);
    this.refresh();
  }

  /** 입장은 서버가 확정한 뒤에만 전장으로 넘어간다. 스테미나와 일일 횟수도 거기서 나간다. */
  private async enter(): Promise<void> {
    if (this.entering) return;
    this.entering = true;
    const tierId = this.selectedTierId;
    const requestId = `bounty:${tierId}:${Date.now()}`;
    try {
      await gameApi.enterBounty({ tierId, requestId });
    } catch {
      this.entering = false;
      // 입장이 막힌 이유는 스테미나 칸과 남은 횟수가 이미 화면에서 말하고 있다. 같은 말을
      // 상태 문구로 되풀이하지 않고 서버가 확정한 잔여 횟수만 다시 읽어 온다.
      void gameApi.getBountyStatus().then((status) => {
        if (!this.scene.isActive()) return;
        this.clearedTierIds = status.clearedTierIds;
        this.entriesRemaining = status.entriesRemaining;
        this.refresh();
      }).catch(() => undefined);
      return;
    }
    if (!this.scene.isActive()) return;
    session.selectedStageId = session.selectedStageId ?? "1-1";
    this.scene.start("battle", { mode: "bounty", tierId, round: 0 as BountyRoundIndex, requestId } satisfies BountyBattleInputDto);
  }
}
