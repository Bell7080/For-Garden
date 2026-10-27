import Phaser from "phaser";
import { allBgmTracks, bgmTrackForScene, bgmTracksToEvict, type BgmTrack } from "../core/bgmPlan";
import { audioManager } from "./AudioManager";

type WebAudioManager = Phaser.Sound.BaseSoundManager & { context?: AudioContext };

/**
 * 씬이 시작·재개될 때 `bgmPlan`의 표대로 배경음을 바꾼다. 씬은 음악을 모른다.
 *
 * 배경음은 한 곡이 3~4MB라 타이틀 로딩(`LOADING_STEPS`)에 넣으면 그 한 파일이 화면 전체를
 * 붙잡는다. 그래서 **필요해진 순간 백그라운드로 받아** 디코드하고, 도착했을 때도 그 곡이 여전히
 * 원하는 곡일 때만 튼다(늦게 끝난 내려받기가 지금 곡을 덮지 않는다). 받지 못하면 소리만 없다.
 * 자동 재생이 막힌 브라우저는 Phaser가 첫 입력에서 잠금을 풀 때까지 대기시킨다.
 *
 * **디코드된 곡은 지금 흐르는 한 곡만 메모리에 둔다.** 디코드된 PCM은 mp3 용량이 아니라 길이 × 44.1kHz ×
 * 2채널 × 4바이트라 네 곡이 168MB(타이틀·전투 32MB, 유리 도시·연구 탑 50MB 남짓)나 되고, 한 번 올리면
 * 아무도 놓지 않았다. 모바일 브라우저(특히 iOS 사파리)는 탭이 쓰는 메모리가 한도를 넘는 순간 경고 없이
 * 탭을 죽여 "갑자기 팅기는" 증상으로 나타나므로, 곡이 바뀌면 이전 곡의 디코드 결과를 놓는다. 나머지 곡은
 * 미리 **내려받기만** 해 HTTP 캐시에 두어(디코드하지 않는다) 다시 틀 때 네트워크를 기다리지 않게 한다.
 */
export class BgmDirector {
  private wanted?: BgmTrack;
  private readonly loading = new Map<string, Promise<boolean>>();
  private evictTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly game: Phaser.Game, private readonly enabled = true) {}

  /** 모든 등록된 씬의 시작·재개 사건에 연결한다. 설정·효과 겹침 층은 표에 없어 곡이 그대로다. */
  attach(): void {
    for (const scene of this.game.scene.getScenes(false)) {
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
    if (!track || !this.enabled) return;
    this.wanted = track;
    if (this.game.cache.audio.exists(track.key)) { audioManager?.playMusic(track.key, track.gain); this.scheduleEvict(); return; }
    void this.fetchTrack(track).then((ok) => {
      if (ok && this.wanted === track) { audioManager?.playMusic(track.key, track.gain); this.scheduleEvict(); }
      // 첫 곡이 흐르기 시작하면 나머지 곡을 한 곡씩 미리 받아 둔다 — 전투나 연구소에 들어서는 순간
      // 내려받기를 기다리느라 곡이 끊기는 일이 없게 한다.
      if (ok) void this.prefetchRest();
    });
  }

  /** 교차 전환(페이드)이 끝난 뒤에 이전 곡의 디코드 결과를 놓는다. 그 전에 지우면 페이드 중인 곡이 끊긴다. */
  private scheduleEvict(): void {
    if (this.evictTimer) clearTimeout(this.evictTimer);
    this.evictTimer = setTimeout(() => {
      this.evictTimer = undefined;
      if (!this.wanted) return;
      for (const track of bgmTracksToEvict(this.wanted.key)) {
        if (this.game.cache.audio.exists(track.key)) this.game.cache.audio.remove(track.key);
        // 기억을 지워야 다음에 그 곡이 필요해졌을 때 다시 디코드한다(남기면 성공한 약속만 돌려준다).
        this.loading.delete(track.key);
      }
    }, 1500);
  }

  private prefetching = false;

  private async prefetchRest(): Promise<void> {
    if (this.prefetching) return;
    this.prefetching = true;
    try {
      for (const track of allBgmTracks()) {
        if (this.game.cache.audio.exists(track.key)) continue;
        // 디코드하지 않고 바이트만 받아 브라우저 HTTP 캐시에 데운다 — 디코드 결과는 곡이 필요해질 때 만든다.
        try { await (await fetch(`${import.meta.env.BASE_URL}${track.path}`)).arrayBuffer(); } catch { /* 소리만 늦어질 뿐이다 */ }
      }
    } finally {
      this.prefetching = false;
    }
  }

  private fetchTrack(track: BgmTrack): Promise<boolean> {
    const pending = this.loading.get(track.key);
    if (pending) return pending;
    const context = (this.game.sound as WebAudioManager).context;
    const job = (async (): Promise<boolean> => {
      // HTML5 오디오 폴백에는 디코드 경로가 없다 — 성공을 흉내 내지 않고 소리 없이 둔다.
      if (!context) return false;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${track.path}`);
        if (!response.ok) return false;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        // 받는 동안 다른 곡이 필요해졌다면 놓는다 — 아무도 틀지 않을 곡이 수십 MB를 붙잡는다.
        if (this.wanted && this.wanted.key !== track.key) { this.loading.delete(track.key); return false; }
        this.game.cache.audio.add(track.key, buffer);
        return true;
      } catch {
        return false;
      }
    })();
    this.loading.set(track.key, job);
    // 실패하면 다음 요청에서 다시 받아 볼 수 있게 기억을 지운다.
    void job.then((ok) => { if (!ok) this.loading.delete(track.key); });
    return job;
  }
}
