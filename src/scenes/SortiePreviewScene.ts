import Phaser from "phaser";
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
      cake: { title: "케이크 대작전", type: "물량 던전", objective: "몰려오는 적을 3웨이브 처치", reward: "성장 재화" },
      bounty: { title: "현상수배", type: "태그 매치", objective: "강한 단일 개체를 3회 처치", reward: "골드 재화" },
      raid: { title: "레이드", type: "협동 작전", objective: "레이드 작전 정보 준비 중", reward: "보상 정보 준비 중" },
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
    this.add.text(160, 510, "작전 목표", textStyle({ role: "emphasis", size: 27, color: COLOR.sortieText })).setOrigin(0, 0);
    this.add.text(160, 650, content.objective, textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(0, 0);
    this.add.text(160, 790, "주요 보상", textStyle({ role: "emphasis", size: 27, color: COLOR.sortieText })).setOrigin(0, 0);
    this.add.text(160, 850, content.reward, textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(0, 0);
    this.add.text(BASE_WIDTH / 2, 1230, "작전 편성 및 전투는 추후 개방됩니다", textStyle({ role: "body", size: 25, color: COLOR.inkDim })).setOrigin(0.5);
    addBackButton(this, () => this.scene.start("lobby"));
  }
}
