import Phaser from "phaser";
import type { Stats, SummonDef } from "../core/types";
import type { KeywordManager } from "../managers/KeywordManager";
import { playMotion, spawnPuppet, SUMMON_SD_ASSETS } from "../puppets/assets";
import { chipPoints, drawHairline, drawInnerVignette, drawLayer, drawShapeOutline, HOLO } from "./holo";
import type { PopupLayer } from "./PopupLayer";
import { StatRadar } from "./StatRadar";
import { COLOR, textStyle } from "./theme";
import { FALLBACK_SKILL_ICON } from "./skillIcons";
import { openSkillPopup, type SkillInfoViewModel } from "./SkillPopup";
import { SUMMON_INFO_LAYOUT as L, summonInfoModel, type SummonMark } from "./summonInfoModel";

/** 검정/흰색 외형만으로 구분하지 않도록 이름 옆에 서로 다른 선형 문양을 그린다. */
function drawSummonMark(scene: Phaser.Scene, mark: SummonMark, x: number, y: number, size: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  g.lineStyle(HOLO.lineWidth + 2, COLOR.accent, 0.95);
  if (mark === "fang") {
    g.beginPath().moveTo(-size * 0.32, -size * 0.3).lineTo(0, size * 0.36).lineTo(size * 0.32, -size * 0.3).strokePath();
  } else {
    g.arc(0, 0, size * 0.32, -Math.PI * 0.55, Math.PI * 0.55).strokePath();
    g.arc(size * 0.16, 0, size * 0.28, Math.PI * 0.55, -Math.PI * 0.55, true).strokePath();
  }
  return g;
}

/** 소환수의 두 행동과 귀속 패시브를 기존 SkillPopup 계약으로 변환한다. */
function summonSkills(summon: Readonly<SummonDef>): readonly SkillInfoViewModel[] {
  const attack = (kindLabel: string, skill: SummonDef["skills"]["basic"]): SkillInfoViewModel => ({
    name: skill.name, kindLabel, iconAssetId: skill.iconAssetId, effectType: skill.effectType,
    valueLabel: `${skill.power}%`, targeting: skill.targeting,
    description: `${summon.name}가 [[damage|피해]]를 주는 고유 행동이다. 디안의 지휘 아래에서만 사용한다.`,
  });
  return [
    { name: "무리의 동료", kindLabel: "패시브", iconAssetId: "skill-icon-buff", effectType: "buff", description: `디안에게 귀속된 소환수다. 쓰러지면 ${summon.resummon.cooldownSeconds}초 뒤 최대 체력의 ${summon.resummon.hpPercent}%로 돌아온다.` },
    attack("일반 공격", summon.skills.basic),
    attack("궁극기", summon.skills.special),
  ];
}

/** 숫자형 상세 쪽지는 같은 PopupLayer에 열려 본창보다 한 단계 위에서 닫힌다. */
function openNumericDetail(scene: Phaser.Scene, popups: PopupLayer, name: string, ownerLabel: string, ownerValue: number, stats: Stats): void {
  popups.open({ ...L.detail, title: `${name} · 상세 능력치`, dim: true, dimAlpha: 0.14 }, (body) => {
    const rows: readonly [string, number][] = [[`디안 현재 ${ownerLabel}`, ownerValue], ["체력", stats.hp], ["공격력", stats.atk], ["주문력", stats.ap], ["방어력", stats.def], ["저항력", stats.res], ["공격 속도", stats.attackSpeed], ["이동 속도", stats.moveSpeed]];
    rows.forEach(([label, value], index) => {
      const y = -220 + index * 58;
      body.add(scene.add.text(-250, y, label, textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(scene.add.text(250, y, value.toLocaleString(), textStyle({ role: "display", size: 29 })).setOrigin(1, 0.5));
      if (index < rows.length - 1) body.add(drawHairline(scene, 0, y + 29, 500, { color: COLOR.accent, alpha: 0.18 }));
    });
  });
}

/** 정보창과 전투가 공유하는 중형 소환수 전용 팝업이다. */
export function openSummonInfoPopup(scene: Phaser.Scene, popups: PopupLayer, keywords: KeywordManager, ownerStats: Readonly<Stats>, summon: Readonly<SummonDef>): void {
  const model = summonInfoModel(summon, ownerStats);
  popups.open({ width: L.width, height: L.height, x: L.x, y: L.y, title: `${summon.name} · 디안의 동료`, dim: true, dimAlpha: 0.2 }, (body) => {
    body.add(drawSummonMark(scene, model.mark, -330, -350, 72));
    body.add(scene.add.text(-280, -350, summon.name, textStyle({ role: "display", size: 52 })).setOrigin(0, 0.5));
    body.add(scene.add.text(0, -330, `디안 현재 ${model.ownerBasisLabel} ${model.ownerBasisValue.toLocaleString()}`, textStyle({ role: "emphasis", size: 23, color: COLOR.accentText })).setOrigin(0.5));
    body.add(drawHairline(scene, 0, -292, L.width - 100, { color: COLOR.accent, alpha: 0.3 }));

    // 세 액자는 기존 스킬 규칙 그대로 불투명 면·안쪽 비네트·사방 액자선만 허용한다.
    summonSkills(summon).forEach((skill, index) => {
      const button = scene.add.container(L.skillX, L.skillYs[index]);
      const shape = chipPoints(L.skillSize, L.skillSize, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
      button.add(drawLayer(scene, 0, 0, shape, { fill: 0x11161d, alpha: 1, edge: COLOR.accent, edgeAlpha: 0.5 }));
      button.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.52 }));
      const texture = scene.textures.exists(skill.iconAssetId) ? skill.iconAssetId : FALLBACK_SKILL_ICON;
      button.add(scene.add.image(0, -10, texture).setDisplaySize(76, 76));
      button.add(scene.add.text(0, 48, skill.kindLabel, textStyle({ role: "display", size: 20 })).setOrigin(0.5));
      button.add(drawShapeOutline(scene, 0, 0, shape, { color: COLOR.accent, alpha: 0.55, width: 3 }));
      const hit = scene.add.rectangle(0, 0, L.skillSize, L.skillSize, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => button.setScale(1.1));
      hit.on("pointerout", () => button.setScale(1));
      hit.on("pointerup", () => openSkillPopup(scene, popups, keywords, skill, { x: L.x + L.skillX, y: L.y + L.skillYs[index], onClose: () => button.setScale(1) }));
      button.add(hit); body.add(button);
    });

    // 홀로그램 발판은 닫힌 판이 아니라 타원 광륜과 윗선만 겹쳐 배경을 가리지 않는다.
    const stand = scene.add.graphics({ x: L.standX, y: L.standY });
    stand.fillStyle(COLOR.accent, 0.1).fillEllipse(0, 0, 330, 92);
    stand.lineStyle(HOLO.lineWidth + 1, COLOR.accent, 0.7).strokeEllipse(0, -8, 300, 64);
    body.add(stand);
    const asset = SUMMON_SD_ASSETS[summon.sdAssetKey];
    if (asset) void spawnPuppet(scene, asset, { x: L.standX, groundY: L.standY, height: L.puppetHeight }).then((puppet) => {
      if (!body.active) { puppet.destroy(); return; }
      // Puppet을 본문 자식으로 넣어 본창의 등장 변환·깊이·파괴 수명을 그대로 상속한다.
      playMotion(scene, puppet, "idle");
      body.add(puppet);
      body.once(Phaser.GameObjects.Events.DESTROY, () => puppet.destroy());
    });

    const radar = new StatRadar(scene, L.radarX, L.radarY, L.radarRadius, { values: false, power: true });
    radar.draw(model.stats, L.radarRadius); body.add(radar);
    const detail = scene.add.container(L.radarX, 250);
    detail.add(scene.add.text(0, 0, "⌕  자세히 보기", textStyle({ role: "emphasis", size: 25, color: COLOR.accentText })).setOrigin(0.5));
    const detailHit = scene.add.rectangle(0, 0, 220, 64, 0xffffff, 0).setInteractive({ useHandCursor: true });
    detailHit.on("pointerdown", () => detail.setScale(1.08)); detailHit.on("pointerout", () => detail.setScale(1));
    detailHit.on("pointerup", () => { detail.setScale(1); openNumericDetail(scene, popups, summon.name, model.ownerBasisLabel, model.ownerBasisValue, model.stats); });
    detail.add(detailHit); body.add(detail);
  });
}
