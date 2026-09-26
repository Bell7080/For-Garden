import { playerCardManager } from "../managers/PlayerCardManager";
import Phaser from "phaser";
import type { RaidBattleInputDto } from "../core/expeditionBattle";
import { setDebugScene } from "../debug";
import { defaultSessionAfterReset, saveManager } from "../state/SaveManager";
import { replaceSession, session } from "../state/session";
import { relicProgression } from "../managers/RelicProgressionManager";
import { setTextScale } from "../ui/textScale";
import { setFontLanguage } from "../ui/fonts";
import { setDataLanguage, setTextLanguage, type TextKey } from "../i18n";
import { matchLanguage } from "../core/language";
import { EffectOverlayScene } from "./EffectOverlayScene";
import { settingsManager } from "../managers/SettingsManager";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(data?: { destination?: "lobby" | "raid" | "raidBattle"; raidId?: string; raidBattle?: RaidBattleInputDto }): void {
    setDebugScene("boot");
    let firstRun = false;
    try {
      const loaded = saveManager.load();
      if (loaded) replaceSession(loaded);
      else {
        // 저장 삭제만으로는 모듈의 공유 session 객체가 비워지지 않는다. 데이터 초기화 뒤 부트로
        // 돌아왔을 때 직전 진행을 다시 저장하지 않도록, 저장이 없는 모든 진입에서 새 상태로 교체한다.
        replaceSession(defaultSessionAfterReset());
        firstRun = true;
      }
    } catch {
      // 손상된 로컬 데이터가 전체 앱을 막지 않게 제거하고 계정 연동 전 기본 상태로 복구한다.
      saveManager.reset();
      replaceSession(defaultSessionAfterReset());
      // 문장이 아니라 키를 넘긴다 — 부트는 문구 표가 도착하기 전이라 여기서 고르면 언어를 고른
      // 사람에게도 한국어가 남는다. 타이틀이 표가 온 뒤에 고른다.
      this.registry.set("saveRecoveryNotice", "title.saveRecovered" satisfies TextKey);
    }
    // 임시 지급: 가방이 비어 있으면 세공을 만져 볼 시작 룬을 넣어 준다. 정식 획득 경로가
    // 생기면 이 한 줄과 매니저의 `grantStarterRunes`를 함께 지운다.
    relicProgression.grantStarterRunes();
    // 임시 지급: 특성 재해석·부여를 만져 볼 원석과 아이템을 하한까지 채운다. 이미 저장이 있는
    // 계정도 채워야 해서 룬 지급과 달리 매번 지나간다. 정식 수급이 붙으면 이 줄도 함께 지운다.
    relicProgression.grantRuneTraitTestKit();
    // 임시 지급: 이미 저장이 있는 계정도 레이드를 소환해 볼 수 있게 토벌권을 하한까지 채운다.
    relicProgression.grantRaidTicketTestKit();
    // 임시 지급: 레이드 완료 탭이 어떻게 서는지 볼 수 있게 끝난 판 표본을 넣는다.
    relicProgression.grantRaidHistoryTestKit();
    // 임시 지급: 광고 SDK가 없는 웹 빌드에서도 소탕을 만져 볼 수 있게 소탕권을 하한까지 채운다.
    relicProgression.grantSweepTicketTestKit();
    // 공개 UID와 연구 개시일은 계정이 처음 설 때 한 번만 정해진다. 이전 저장도 여기서 채운다.
    playerCardManager.ensureIdentity();
    // 저장에서 복원한 접근성 배율을 어떤 씬도 생성되기 전에 공용 텍스트 계층에 반영한다.
    setTextScale(session.settings.accessibility.textScale);
    // 저장이 없는 첫 실행에서만 기기 언어를 따른다. 한 번 고른 뒤로는 저장값이 언제나 우선한다 —
    // 기기 언어를 바꿨다고 플레이하던 언어가 말없이 바뀌면 안 된다.
    if (firstRun && typeof navigator !== "undefined") {
      const preferred = navigator.languages?.length ? navigator.languages : [navigator.language ?? ""];
      settingsManager.update({ game: { language: matchLanguage(preferred) } });
    }
    // 글꼴 스택은 씬이 첫 글자를 그리기 전에 정해져 있어야 한다. Phaser Text는 그린 순간의
    // 글꼴로 텍스처를 굳히므로, 나중에 정하면 이미 그린 글자가 대체 글꼴로 남는다.
    setFontLanguage(session.settings.game.language);
    setTextLanguage(session.settings.game.language);
    setDataLanguage(session.settings.game.language);
    // 정규화된 저장값을 Phaser TimeStep 하나에만 적용해 전투 시간과 렌더 빈도를 분리한다.
    settingsManager.syncRuntime(this.game);
    // 글꼴·원화·Puppet 묶음은 타이틀이 로딩 화면 노릇을 하며 읽는다(scenes/loadingSteps.ts).
    // 부트는 저장 로드와 복구만 조율하고 곧바로 넘긴다.
    // 누른 자리에 답하는 겹은 씬 전환과 무관하게 계속 떠 있어야 하므로 start가 아니라 launch다.
    this.scene.launch(EffectOverlayScene.KEY);
    // 성공 정산 뒤에는 이미 로드된 에셋을 다시 기다리지 않고, 같은 저장 복구 경계를 지난 뒤 로비로 간다.
    // 레이드는 제출 뒤 곧바로 시즌 판으로 되돌아간다 — 한 판 밀고 로비를 거쳐 다시 들어오게
    // 하면 세 번 도전하는 동안 같은 길을 여섯 번 지난다.
    // 레이드는 목록이 아니라 방금 친 그 판으로 돌아간다.
    // 「다시 하기」는 목록도 판도 거치지 않고 같은 판의 전장으로 곧장 들어간다.
    if (data?.destination === "raidBattle" && data.raidBattle) this.scene.start("battle", data.raidBattle);
    else if (data?.destination === "raid") this.scene.start("raid", { raidId: data.raidId });
    else this.scene.start(data?.destination === "lobby" ? "lobby" : "title");
  }
}
