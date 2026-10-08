import { sortRewardItems } from "./rewardOrder";
import Phaser from "phaser";
import { t } from "../i18n";
import { formatCurrency } from "../core/formatCurrency";
import { getRelic } from "../data/relics";
import { relicAppearanceManager } from "../managers/RelicAppearanceManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline } from "./holo";
import { drawGlyph } from "./glyphs";
import { addFramedIcon } from "./itemFrame";
import type { RewardPopupItem } from "./rewardPopupModel";
import { Button, DESTRUCTIVE_BUTTON_STYLE } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { setDebugRewardPopup } from "../debug";
import { spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { loadOwnedPuppet } from "./statusPuppetLoad";
import { takePlayerExp } from "../managers/PlayerExpReceipts";
import { addPlayerExpGainRow } from "./PlayerExpGainRow";
import { addDuelStandingRow, type DuelStandingResult } from "./DuelStandingRow";
import { addGrowthPathTiles, GROWTH_TILES } from "./GrowthPathTiles";
import type { GrowthPath } from "../core/growthPaths";
import { addSdFootShadow } from "./SdFootShadow";
import type { StageFirstClearReward } from "../core/stageRewards";
import { addStageRewardFrame } from "./stageRewardFrame";
import { openRuneInfoPopup } from "./RunePopup";

/** 결과 화면이 넘기는 편성원 한 명. MVP 여부만 알면 카드 크기·발광은 이 프리팹이 정한다. */
export interface StageCompleteFighter {
  relicId: string;
  isMvp: boolean;
}

/**
 * 판 아래에 서는 **결과 보상**.
 *
 * 스토리는 치즈케이크 한 종류라 액자 하나에 첫/반복 클리어 한 줄이면 끝이지만, 원정 노드는
 * 서버가 만든 전리품이 여럿이고 점수 증가분도 함께 말해야 한다. 둘을 **같은 판 안에서** 그리는
 * 이유는 승리 화면과 영수증이 따로 뜨면 MVP를 보다가 창을 한 번 더 넘겨야 하기 때문이다.
 */
export type StageCompleteReward =
  /**
   * 스토리 승리. 첫 판이면 **초회 보상 전부**(`firstClearRewards` — 실제로 받은 것)가 한 줄로 서고,
   * 반복 판이면 치즈케이크 한 장이다.
   */
  | { kind: "storyClear"; cheesecakeEarned: number; firstClear: boolean; firstClearRewards?: readonly StageFirstClearReward[] }
  /**
   * `settlement`은 이기고 진 것이 아닌 **정산**(원정·레이드) — 표제가 승리 축포 없이 중립이다. 친 만큼이 점수라
   * 이긴 판도 진 판도 없고, 그래서 강해지는 길 타일도 서지 않는다.
   */
  | { kind: "loot"; items: readonly RewardPopupItem[]; footnote?: string; settlement?: boolean }
  /**
   * 작전 실패.
   *
   * **승리와 같은 결산창을 쓴다.** 예전에는 전장 위에 검은 띠 하나와 버튼 둘을 얹어 끝냈는데,
   * 같은 전투가 이겼을 때는 편성과 MVP와 기여도를 보여 주고 졌을 때는 아무것도 말하지 않았다 —
   * 정작 무엇이 모자랐는지 알고 싶은 쪽은 진 판이다. 판은 그대로 두고 **색만 가라앉히며**,
   * 보상이 서던 자리에는 받을 것이 없으므로 **다음에 할 일**이 대신 선다.
   */
  | {
      kind: "defeat";
      actions: readonly StageCompleteAction[];
      /** 지는 길에도 걷어 온 것이 있으면(원정 전멸 정산) 버튼 위에 같은 액자 줄로 선다. */
      items?: readonly RewardPopupItem[];
      /** 액자 줄 아래 한 줄(결투의 점수 변화). 버튼은 그만큼 내려선다. */
      footnote?: string;
    };

/** 실패 결산창의 버튼 한 장. 무엇을 하면 강해지는지만 말한다. */
export interface StageCompleteAction {
  readonly label: string;
  readonly onPress: () => void;
  /** 이긴 판의 줄에서 가장 앞에 둘 길(다음 단계). 강조 판으로 선다. */
  readonly primary?: boolean;
  /** 지금은 갈 수 없는 길(스테미나가 모자란 다시 하기 등). 버튼은 서되 꺼져 있다. */
  readonly disabled?: boolean;
  /** 나가기처럼 판을 떠나는 길. 글자만 붉게 선다. */
  readonly danger?: boolean;
}

export interface StageCompletePopupOptions {
  reward: StageCompleteReward;
  /** 편성 순서 그대로 셋을 넘긴다. MVP 한 명만 가운데 크게 선다. */
  fighters: readonly StageCompleteFighter[];
  /** 그래프 팝업을 연 뒤 그 팝업이 닫히면 반드시 `onClosed`를 불러야 버튼이 다시 보인다. */
  onOpenContribution: (onClosed: () => void) => void;
  onConfirm?: () => void;
  /**
   * **다시 하기** — 같은 편성·같은 단계로 한 판 더. 또 도전할 수 있을 때만 넘긴다(던전·레이드).
   *
   * 이긴 판은 보상 줄 아래에, 진 판은 다음에 할 일 줄의 맨 위에 선다. 결과판 → 입구 → 편성 →
   * 전투 시작을 도는 대신 한 번에 다음 판으로 간다.
   */
  replay?: StageCompleteAction;
  /**
   * 이긴 스토리 관문의 **가로 한 줄**(다음 단계 · 다시 하기 · 나가기). 있으면 `replay` 자리를 대신한다.
   * 판은 화면 아무 곳이나 눌러도 닫히므로, 나가기는 그 닫힘이 부르는 기본 길과 같다.
   */
  clearActions?: readonly StageCompleteAction[];
  /**
   * 진 판에서 돌려준 스테미나. 있으면 판 밑동에 **작고 흐린 한 줄**로만 선다 — 진 판의 주인공은
   * 다음에 할 일이라, 이 줄이 버튼보다 먼저 읽히면 안 된다. 경험치 블록은 서지 않는다(오르지 않았다).
   */
  staminaRefunded?: number;
  /**
   * 결투의 티어·점수 변화. 있으면 경험치 블록 자리에 **티어 블록**이 서고(휘장 · 티어 · 게이지 · 증감),
   * 그 아래 내용은 한 블록만큼 내려선다. 이기고 진 판이 같은 블록을 쓴다.
   */
  standing?: DuelStandingResult;
  /**
   * 진 판의 **강해지는 길 타일**. 있으면 버튼 줄 위에 타일 줄이 서고, 눌린 길은 `onPick`이 맡는다
   * (판 닫기는 이 팝업이 한다). 길 자체는 `growthPaths`가 편성 상태에서 정한다.
   */
  growth?: { paths: readonly GrowthPath[]; onPick: (path: GrowthPath) => void };
}

/** 결투 티어 블록이 경험치 블록 자리를 쓸 때 그 아래 내용이 내려서는 만큼. */
const STANDING_SHIFT = 150;
/** 티어 블록의 가운데(휘장 중심). 기여도 버튼 바로 아래다. */
const STANDING_Y = 150;

const WIDTH = 940;
/** 판 높이. 표제는 판 윗변에서, 그 아래 조각들은 판 가운데에서 잰다. */
const HEIGHT = 1360;
/**
 * 연구원 경험치 블록(`PlayerExpGainRow`)의 자리 — **기여도 버튼 아래, 보상 줄 바로 위**, 가운데 정렬.
 *
 * 표제 바로 아래에 두던 때는 한 판의 결말(누가 잘했나 → 무엇을 받았나) 사이가 아니라 그 앞에 서서,
 * 연구원이 얼마나 컸는지가 승리 표제에 묻혔다. 받은 것과 한 덩어리로 읽히도록 보상 바로 위에 둔다.
 */
const EXP_ROW_Y = 172;
/** 기여도 그래프 입구. 편성 SD 이름줄과 경험치 블록 사이다. */
const CONTRIBUTION_Y = 50;
/**
 * 보상 줄의 자리. 스토리의 치즈케이크 한 장과 원정의 전리품 여럿이 **같은 줄**을 쓴다.
 *
 * 액자 크기는 `RewardPopup`의 158보다 한 뼘 작다 — 그쪽은 영수증 한 장이 전부인 판이지만
 * 여기는 위에 승리 표제와 편성 SD가 이미 서 있어, 같은 크기로 두면 보상이 MVP보다 먼저 읽힌다.
 */
const REWARD_ROW = { y: 320, frame: 132, gap: 168 } as const;

/**
 * 실패 결산창이 보상 자리에 세우는 버튼 줄.
 *
 * 가로로 늘어놓지 않고 **세로로 쌓는다** — 셋을 한 줄에 두면 글자가 칸을 넘고, 무엇보다 이
 * 자리는 고를 것이 하나뿐인 영수증이 아니라 **다음에 어디로 갈지**를 고르는 자리라 줄마다
 * 한 번씩 읽혀야 한다.
 */
const DEFEAT_ACTIONS = { top: 272, width: 420, height: 86, gap: 18, belowLoot: 416, footnoteShift: 84 } as const;

/** 진 판에서 돌려준 스테미나 한 줄. 판 밑변 가까이, 버튼 줄보다 한참 아래에 선다. */
const STAMINA_REFUND_Y = HEIGHT / 2 - 64;

/** 이긴 스토리 관문의 가로 버튼 줄(다음 단계 · 다시 하기 · 나가기). */
const CLEAR_ACTIONS = { y: 530, height: 92, gap: 16, side: 70, maxWidth: 300, font: 28 } as const;

/** 이긴 판의 「다시 하기」. 보상 줄과 그 아래 한 줄(점수 증가분) 밑에 선다. */
const REPLAY = { y: 530, width: 420, height: 86 } as const;

/**
 * MVP는 크게, 좌우 둘은 작게 — 가로 간격은 예전 카드 규격을 그대로 빌려 쓰고, 세로는 발끝이
 * 한 줄에 맞도록 SD 그림 높이만 다르게 잡는다. `groundY`가 모두 같은 값을 쓰는 이유다.
 */
const SD = { mvp: { width: 200, height: 300 }, side: { width: 150, height: 220 }, gap: 26, groundY: -70 };

/**
 * 스토리 스테이지 승리 결과.
 *
 * `RewardPopup`과 같은 계약(이미 지급 확정 · 화면 아무 곳이나 눌러 닫힘)을 따르는 연장선이다 —
 * 다만 보상 한 줄만으로는 그 판이 얼마나 잘 풀렸는지 보여줄 수 없어서, 위에 귀여운 승리 표제와
 * MVP 편성, 기여도 그래프 입구를 얹는다.
 */
export class StageCompletePopup {
  /** 이번 판의 보상·버튼 줄이 내려서는 만큼. 티어 블록이 선 판만 0이 아니다. */
  private shiftY = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly popups: PopupLayer) {}

  open(options: StageCompletePopupOptions): void {
    const defeated = options.reward.kind === "defeat";
    this.shiftY = options.standing ? STANDING_SHIFT : 0;
    // 이 판의 입장이 올린 경험치. 진 판도 스테미나를 썼으므로 함께 선다. 한 번 꺼내면 비워진다.
    const expReceipt = takePlayerExp();
    const loot = options.reward.kind === "loot" ? options.reward.items.filter(({ amount }) => amount > 0) : [];
    const clearRewards = options.reward.kind === "storyClear" && options.reward.firstClear ? options.reward.firstClearRewards ?? [] : [];
    const shownRewards = options.reward.kind === "storyClear"
      ? (clearRewards.length > 0 ? clearRewards.length : Math.floor(options.reward.cheesecakeEarned) > 0 ? 1 : 0)
      : loot.length;
    let hint: Phaser.GameObjects.Text | undefined;
    /** Puppet은 컨테이너 변환을 물려받지 않으므로 원점(0,0)에 선 전용 레이어에 화면 좌표로 세운다. */
    let puppetLayer: Phaser.GameObjects.Container | undefined;
    const puppets = new Set<PuppetCreature>();
    let attackButton: Button | undefined;
    let disposed = false;
    setDebugRewardPopup(true, shownRewards, { x: BASE_WIDTH / 2, y: BASE_HEIGHT / 2 });
    this.popups.open({
      // 진 판은 한 겹 더 어둡다. 판 자체를 다른 모양으로 만들지 않고 **뒤를 더 덮는 것**만으로
      // 가라앉히는 이유는, 같은 창을 보고 있다는 것이 먼저 읽혀야 하기 때문이다.
      width: WIDTH, height: HEIGHT, dim: true, dimAlpha: defeated ? 0.74 : 0.5,
      // 영수증과 같은 계약이라 팝업 안팎 어디를 눌러도 닫히고, 별도 닫기 버튼은 두지 않는다.
      closeOnBackdrop: true, hideCloseButton: true,
      onClose: () => {
        disposed = true;
        hint?.destroy();
        for (const puppet of puppets) { puppetLayer?.remove(puppet, false); puppet.destroy(); }
        puppets.clear();
        puppetLayer?.destroy(true);
        setDebugRewardPopup(false);
        options.onConfirm?.();
      },
    }, (body, close) => {
      // 기여도 그래프가 같은 popups 위에 한 겹 더 쌓이므로, 이 층의 깊이를 임의로 최상단에
      // 고정하지 않는다 — 고정하면 나중에 여는 팝업이 오히려 이 아래에 가려진다.
      // 배경 먼저 깔아 둬야 뒤에 얹는 카드·버튼이 topOnly 입력 우선순위로 자기 클릭만 받는다.
      const closeCatcher = this.scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff, 0).setInteractive({ useHandCursor: true });
      closeCatcher.on("pointerup", close);
      body.add(closeCatcher);

      this.buildTitle(body, defeated, options.reward.kind === "loot" && options.reward.settlement === true);
      // SD는 body 바깥, 팝업 층 바로 위에 화면 좌표로 세운다.
      puppetLayer = this.scene.add.container(0, 0).setDepth((body.parentContainer?.depth ?? 0) + 1);
      this.buildFighterPuppets(body, puppetLayer, puppets, () => disposed, options.fighters);
      attackButton = new Button(this.scene, 0, CONTRIBUTION_Y, {
        width: 360, height: 84, label: t("stageComplete.contribution"), fontSize: 26,
        // 그래프를 보는 동안은 이 버튼이 뒤에서 겹쳐 눌리지 않도록 숨겼다가, 그래프를 닫으면
        // 다시 보여준다.
        onClick: () => { attackButton?.setVisible(false); options.onOpenContribution(() => { if (!disposed) attackButton?.setVisible(true); }); },
      });
      body.add(attackButton);
      // 경험치를 올린 판이면 그 블록이, 아니면(원정처럼 스테미나를 쓰지 않는 판) 얇은 구분선이 같은 자리에 선다.
      if (options.standing) addDuelStandingRow(this.scene, body, STANDING_Y, options.standing);
      else if (expReceipt) addPlayerExpGainRow(this.scene, body, EXP_ROW_Y, expReceipt);
      else body.add(drawHairline(this.scene, 0, EXP_ROW_Y, WIDTH - 140, { color: defeated ? COLOR.danger : COLOR.accent, alpha: 0.3 }));
      if (options.reward.kind === "storyClear") {
        if (clearRewards.length > 0) this.buildFirstClearRewards(body, clearRewards);
        else this.buildClearReward(body, Math.floor(options.reward.cheesecakeEarned), options.reward.firstClear);
        if (options.clearActions) this.buildClearActions(body, close, options.clearActions);
        else if (options.replay) this.buildReplay(body, close, options.replay);
      }
      else if (options.reward.kind === "defeat") {
        const carried = (options.reward.items ?? []).filter(({ amount }) => amount > 0);
        const footnote = carried.length > 0 ? options.reward.footnote : undefined;
        if (carried.length > 0) this.buildLoot(body, carried, footnote);
        const actions = options.replay ? [options.replay, ...options.reward.actions] : options.reward.actions;
        const growth = options.growth;
        // 타일 줄은 받은 것(액자 줄) 바로 아래, 없으면 보상 자리에서 시작하고 버튼 줄은 그 아래로 밀린다.
        const tilesTop = (carried.length > 0 ? DEFEAT_ACTIONS.belowLoot - 43 : DEFEAT_ACTIONS.top - 43) + (footnote !== undefined ? DEFEAT_ACTIONS.footnoteShift : 0) + this.shiftY;
        if (growth && growth.paths.length > 0) {
          addGrowthPathTiles(this.scene, body, tilesTop, growth.paths, (path) => { growth.onPick(path); close(); });
        }
        const actionsTop = growth && growth.paths.length > 0 ? tilesTop + GROWTH_TILES.height + 20 + DEFEAT_ACTIONS.height / 2 : undefined;
        this.buildDefeatActions(body, close, actions, carried.length > 0, footnote !== undefined, actionsTop);
        if ((options.staminaRefunded ?? 0) > 0) {
          body.add(this.scene.add
            .text(0, STAMINA_REFUND_Y, t("stageComplete.staminaRefunded", { amount: options.staminaRefunded ?? 0 }), textStyle({ role: "body", size: 22, color: COLOR.inkDim }))
            .setOrigin(0.5).setAlpha(0.72));
        }
      }
      else {
        this.buildLoot(body, loot, options.reward.footnote);
        if (options.replay) this.buildReplay(body, close, options.replay);
      }

      // 팝업 밖(화면 고정 좌표)에 두되, 이 층 바로 위에만 머물게 한다 — 그래야 기여도 그래프가
      // 같은 popups 위에 한 겹 더 쌓여도 그 뒤로 가려지고, 새치기하듯 계속 앞에 남지 않는다.
      hint = this.scene.add
        .text(this.scene.scale.width / 2, this.scene.scale.height - 130, t("stageComplete.tapToConfirm"), textStyle({ role: "emphasis", size: 30, color: COLOR.ink }))
        .setOrigin(0.5).setAlpha(0.62).setDepth((body.parentContainer?.depth ?? 0) + 1);
      hint.setShadow(0, 3, "#000000", 4, false, true);
    });
  }

  /**
   * 표제.
   *
   * "Victory!"는 튀어 오르듯 한 번 확대했다 가라앉고, 양옆의 별 표식이 축하 인상을 더한다.
   * **"Defeat"는 반대로 위에서 내려앉는다** — 같은 자리·같은 크기지만 붉게 물들고 별 대신
   * 아무것도 서지 않으며, 커졌다 줄어드는 대신 조금 위에서 미끄러져 내려와 멈춘다. 글자만
   * 바꾸면 같은 축포가 진 판에서도 터진다.
   */
  private buildTitle(body: Phaser.GameObjects.Container, defeated: boolean, settlement = false): void {
    const y = -HEIGHT / 2 + 108;
    const title = this.scene.add
      .text(0, y, settlement ? t("stageComplete.settlement") : defeated ? "Defeat" : "Victory!", textStyle({ role: "display", size: 64, color: settlement ? COLOR.ink : defeated ? COLOR.dangerText : COLOR.accentText }))
      .setOrigin(0.5);
    title.setShadow(0, 4, "#000000", 6, false, true);
    body.add(title);
    if (settlement) {
      // 축포도 가라앉음도 없이 위에서 조용히 내려앉는다.
      title.setY(y - 20).setAlpha(0);
      this.scene.tweens.add({ targets: title, y, alpha: 1, duration: 320, ease: "Cubic.Out" });
      return;
    }
    if (defeated) {
      title.setY(y - 34).setAlpha(0);
      this.scene.tweens.add({ targets: title, y, alpha: 1, duration: 380, ease: "Cubic.Out" });
      return;
    }
    title.setScale(0.5);
    this.scene.tweens.add({ targets: title, scale: 1.12, duration: 260, ease: "Back.Out", onComplete: () => this.scene.tweens.add({ targets: title, scale: 1, duration: 140, ease: "Sine.Out" }) });
    const starLeft = drawGlyph(this.scene, "bookmark", -title.width / 2 - 44, y, 40, COLOR.accent);
    const starRight = drawGlyph(this.scene, "bookmark", title.width / 2 + 44, y, 40, COLOR.accent);
    body.add([starLeft, starRight]);
  }

  /**
   * 보상 자리에 서는 **다음에 할 일**.
   *
   * 진 판에는 받을 것이 없다 — 그 자리를 비워 두면 판 아래 절반이 통째로 빈 상자가 되고,
   * "보상 없음" 같은 문장을 적으면 플레이어가 지금 할 일은 바뀌지 않는다. 대신 강해지는 길로
   * 가는 입구를 세운다. 어느 길인지는 부르는 쪽(전투 화면)이 정하고 이 판은 줄만 쌓는다.
   */
  private buildDefeatActions(body: Phaser.GameObjects.Container, close: () => void, actions: readonly StageCompleteAction[], belowLoot: boolean, belowFootnote = false, topOverride?: number): void {
    const top = topOverride ?? (belowLoot ? DEFEAT_ACTIONS.belowLoot : DEFEAT_ACTIONS.top) + (belowFootnote ? DEFEAT_ACTIONS.footnoteShift : 0) + this.shiftY;
    actions.forEach((action, index) => {
      const y = top + index * (DEFEAT_ACTIONS.height + DEFEAT_ACTIONS.gap);
      body.add(new Button(this.scene, 0, y, {
        width: DEFEAT_ACTIONS.width, height: DEFEAT_ACTIONS.height, label: action.label, fontSize: 30,
        ...(action.danger ? DESTRUCTIVE_BUTTON_STYLE : {}),
        // **고른 길을 먼저 알리고 그다음 닫는다.** 판은 화면 아무 곳이나 눌러도 닫히고 그
        // 닫힘이 "아무것도 고르지 않았다"는 기본 행선지를 부르므로, 닫기를 먼저 부르면 고른
        // 길과 기본 길이 같은 틱에 둘 다 선다.
        onClick: () => { action.onPress(); close(); },
      }).setEnabled(action.disabled !== true));
    });
  }

  /** 이긴 판의 가로 한 줄. 셋이 한 폭을 똑같이 나눠 어느 길도 먼저 눈에 띄지 않되, 앞서 갈 길만 강조 판이다. */
  private buildClearActions(body: Phaser.GameObjects.Container, close: () => void, actions: readonly StageCompleteAction[]): void {
    const gap = CLEAR_ACTIONS.gap;
    const width = Math.min(CLEAR_ACTIONS.maxWidth, (WIDTH - CLEAR_ACTIONS.side * 2 - gap * (actions.length - 1)) / actions.length);
    const total = width * actions.length + gap * (actions.length - 1);
    actions.forEach((action, index) => {
      const x = -total / 2 + width / 2 + index * (width + gap);
      body.add(new Button(this.scene, x, CLEAR_ACTIONS.y, {
        width, height: CLEAR_ACTIONS.height, label: action.label, fontSize: CLEAR_ACTIONS.font,
        variant: action.primary ? "primary" : undefined,
        ...(action.danger ? DESTRUCTIVE_BUTTON_STYLE : {}),
        onClick: () => { action.onPress(); close(); },
      }).setEnabled(action.disabled !== true));
    });
  }

  /** 이긴 판의 「다시 하기」. 고른 길을 먼저 알리고 닫는다 — 순서는 `buildDefeatActions`와 같은 이유다. */
  private buildReplay(body: Phaser.GameObjects.Container, close: () => void, replay: StageCompleteAction): void {
    body.add(new Button(this.scene, 0, REPLAY.y, {
      width: REPLAY.width, height: REPLAY.height, label: replay.label, fontSize: 30, variant: "primary",
      onClick: () => { replay.onPress(); close(); },
    }));
  }

  /**
   * MVP는 가운데 크게, 나머지 둘은 옆에 작게 — 그리드 카드 대신 SD가 idle로 서 있는 편성을
   * 보여준다. Puppet은 컨테이너 변환을 물려받지 않으므로 `puppetLayer`(화면 좌표, body 밖)에
   * 세우고, 이름표·MVP 표식만 `body`(팝업 로컬 좌표)에 얹는다.
   */
  private buildFighterPuppets(
    body: Phaser.GameObjects.Container,
    puppetLayer: Phaser.GameObjects.Container,
    puppets: Set<PuppetCreature>,
    isDisposed: () => boolean,
    fighters: readonly StageCompleteFighter[],
  ): void {
    const centerIndex = fighters.findIndex((fighter) => fighter.isMvp);
    const order = centerIndex < 0 ? fighters : [...fighters.slice(0, centerIndex), ...fighters.slice(centerIndex + 1)];
    // 항상 [왼쪽 보조, MVP, 오른쪽 보조] 순서로 세워 MVP가 어느 슬롯에서 왔든 가운데 자리는 고정한다.
    const layout: Array<{ fighter: StageCompleteFighter; slot: "side" | "mvp" }> = centerIndex < 0
      ? fighters.map((fighter) => ({ fighter, slot: "side" as const }))
      : [{ fighter: order[0], slot: "side" }, { fighter: fighters[centerIndex], slot: "mvp" }, { fighter: order[1], slot: "side" }];

    const totalWidth = SD.side.width * 2 + SD.mvp.width + SD.gap * 2;
    const absGroundY = BASE_HEIGHT / 2 + SD.groundY;
    let x = -totalWidth / 2;
    layout.forEach(({ fighter, slot }) => {
      const size = slot === "mvp" ? SD.mvp : SD.side;
      const cx = x + size.width / 2;
      const absX = BASE_WIDTH / 2 + cx;
      const relic = getRelic(fighter.relicId);
      // 발밑 그림자는 카드 없이 서는 SD가 바닥에 붙어 보이게 하는 최소한의 장치다.
      addSdFootShadow(this.scene, absX, absGroundY + 6, size.width * 0.66, puppetLayer);
      void loadOwnedPuppet({
        spawn: () => spawnPuppet(this.scene, relicAppearanceManager.sdAssetFor(fighter.relicId), { x: absX, groundY: absGroundY, height: size.height }),
        isCurrent: () => !isDisposed(),
        isDisplayable: (puppet) => Boolean(puppet.active),
        adopt: (puppet) => { puppet.disableInteractive(); puppetLayer.add(puppet); puppets.add(puppet); },
      });
      const level = relicProgression.getProgress(relic.id).level;
      body.add(this.scene.add.text(cx, SD.groundY + 34, `Lv.${level}  ${relic.name}`, textStyle({ role: "emphasis", size: slot === "mvp" ? 24 : 19, color: slot === "mvp" ? COLOR.accentText : COLOR.ink })).setOrigin(0.5));
      if (slot === "mvp") this.buildMvpLabel(body, cx, SD.groundY - size.height - 26);
      x += size.width + SD.gap;
    });
  }

  /** "MVP!"는 승리 표제처럼 튀어 오르며 살짝 기울어져, 작은 글자여도 눈에 먼저 든다. */
  private buildMvpLabel(body: Phaser.GameObjects.Container, x: number, y: number): void {
    const label = this.scene.add.text(x, y, "MVP!", textStyle({ role: "display", size: 42, color: COLOR.accentText })).setOrigin(0.5).setAngle(-6);
    label.setStroke("#3b2408", 10);
    label.setShadow(0, 4, "#000000", 4, false, true);
    label.setScale(0.5);
    this.scene.tweens.add({ targets: label, scale: 1.18, duration: 260, ease: "Back.Out", delay: 120, onComplete: () => this.scene.tweens.add({ targets: label, scale: 1.04, duration: 140, ease: "Sine.Out" }) });
    body.add(label);
  }

  /** RewardPopup과 같은 액자 하나로, 스토리 클리어의 치즈케이크 한 종류를 보여 준다. */
  private buildClearReward(body: Phaser.GameObjects.Container, cheesecake: number, firstClear: boolean): void {
    if (cheesecake <= 0) return;
    const size = REWARD_ROW.frame;
    const frame = chipPoints(size, size, { bevel: { topLeft: size * 0.215, topRight: 0, bottomRight: size * 0.215, bottomLeft: 0 } });
    body.add(drawLayer(this.scene, 0, REWARD_ROW.y, frame, { fill: 0x101722, alpha: 0.98 }));
    body.add(this.scene.add.image(0, REWARD_ROW.y, "currency-cheesecake").setDisplaySize(size * 0.76, size * 0.76));
    body.add(drawInnerVignette(this.scene, 0, REWARD_ROW.y, frame, { strength: 0.62 }));
    body.add(drawShapeOutline(this.scene, 0, REWARD_ROW.y, frame, { color: COLOR.accent, alpha: 0.82, width: 3 }));
    const amount = this.scene.add.text(size / 2 - 11, REWARD_ROW.y + size / 2 - 9, formatCurrency(cheesecake), textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(1, 1);
    amount.setStroke("#000000", 6); amount.setShadow(2, 3, "#000000", 2, false, true);
    body.add(amount);
    body.add(this.scene.add.text(0, REWARD_ROW.y + size / 2 + 33, firstClear ? t("stageComplete.firstClear") : t("stageComplete.repeatClear"), textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /**
   * 첫 승리의 초회 보상 전부 — 노드 미리보기에서 본 **같은 액자**(`addStageRewardFrame`)가 같은 순서로
   * 선다. 미리보기에서 본 줄이 그대로 손에 들어왔다는 것이 읽혀야 한다.
   */
  private buildFirstClearRewards(body: Phaser.GameObjects.Container, rewards: readonly StageFirstClearReward[]): void {
    const gap = Math.min(REWARD_ROW.gap, (WIDTH - 140 - REWARD_ROW.frame) / Math.max(1, rewards.length - 1));
    const frame = Math.min(REWARD_ROW.frame, gap - 14);
    const startX = -((rewards.length - 1) * gap) / 2;
    rewards.forEach((reward, index) => {
      const x = startX + index * gap;
      addStageRewardFrame(this.scene, body, x, REWARD_ROW.y, frame, reward);
      // 받은 룬은 눌러서 그 룬의 쪽지를 볼 수 있다. 재화 액자는 공용 규칙이 안내창을 잇는다.
      if (reward.kind !== "rune" || !reward.instanceId) return;
      const instanceId = reward.instanceId;
      const hit = this.scene.add.rectangle(x, REWARD_ROW.y, frame, frame, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => openRuneInfoPopup(this.scene, this.popups, { runeInstanceId: instanceId }));
      body.add(hit);
    });
    body.add(this.scene.add.text(0, REWARD_ROW.y + frame / 2 + 33, t("stageComplete.firstClear"), textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
  }

  /**
   * 원정 노드의 전리품 — **같은 판 안에서** 액자 줄로 선다.
   *
   * 예전에는 승리 화면을 닫고 `RewardPopup`이 따로 떴다. 창이 둘이면 MVP를 보다가 한 번 더
   * 넘겨야 하고, 그 사이에 방금 본 편성이 사라진다. 액자·그림 비율·수량 자리는 어디서나 같은
   * 공용 프리팹 한 장(`addFramedIcon`)이 그리므로 여기서 다시 정하지 않는다.
   *
   * 점수 증가분은 액자로 세우지 않는다 — 지갑에 들어온 재화가 아니라 **이번 판이 얼마를
   * 보탰는가**라, 줄 아래 글자 한 줄이 그 몫을 맡는다(`RewardPopup`의 `footnote`와 같은 규칙).
   */
  private buildLoot(body: Phaser.GameObjects.Container, rawItems: readonly RewardPopupItem[], footnote?: string): void {
    const items = sortRewardItems(rawItems);
    const rowY = REWARD_ROW.y + this.shiftY;
    if (items.length === 0) {
      if (footnote) this.buildFootnote(body, rowY, footnote);
      return;
    }
    // 넉 장까지는 판 안에 들어오고, 그보다 많으면 칸 사이만 좁혀 같은 줄에 담는다 — 여기는
    // 가로로 훑을 수 있는 영수증이 아니라 한눈에 읽는 결과판이라 줄이 흐르면 안 된다.
    const gap = Math.min(REWARD_ROW.gap, (WIDTH - 140 - REWARD_ROW.frame) / Math.max(1, items.length - 1));
    const startX = -((items.length - 1) * gap) / 2;
    items.forEach((item, index) => {
      const x = startX + index * gap;
      const holder = addFramedIcon(this.scene, body, x, rowY, REWARD_ROW.frame, typeof item.icon === "string" ? item.icon : "", {
        amount: formatCurrency(item.amount),
      });
      // 계정 장식처럼 전용 텍스처가 없는 결과만 기존 홀로그램 글리프 체계로 대신한다.
      if (typeof item.icon !== "string") holder.addAt(drawGlyph(this.scene, item.icon.key, 0, 0, REWARD_ROW.frame * 0.56, COLOR.accent), 1);
      if (item.label) body.add(this.scene.add.text(x, rowY + REWARD_ROW.frame / 2 + 26, item.label, textStyle({ role: "body", size: 18, color: COLOR.inkDim })).setOrigin(0.5));
    });
    if (footnote) this.buildFootnote(body, rowY + REWARD_ROW.frame / 2 + 66, footnote);
  }

  /** 이번 판이 점수를 얼마나 보탰는가. 재화가 아니므로 액자가 아니라 글자 한 줄이다. */
  private buildFootnote(body: Phaser.GameObjects.Container, y: number, footnote: string): void {
    // 점수는 경고가 아니다 — 주황·붉은 글씨로 세우면 무언가 잘못된 것처럼 읽혀 흰 글씨로 깔끔하게 둔다.
    body.add(this.scene.add.text(0, y, footnote, textStyle({ role: "display", size: 34, color: COLOR.ink }))
      .setOrigin(0.5)
      .setShadow(0, 4, "#000000", 6, false, true));
  }
}
