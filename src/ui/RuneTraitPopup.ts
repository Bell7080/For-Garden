import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { RUNE_TRAIT_RULES, type RuneTrait } from "../core/runeTraits";
import { Button } from "./Button";
import { KeywordManager } from "../managers/KeywordManager";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { runeTraitView } from "./runeTraitPresentation";

/**
 * 재해석 결과를 고르는 쪽지.
 *
 * **조작 버튼은 여기 없다** — 부여·재해석·등급 상승은 연구대(`ResearchBench`) 아래 줄이
 * 세운다. 이 쪽지는 이미 굴린 결과를 놓고 **고르게 하는 일**만 한다.
 */

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
export function openRuneTraitReroll(options: {
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
