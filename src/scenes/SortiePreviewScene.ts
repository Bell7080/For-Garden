import Phaser from "phaser";
import { t } from "../i18n";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { setDebugScene } from "../debug";
import { addBackButton } from "../ui/IconButton";
import { addSceneBackground, BACKGROUND } from "../ui/backgrounds";
import { drawHairline, drawLayer, drawVignette, slantedRect } from "../ui/holo";
import { COLOR, textStyle } from "../ui/theme";

/** 아직 전투 규칙을 붙이지 않은 신규 출격 콘텐츠가 씬 전환 뒤 공개하는 최소 기획 계약이다. */
export interface SortiePreviewData {
  mode: "cake" | "bounty" | "raid";
}

/** 버튼 배치와 씬 연결을 먼저 검수할 수 있도록 세 신규 모드의 내부 목표만 명시하는 임시 정식 화면이다. */
export class SortiePreviewScene extends Phaser.Scene {
  constructor() {
    super("sortiePreview");
  }

  create(data: SortiePreviewData): void {
    // 잘못된 직접 진입도 케이크 대작전으로 안전하게 수렴시키되 게임 진행 데이터는 만들지 않는다.
    const mode = data?.mode ?? "cake";
    const content = {
      cake: { title: t("sortie.cake.name"), type: t("sortie.cake.kind"), objective: t("sortie.cake.goal"), reward: t("sortie.cake.reward") },
      bounty: { title: t("sortie.bounty.name"), type: t("sortie.bounty.kind"), objective: t("sortie.bounty.goal"), reward: t("sortie.bounty.reward") },
      raid: { title: t("sortie.raid.name"), type: t("sortie.raid.kind"), objective: t("sortie.raid.goal"), reward: t("sortie.raid.reward") },
    }[mode];

    const background = { cake: BACKGROUND.sortieCake, bounty: BACKGROUND.sortieBounty, raid: BACKGROUND.sortieRaid }[mode];

    setDebugScene("sortiePreview", content.title);
    addSceneBackground(this, background);
    drawVignette(this, BASE_WIDTH, BASE_HEIGHT, { strength: 0.72 });

    // 기존 홀로그램 판의 단색 유리, 윗선, 기울기를 그대로 사용해 향후 실제 던전 UI가 들어올 자리를 잡는다.
    this.add.text(76, 150, content.title, textStyle({ role: "display", size: 54, color: COLOR.sortieText })).setOrigin(0, 0);
    this.add.text(80, 226, content.type, textStyle({ role: "emphasis", size: 25, color: COLOR.inkDim })).setOrigin(0, 0);
    const panel = drawLayer(this, BASE_WIDTH / 2, 760, slantedRect(900, 560, 34), { fill: COLOR.panel, alpha: 0.9, edge: COLOR.sortie, edgeAlpha: 0.72 });
    this.add.existing(panel);
    drawHairline(this, BASE_WIDTH / 2, 620, 740, { color: COLOR.sortie, alpha: 0.42 });
    this.add.text(160, 510, t("sortie.goalTitle"), textStyle({ role: "emphasis", size: 27, color: COLOR.sortieText })).setOrigin(0, 0);
    this.add.text(160, 650, content.objective, textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(0, 0);
    this.add.text(160, 790, t("sortie.rewardTitle"), textStyle({ role: "emphasis", size: 27, color: COLOR.sortieText })).setOrigin(0, 0);
    this.add.text(160, 850, content.reward, textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(0, 0);
    this.add.text(BASE_WIDTH / 2, 1230, t("sortie.comingSoon"), textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5);
    addBackButton(this, () => this.scene.start("lobby"));
  }
}
