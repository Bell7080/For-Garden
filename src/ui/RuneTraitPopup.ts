import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { RUNE_TRAIT_RULES, type RuneTrait } from "../core/runeTraits";
import { Button } from "./Button";
import { KeywordManager } from "../managers/KeywordManager";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { runeTraitView } from "./runeTraitPresentation";
import { session } from "../state/session";
import { playTraitEffect } from "./traitEffects";
import { RUNE_ACCENT } from "./runeIcons";
import { REROLL_AGAIN, REROLL_POPUP } from "./runeTraitRerollLayout";

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

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
  // 등급은 **특성 자신의 등급색**이다 — 연구대·룬 쪽지와 같은 양식이라 같은 [전설]이 창마다 다른 색으로 서지 않는다.
  const tone = RUNE_ACCENT[trait.grade];
  const left = -width / 2 + 40;
  const grade = scene.add.text(left, y, `[${view.gradeLabel}]`, textStyle({ role: "emphasis", size: 30, color: hex(tone) })).setOrigin(0, 0.5);
  body.add(grade);
  body.add(scene.add.text(grade.x + grade.width + 14, y, view.name, textStyle({ role: "display", size: 34 })).setOrigin(0, 0.5));
  // 본문은 규칙어 태그를 그대로 담고 있으므로 그리는 일은 공용 경계 하나가 맡는다.
  const text = keywords.layout(view.description, { width: width - 80, size: 26, color: COLOR.ink });
  text.setPosition(left, y + 40);
  body.add(text);
  // 블록 왼쪽의 얇은 세로 띠가 그 등급을 한 번 더 말해, 현재·후보 두 블록의 등급을 나란히 견주게 한다.
  const bar = scene.add.graphics();
  bar.fillStyle(tone, 0.85);
  bar.fillRect(left - 20, y - 22, 5, 62 + text.getBounds().height);
  body.add(bar);
}


/**
 * 재해석 결과를 나란히 놓고 고르게 한다.
 *
 * **고르기 전에는 룬이 바뀌지 않는다** — 서버가 후보를 들고 있으므로 여기서 닫고 나가도
 * 원석이 사라지지 않고, 다시 들어오면 같은 후보가 기다린다.
 *
 * **밑동의 긴 버튼은 이 쪽지 안에서 재해석을 되풀이한다** — 기존을 유지한 채(후보를 버리고) 곧바로
 * 다시 굴린다. 쪽지를 닫고 연구대로 돌아가 다시 누르는 왕복이 사라진다. 연출은 **새로 나올 후보 자리**에서
 * 터지고, 터지는 순간에 후보가 갈린다.
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
  const { scene, popups, keywords } = options;
  popups.open({ width: REROLL_POPUP.width, height: REROLL_POPUP.height, title: t("rune.traitReroll.title"), dim: true, closeOnBackdrop: false, hideCloseButton: true }, (body, close) => {
    const top = -REROLL_POPUP.height / 2;
    const bottom = REROLL_POPUP.height / 2;
    const candidateY = top + 378;
    let candidate = options.candidate;
    let upgraded = options.upgraded;
    let busy = false;
    let layer: Phaser.GameObjects.Container | undefined;

    const label = (parent: Phaser.GameObjects.Container, y: number, key: TextKey): void => {
      parent.add(scene.add.text(-REROLL_POPUP.width / 2 + 40, y, t(key), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    };

    const resolve = (keepCandidate: boolean): Promise<void> =>
      gameApi.resolveRuneTraitReroll({ runeInstanceId: options.runeInstanceId, keepCandidate, requestId: `trait-pick-${Date.now()}` }).then(() => undefined);

    /** 후보와 버튼을 다시 그린다. 쪽지 자체는 닫지 않아 연속 재해석에서 판이 깜빡이지 않는다. */
    const paint = (): void => {
      layer?.destroy();
      const parent = scene.add.container(0, 0);
      layer = parent;
      body.add(parent);
      if (options.current) {
        label(parent, top + 110, "rune.traitReroll.current");
        paintTrait(scene, parent, keywords, top + 158, options.current, REROLL_POPUP.width);
      }
      label(parent, top + 330, "rune.traitReroll.candidate");
      // 천장은 「지금 어디까지 왔나」만 말한다. 다음에 확정으로 오른다는 약속을 문장으로 적지
      // 않는 이유는, 그 약속이 등급마다 다른 수라 화면에 적으면 곧 옛말이 되기 때문이다.
      if (RUNE_TRAIT_RULES.pityThreshold[candidate.grade] > 0) {
        parent.add(scene.add.text(-REROLL_POPUP.width / 2 + 40, top + 62,
          t("rune.traitReroll.pity", { done: candidate.upgradeMisses, total: RUNE_TRAIT_RULES.pityThreshold[candidate.grade] }),
          textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
      }
      if (upgraded) {
        parent.add(scene.add.text(REROLL_POPUP.width / 2 - 40, top + 330, t("rune.traitReroll.upgraded"), textStyle({ role: "emphasis", size: 24, color: COLOR.accentText })).setOrigin(1, 0.5));
      }
      paintTrait(scene, parent, keywords, candidateY, candidate, REROLL_POPUP.width);

      parent.add(new Button(scene, -REROLL_POPUP.columnGap, bottom - 200, {
        width: 360, height: 92, label: t("rune.traitReroll.keep"), onClick: () => {
          if (busy) return;
          busy = true;
          void resolve(false).then(() => { close(); options.onResolved(); }).catch(() => { busy = false; });
        },
      }));
      parent.add(new Button(scene, REROLL_POPUP.columnGap, bottom - 200, {
        width: 360, height: 92, label: t("rune.traitReroll.apply"), variant: "primary", onClick: () => {
          if (busy) return;
          busy = true;
          void resolve(true).then(() => { close(); options.onResolved(); }).catch(() => { busy = false; });
        },
      }));
      // 기존 유지 후 재해석 — 비용은 지금 룬의 등급이 정한다(후보를 버리면 그 등급이 그대로다).
      const baseGrade = (options.current ?? candidate).grade;
      const cost = RUNE_TRAIT_RULES.rerollCost[baseGrade];
      // 밑변이 오른쪽 아래 깎임(`popupRightEdgeAt`) 안에 16px 여유로 들도록 폭을 정한다.
      parent.add(new Button(scene, 0, bottom - REROLL_AGAIN.fromBottom, {
        width: REROLL_AGAIN.width, height: REROLL_AGAIN.height, label: t("rune.traitReroll.again"),
        cost: { icon: "currency-orestone", amount: cost, affordable: session.wallet.rawStone >= cost },
        onClick: () => {
          if (busy || session.wallet.rawStone < cost) return;
          busy = true;
          void resolve(false)
            .then(() => gameApi.rerollRuneTrait({ runeInstanceId: options.runeInstanceId, requestId: `trait-reroll-${Date.now()}` }))
            .then((next) => {
              const spot = body.getWorldTransformMatrix().transformPoint(0, candidateY);
              // 쪽지 층(`popups.baseDepth`~) 위에 올린다 — 고정 높이로 두면 팝업 뒤에 가려 값만 바뀐 것처럼 보인다.
              playTraitEffect(scene, "reroll", spot.x, spot.y, popups.baseDepth + 100, () => {
                options.current = next.current;
                candidate = next.candidate;
                upgraded = next.upgraded;
                busy = false;
                paint();
              }, RUNE_ACCENT[next.candidate.grade]);
            })
            .catch(() => { busy = false; });
        },
      }));
    };
    paint();
  });
}
