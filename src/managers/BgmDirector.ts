import Phaser from "phaser";
import { bgmTrackForScene } from "../core/bgmPlan";
import { audioManager } from "./AudioManager";

/**
 * 씬이 시작·재개될 때 `bgmPlan`의 표대로 배경음을 바꾼다. 씬은 음악을 모른다.
 *
 * **배경음은 디코드하지 않고 흘려 재생한다**(`AudioManager.registerStream`). 한때 곡을 받아 `decodeAudioData`로
 * 풀어 두었는데, 3분짜리 곡의 PCM이 50~60MB이고 그 디코드가 데스크톱에서도 1초 걸리며 메인 스레드를 300ms
 * 붙잡았다. 화면마다 곡이 다르므로 화면을 옮길 때마다 그 값을 치렀고(고고학·연구소에 들어설 때 멎는 느낌),
 * 앞 곡과 새 곡이 잠깐 함께 올라 모바일에서 탭이 죽을 수 있었다. 흘려 재생하면 곡당 몇 MB만 들고 기다림이 없다.
 * 자동 재생이 막힌 브라우저는 첫 입력에서 다시 튼다.
 */
export class BgmDirector {
  private readonly registered = new Set<string>();

  constructor(private readonly game: Phaser.Game, private readonly enabled = true) {}

  /** 모든 등록된 씬의 시작·재개 사건에 연결한다. 설정·효과 겹침 층은 표에 없어 곡이 그대로다. */
  attach(): void {
    // 게임 READY 직후에는 씬 관리자가 아직 씬을 만들지 않아 목록이 비어 있다 — 그때 연결하면 어느 씬에도 걸리지
    // 않아 부트에서 건 타이틀 곡이 게임 내내 흐른다. 씬이 선 첫 프레임까지 미룬다.
    const scenes = this.game.scene.getScenes(false);
    if (scenes.length === 0) {
      this.game.events.once(Phaser.Core.Events.POST_STEP, () => this.attach());
      return;
    }
    for (const scene of scenes) {
      const key = scene.scene.key;
      if (!bgmTrackForScene(key)) continue;
      const onEnter = (): void => this.request(key, scene.sys.settings.data);
      scene.events.on(Phaser.Scenes.Events.START, onEnter);
      scene.events.on(Phaser.Scenes.Events.WAKE, onEnter);
    }
    // 부트 씬은 감독이 붙기 전에 이미 시작했을 수 있다 — 지금 돌고 있는 씬 기준으로 곧바로 한 번 요청해
    // 타이틀 로딩 화면부터 곡이 흐르게 한다.
    const running = this.game.scene.getScenes(true).find((s) => bgmTrackForScene(s.scene.key));
    this.request(running ? running.scene.key : "boot");
  }

  private request(sceneKey: string, data?: unknown): void {
    const track = bgmTrackForScene(sceneKey, data);
    if (!track || !this.enabled || !audioManager) return;
    if (!this.registered.has(track.key)) {
      audioManager.registerStream(track.key, `${import.meta.env.BASE_URL}${track.path}`);
      this.registered.add(track.key);
    }
    audioManager.playMusic(track.key, track.gain);
  }
}
