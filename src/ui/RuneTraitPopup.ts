import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { RuneInstance } from "../core/runes";
import { runeDisplayName, runeRarityLabel } from "../core/runes";
import { canUpgradeRuneTraitGrade, RUNE_TRAIT_RULES, type RuneTrait } from "../core/runeTraits";
import { RUNE_TRAIT_ITEMS } from "../data/runeTraits";
import { session } from "../state/session";
import { Button } from "./Button";
import { KeywordManager } from "../managers/KeywordManager";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { runeTraitView } from "./runeTraitPresentation";
import { RUNE_ACCENT } from "./runeIcons";

/**
 * 특성 연구 쪽지.
 *
 * **한 룬의 특성 한 줄에 대해 할 수 있는 일 전부가 여기 모인다** — 부여·재부여·재해석·등급
 * 상승이 각각 다른 화면에 흩어지면 지금 이 룬이 어느 단계인지 매번 다시 찾아야 한다.
 *
 * 창 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다.
 */

/** 판 안의 세로 좌표를 한 곳에서 잡는다. 화면이 픽셀을 다시 세지 않는다. */
const TRAIT_POPUP = {
  width: 900,
  /** 머리글 아래 첫 줄까지의 자리. */
  headerRoom: 118,
  traitRoom: 210,
  buttonHeight: 92,
  buttonGap: 18,
  footRoom: 40,
} as const;

/** 쌓인 조작 수에서 창 높이를 구한다. */
export function runeTraitPopupHeight(actions: number): number {
  return TRAIT_POPUP.headerRoom + TRAIT_POPUP.traitRoom
    + actions * TRAIT_POPUP.buttonHeight + Math.max(0, actions - 1) * TRAIT_POPUP.buttonGap
    + TRAIT_POPUP.footRoom;
}

/** 쪽지에 서는 조작 한 줄이다. */
interface TraitAction {
  key: string;
  labelKey: TextKey;
  enabled: boolean;
  run: () => Promise<void>;
  /** 재해석처럼 **결과를 고르게 해야 하는** 조작이다. 끝나고 비교 쪽지를 연다. */
  compare?: boolean;
}

/** 가방에 있는 아이템 수다. 없으면 0이다. */
function ownedItems(itemId: string): number {
  return session.itemInventory.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
}

/** 지금 이 룬에 세울 수 있는 조작들이다. 조작이 늘면 이 목록에만 더한다. */
function traitActions(rune: RuneInstance): TraitAction[] {
  const trait = rune.trait;
  const grant = RUNE_TRAIT_ITEMS.grant;
  const grantHigh = RUNE_TRAIT_ITEMS.grantHigh;
  const upgrade = RUNE_TRAIT_ITEMS.upgrade;
  const actions: TraitAction[] = [
    {
      key: "grant",
      labelKey: trait === undefined ? "rune.traitAction.grant" : "rune.traitAction.regrant",
      enabled: ownedItems(grant.itemId) > 0,
      run: async () => { await gameApi.grantRuneTrait({ runeInstanceId: rune.instanceId, itemId: grant.itemId, requestId: `trait-${Date.now()}` }); },
    },
    {
      key: "grantHigh",
      labelKey: "rune.traitAction.grantHigh",
      enabled: ownedItems(grantHigh.itemId) > 0,
      run: async () => { await gameApi.grantRuneTrait({ runeInstanceId: rune.instanceId, itemId: grantHigh.itemId, requestId: `trait-high-${Date.now()}` }); },
    },
  ];
  // 재해석과 등급 상승은 **특성이 있을 때만** 선다. 없는 룬에 세우면 눌러도 아무 일이 없는
  // 칸이 되어 준비 상태를 과장한다.
  if (trait !== undefined) {
    actions.push({
      key: "reroll",
      labelKey: "rune.traitAction.reroll",
      enabled: session.wallet.rawStone >= RUNE_TRAIT_RULES.rerollCost[trait.grade],
      run: async () => { await gameApi.rerollRuneTrait({ runeInstanceId: rune.instanceId, requestId: `trait-reroll-${Date.now()}` }); },
      compare: true,
    });
    if (canUpgradeRuneTraitGrade(trait)) {
      actions.push({
        key: "upgrade",
        labelKey: "rune.traitAction.upgrade",
        enabled: ownedItems(upgrade.itemId) > 0,
        run: async () => { await gameApi.upgradeRuneTrait({ runeInstanceId: rune.instanceId, itemId: upgrade.itemId, requestId: `trait-up-${Date.now()}` }); },
      });
    }
  }
  return actions;
}

/** 특성 한 줄을 그린다. 없으면 그 자리를 비우고 「특성 없음」만 남긴다. */
function paintTrait(scene: Phaser.Scene, body: Phaser.GameObjects.Container, keywords: KeywordManager, y: number, trait: RuneTrait | undefined, width: number): void {
  if (trait === undefined) {
    body.add(scene.add.text(0, y + 40, t("rune.trait.none"), textStyle({ role: "body", size: 28, color: COLOR.inkDim })).setOrigin(0.5));
    return;
  }
  const view = runeTraitView(trait);
  const grade = scene.add.text(-width / 2 + 40, y, `[${view.gradeLabel}]`, textStyle({ role: "emphasis", size: 26, color: COLOR.inkDim })).setOrigin(0, 0.5);
  body.add(grade);
  body.add(scene.add.text(grade.x + grade.width + 14, y, view.name, textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(0, 0.5));
  // 본문은 규칙어 태그를 그대로 담고 있으므로 그리는 일은 공용 경계 하나가 맡는다.
  const text = keywords.layout(view.description, { width: width - 80, size: 26, color: COLOR.ink });
  text.setPosition(-width / 2 + 40, y + 40);
  body.add(text);
}


/** 재해석 결과 비교 쪽지의 세로 좌표다. */
const REROLL_POPUP = { width: 900, height: 720, columnGap: 220 } as const;

/**
 * 재해석 결과를 나란히 놓고 고르게 한다.
 *
 * **고르기 전에는 룬이 바뀌지 않는다** — 서버가 후보를 들고 있으므로 여기서 닫고 나가도
 * 원석이 사라지지 않고, 다시 들어오면 같은 후보가 기다린다.
 */
function openRerollCompare(options: {
  scene: Phaser.Scene;
  popups: PopupLayer;
  keywords: KeywordManager;
  runeInstanceId: string;
  current: RuneTrait | null;
  candidate: RuneTrait;
  upgraded: boolean;
  onResolved: () => void;
}): void {
  const { scene, popups, keywords, candidate } = options;
  popups.open({ width: REROLL_POPUP.width, height: REROLL_POPUP.height, title: t("rune.traitReroll.title"), dim: true, closeOnBackdrop: false }, (body, close) => {
    const top = -REROLL_POPUP.height / 2;
    const label = (y: number, key: TextKey): void => {
      body.add(scene.add.text(-REROLL_POPUP.width / 2 + 40, y, t(key), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    };
    if (options.current) {
      label(top + 110, "rune.traitReroll.current");
      paintTrait(scene, body, keywords, top + 158, options.current, REROLL_POPUP.width);
    }
    label(top + 330, "rune.traitReroll.candidate");
    // 천장은 「지금 어디까지 왔나」만 말한다. 다음에 확정으로 오른다는 약속을 문장으로 적지
    // 않는 이유는, 그 약속이 등급마다 다른 수라 화면에 적으면 곧 옛말이 되기 때문이다.
    if (RUNE_TRAIT_RULES.pityThreshold[candidate.grade] > 0) {
      body.add(scene.add.text(-REROLL_POPUP.width / 2 + 40, top + 62,
        t("rune.traitReroll.pity", { done: candidate.upgradeMisses, total: RUNE_TRAIT_RULES.pityThreshold[candidate.grade] }),
        textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    }
    if (options.upgraded) {
      body.add(scene.add.text(REROLL_POPUP.width / 2 - 40, top + 330, t("rune.traitReroll.upgraded"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5));
    }
    paintTrait(scene, body, keywords, top + 378, candidate, REROLL_POPUP.width);

    const resolve = (keepCandidate: boolean): void => {
      void gameApi.resolveRuneTraitReroll({ runeInstanceId: options.runeInstanceId, keepCandidate, requestId: `trait-pick-${Date.now()}` })
        .then(() => { close(); options.onResolved(); });
    };
    body.add(new Button(scene, -REROLL_POPUP.columnGap, REROLL_POPUP.height / 2 - 90, {
      width: 360, height: 92, label: t("rune.traitReroll.keep"), onClick: () => resolve(false),
    }));
    body.add(new Button(scene, REROLL_POPUP.columnGap, REROLL_POPUP.height / 2 - 90, {
      width: 360, height: 92, label: t("rune.traitReroll.apply"), variant: "primary", onClick: () => resolve(true),
    }));
  });
}

/** 특성 연구 쪽지를 연다. 조작이 끝나면 `onChanged`로 알리고 다시 연다. */
export function openRuneTraitPopup(options: {
  scene: Phaser.Scene;
  popups: PopupLayer;
  keywords: KeywordManager;
  rune: RuneInstance;
  onChanged?: () => void;
}): void {
  const { scene, popups, keywords, rune } = options;
  const actions = traitActions(rune);
  const width = TRAIT_POPUP.width;
  popups.open({ width, height: runeTraitPopupHeight(actions.length), title: t("rune.trait.title"), dim: true }, (body, close) => {
    const top = -runeTraitPopupHeight(actions.length) / 2;
    body.add(scene.add.text(0, top + 62, runeDisplayName(rune), textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(0.5));
    body.add(scene.add.text(0, top + 100, runeRarityLabel(rune.rarity), textStyle({ role: "body", size: 24, color: `#${RUNE_ACCENT[rune.rarity].toString(16).padStart(6, "0")}` })).setOrigin(0.5));
    paintTrait(scene, body, keywords, top + TRAIT_POPUP.headerRoom + 54, rune.trait, width);

    actions.forEach((action, index) => {
      const y = top + TRAIT_POPUP.headerRoom + TRAIT_POPUP.traitRoom
        + TRAIT_POPUP.buttonHeight / 2 + index * (TRAIT_POPUP.buttonHeight + TRAIT_POPUP.buttonGap);
      const button = new Button(scene, 0, y, {
        width: width - 120,
        height: TRAIT_POPUP.buttonHeight,
        label: t(action.labelKey),
        ...(action.key === "reroll" && rune.trait
          ? { cost: { icon: "currency-orestone" as const, amount: RUNE_TRAIT_RULES.rerollCost[rune.trait.grade], affordable: action.enabled } }
          : {}),
        onClick: () => {
          if (!action.enabled) return;
          if (action.compare) {
            void gameApi.rerollRuneTrait({ runeInstanceId: rune.instanceId, requestId: `trait-reroll-${Date.now()}` }).then((result) => {
              close();
              openRerollCompare({
                scene, popups, keywords,
                runeInstanceId: rune.instanceId,
                current: result.current,
                candidate: result.candidate,
                upgraded: result.upgraded,
                onResolved: () => options.onChanged?.(),
              });
            });
            return;
          }
          void action.run().then(() => {
            close();
            options.onChanged?.();
          });
        },
      });
      button.setEnabled(action.enabled);
      body.add(button);
    });
  });
}
