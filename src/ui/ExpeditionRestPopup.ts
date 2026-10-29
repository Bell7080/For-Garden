import Phaser from "phaser";
import { applyExpeditionRest, type ExpeditionRelicHealth } from "../core/expeditionAugments";
import { motionPolicy } from "../core/settings";
import { EXPEDITION_REST_RULES } from "../data/expedition";
import { getRelic } from "../data/relics";
import { t } from "../i18n";
import { battleAssetFor, sdAssetForSkin, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { session } from "../state/session";
import { Button } from "./Button";
import { addClippedHit, containerClip } from "./clippedHit";
import { EXPEDITION_REST as L, restCardY } from "./expeditionRestLayout";
import { chipPoints, drawFrameVignette, drawLayer, drawShapeOutline, HOLO, HoloBar } from "./holo";
import { shapeClipMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { COLOR, textStyle } from "./theme";
import { logError } from "../managers/ErrorReporter";

/** 휴식 창이 그리는 렐릭 한 명. 체력은 런의 퍼센트, 최대 체력은 떠날 때 굳힌 값이다. */
export interface ExpeditionRestMember extends ExpeditionRelicHealth {
  level: number;
  maxHp: number;
  skinId?: string | null;
}

/** 휴식 노드 카드와 같은 원화(출격 선택판의 원정 칸). 로딩 표에 이미 있다. */
const REST_CARD_ART = "content-expedition-entry";

/**
 * 원정 휴식 창.
 *
 * 확인 창 한 장으로 「회복합니다」만 묻던 때는 누가 얼마나 회복되는지, 누가 깨어나는지가 눌러 보기 전까지
 * 보이지 않았다. 지금은 편성 셋이 출격 선택판과 같은 카드로 서고, 카드마다 **지금 체력 → 휴식 뒤 체력**과
 * 오르는 양(`+N`)을 미리 말한다. 쓰러진 렐릭이 있으면 카드를 눌러 **누구를 깨울지** 고르고, 고르기 전에는
 * 휴식 버튼이 꺼져 있다. 미리보기는 서버가 쓰는 같은 규칙(`applyExpeditionRest`)을 통과시킨다 — 따로
 * 셈하면 보여 준 것과 받은 것이 갈린다. 나가는 길은 판 밖 우하단의 공용 뒤로가기다.
 */
export function openExpeditionRestPopup(
  scene: Phaser.Scene,
  layer: PopupLayer,
  members: readonly ExpeditionRestMember[],
  onConfirm: (reviveRelicId: string | undefined) => void,
  onClose?: () => void,
): void {
  const motion = motionPolicy(session.settings);
  const still = motion.nonEssentialRepeatFactor === 0;
  const downIds = members.filter(({ alive, currentHp }) => !(alive && currentHp > 0)).map(({ relicId }) => relicId);
  let chosen: string | undefined;

  layer.open({ width: L.width, height: L.height, title: t("expedition.node.rest"), dim: true, backButton: true, onClose }, (body, close) => {
    const C = L.card;
    const summary = downIds.length > 0
      ? t("expedition.rest.summaryRevive", { heal: EXPEDITION_REST_RULES.healPercent, revive: EXPEDITION_REST_RULES.revivePercent })
      : t("expedition.rest.summary", { heal: EXPEDITION_REST_RULES.healPercent });
    body.add(scene.add.text(0, L.summary.y, summary, textStyle({ role: "emphasis", size: L.summary.size, color: COLOR.hpText })).setOrigin(0.5));

    const views: { relicId: string; paint: () => void }[] = [];
    const hint = scene.add.text(0, L.hint.y, t("expedition.rest.pick"), textStyle({ role: "emphasis", size: L.hint.size, color: COLOR.accentText })).setOrigin(0.5);
    body.add(hint);
    const confirm = new Button(scene, 0, L.confirm.y, {
      width: L.confirm.width, height: L.confirm.height, label: t("expedition.node.restConfirm"), fontSize: L.confirm.fontSize, variant: "primary",
      onClick: () => { if (downIds.length > 0 && !chosen) return; close(); onConfirm(chosen); },
    });
    body.add(confirm);
    const refresh = (): void => {
      views.forEach((view) => view.paint());
      const waiting = downIds.length > 0 && !chosen;
      confirm.setEnabled(!waiting);
      hint.setVisible(waiting);
    };

    members.forEach((member, index) => {
      const def = getRelic(member.relicId);
      const y = restCardY(index);
      const down = downIds.includes(member.relicId);
      const card = scene.add.container(0, y);
      body.add(card);
      const shape = chipPoints(C.width, C.height, { bevel: { topLeft: C.bevel, bottomRight: C.bevel } });
      // 고른 카드 둘레의 금빛 — 같은 실루엣을 키워 겹친다(모양을 새로 짓지 않는다).
      const glow = scene.add.container(0, 0);
      C.glow.grow.forEach((grow, layerIndex) => glow.add(drawLayer(scene, 0, 0, chipPoints(C.width + grow * 2, C.height + grow * 2, { bevel: { topLeft: C.bevel + grow * 0.6, bottomRight: C.bevel + grow * 0.6 } }), { fill: COLOR.accent, alpha: C.glow.alpha[layerIndex] })));
      card.add(glow);
      card.add(drawLayer(scene, 0, 0, shape, { fill: 0x0d1219, alpha: HOLO.glass }));
      if (scene.textures.exists(REST_CARD_ART)) {
        const art = scene.add.image(0, 0, REST_CARD_ART);
        art.setScale(Math.max(C.width / art.width, C.height / art.height)).setAlpha(C.art.alpha).setMask(shapeClipMask(scene, card, shape));
        card.add(art);
      }
      card.add(drawFrameVignette(scene, 0, 0, C.width, C.height, { strength: 0.7, spread: 0.3 }).setMask(shapeClipMask(scene, card, shape)));
      // 테두리 색이 상태를 말한다 — 살아 있으면 체력 초록, 쓰러졌으면 붉은빛, 깨울 렐릭으로 고르면 금빛.
      const outlines = {
        alive: drawShapeOutline(scene, 0, 0, shape, { color: COLOR.hpFill, alpha: 0.9, width: 3 }),
        down: drawShapeOutline(scene, 0, 0, shape, { color: COLOR.danger, alpha: 0.9, width: 3 }),
        picked: drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 1, width: 4 }),
      };
      card.add(Object.values(outlines));

      // SD — 발은 칸 아래쪽, 머리만 윗변 밖으로 내민다(출격 선택판과 같은 결).
      const groundY = C.height / 2 - C.sd.footFromBottom;
      addSdFootShadow(scene, C.sd.x, groundY, C.sd.shadow, card);
      const stage = scene.add.container(0, 0);
      card.add(stage);
      let figure: PuppetCreature | undefined;
      void spawnPuppet(scene, sdAssetForSkin(member.relicId, member.skinId ?? null) ?? battleAssetFor(member.relicId), { x: C.sd.x, groundY, height: C.sd.height, depth: 0 }).then((sd) => {
        if (!stage.active) { sd.destroy(); return; }
        sd.disableInteractive();
        stage.add(sd);
        figure = sd;
        paint();
      }).catch((error) => logError("puppet.display", "휴식 SD 표시 실패", error));

      const textX = C.textX;
      const name = scene.add.text(textX, C.name.y, def.name, textStyle({ role: "display", size: C.name.size, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 5);
      const level = scene.add.text(textX, C.name.y - C.name.size * 0.86, `LV.${member.level}`, textStyle({ role: "emphasis", size: C.name.levelSize, color: COLOR.accentText })).setOrigin(0, 0.5).setStroke("#05070a", 4);
      const gain = scene.add.text(C.rightX, C.gain.y, "", textStyle({ role: "display", size: C.gain.size, color: COLOR.hpText })).setOrigin(1, 0.5).setStroke("#05070a", 7);
      const hp = scene.add.text(textX, C.hp.y, "", textStyle({ role: "emphasis", size: C.hp.size, color: COLOR.ink })).setOrigin(0, 0.5).setStroke("#05070a", 4);
      card.add([name, level, gain, hp]);
      const barWidth = C.rightX - textX;
      const barX = textX + barWidth / 2;
      // 아래 줄은 휴식 **뒤** 체력(밝은 민트), 그 위에 지금 체력(초록)을 덮어 오르는 몫만 밝게 남긴다.
      const after = new HoloBar(scene, barX, C.bar.y, barWidth, C.bar.height, { color: 0xc6ffd2, trackAlpha: 0.8, outline: true, ticks: 9 });
      const before = new HoloBar(scene, barX, C.bar.y, barWidth, C.bar.height, { color: COLOR.hpFill, trackAlpha: 0 });
      card.add([...after.objects, ...before.objects]);
      if (!still) scene.tweens.add({ targets: after.objects, alpha: { from: 1, to: 0.55 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

      const paint = (): void => {
        const preview = applyExpeditionRest(members, EXPEDITION_REST_RULES.healPercent, EXPEDITION_REST_RULES.revivePercent, chosen).find(({ relicId }) => relicId === member.relicId);
        const nowHp = down ? 0 : Math.round(member.maxHp * member.currentHp / 100);
        const picked = down && chosen === member.relicId;
        // 고르지 않은 쓰러진 렐릭은 깨어나지 않는다 — 규칙의 기본값(첫 번째)을 미리보기에 비추지 않는다.
        const nextHp = preview?.alive && (!down || picked) ? Math.round(member.maxHp * preview.currentHp / 100) : 0;
        before.setValue(nowHp / member.maxHp);
        after.setValue(nextHp / member.maxHp);
        glow.setVisible(picked);
        outlines.alive.setVisible(!down); outlines.down.setVisible(down && !picked); outlines.picked.setVisible(picked);
        name.setColor(down && !picked ? COLOR.inkDim : COLOR.ink);
        figure?.setBodyFill(0x000000, down && !picked ? L.downFill : 0);
        if (down && !picked) {
          gain.setText(t("battle.profile.down")).setColor(COLOR.dangerText).setFontSize(C.gain.size * 0.7);
          hp.setText(t("expedition.rest.tapRevive")).setColor(COLOR.inkDim);
        } else if (picked) {
          gain.setText(t("expedition.rest.revive")).setColor(COLOR.accentText).setFontSize(C.gain.size);
          hp.setText(`HP 0 → ${nextHp.toLocaleString()}`).setColor(COLOR.accentText);
        } else {
          const delta = nextHp - nowHp;
          gain.setText(delta > 0 ? `+${delta.toLocaleString()}` : t("expedition.rest.full")).setColor(delta > 0 ? COLOR.hpText : COLOR.inkDim).setFontSize(delta > 0 ? C.gain.size : C.gain.size * 0.7);
          hp.setText(`HP ${nowHp.toLocaleString()} → ${nextHp.toLocaleString()}`).setColor(COLOR.hpText);
        }
      };
      views.push({ relicId: member.relicId, paint });

      // 쓰러진 렐릭만 카드 전체가 눌린다. 고르면 실루엣이 걷히고 한 번 통통 뛴다.
      if (down) {
        const hit = addClippedHit(scene, card, 0, 0, C.width, C.height, containerClip(card, -C.width / 2, -C.height / 2, C.width / 2, C.height / 2));
        hit.on("pointerdown", () => pressIn(card));
        hit.on("pointerout", () => pressOut(card, "normal", { pop: false }));
        hit.on("pointerup", () => {
          pressOut(card);
          if (chosen === member.relicId) return;
          chosen = member.relicId;
          refresh();
          if (figure && !still) startPuppetHop(scene, figure, 0, { once: true });
        });
      }
    });
    refresh();
  });
}
