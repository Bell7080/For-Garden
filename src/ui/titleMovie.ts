import Phaser from "phaser";
import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** 타이틀 영상의 텍스처 키. */
export const TITLE_MOVIE_KEY = "title-movie";

/**
 * 같은 영상의 두 벌.
 *
 * Phaser는 브라우저가 재생할 수 있다고 답하는 첫 번째 것을 고른다. VP9/WebM이 같은 화질에서
 * 더 작지만 오래된 iOS Safari가 읽지 못하므로 H.264/MP4를 뒤에 둔다. 원본은 저장소에 두지
 * 않고 `scripts/prepare_title_movie.py`가 구운 두 파일만 남긴다.
 */
export const TITLE_MOVIE_SOURCES = ["sprites/movie/title_001.webm", "sprites/movie/title_001.mp4"] as const;

/**
 * 정지된 일러스트를 영상이 덮는 데 걸리는 시간.
 *
 * 한 번에 갈아 끼우면 배경이 튄 것처럼 보이고, 너무 길면 두 그림이 겹친 채로 오래 남아
 * 윤곽이 두 겹으로 읽힌다. 같은 구도의 그림이라 한 호흡이면 충분하다.
 */
export const TITLE_MOVIE_FADE_MS = 900;

/**
 * 영상이 끝내 시작하지 않아도 제목은 반드시 선다.
 *
 * 자동 재생을 막는 브라우저·코덱이 없는 기기·파일 하나가 없는 빌드가 모두 여기로 온다 —
 * 아트 파일 하나가 화면 전체를 붙잡지 않는다는 로딩 단계의 태도를 그대로 쓴다.
 */
export const TITLE_MOVIE_FALLBACK_MS = 2600;

/** 세워 둔 영상과 그 수명주기. */
export interface TitleMovie {
  video: Phaser.GameObjects.Video;
  destroy(): void;
}

/**
 * 타이틀 배경 영상을 세워 무한 루프로 재생한다.
 *
 * 배경 원화와 **같은 구도·같은 비율**(720×1280)이라 원화와 똑같이 `cover`로 키운다 — 판
 * 비율에 맞춰 늘이면 같은 그림이 영상에서만 찌그러져 정지 화면과 갈린다.
 *
 * `onPlaying`은 **첫 프레임이 실제로 흐르기 시작한 순간** 한 번만 불린다. 제목 연출이 그
 * 시점에 들어와야 "지금 시작한다"가 한 번에 읽히기 때문이다.
 */
export function startTitleMovie(
  scene: Phaser.Scene,
  depth: number,
  onPlaying: () => void,
): TitleMovie | undefined {
  if (!scene.cache.video.exists(TITLE_MOVIE_KEY)) return undefined;

  const video = scene.add.video(BASE_WIDTH / 2, BASE_HEIGHT / 2, TITLE_MOVIE_KEY).setDepth(depth).setAlpha(0);
  // 소리는 구울 때 지웠지만, 음소거를 명시해야 자동 재생을 막는 브라우저를 지난다.
  video.setMute(true);
  video.setLoop(true);

  let entered = false;
  const enter = (): void => {
    if (entered || !scene.scene.isActive()) return;
    // **크기는 재생 요소에서 직접 읽는다.** 표시 객체의 `width`·`height`는 첫 프레임이 오기
    // 전까지 Phaser가 임시로 잡아 둔 값이라, 그걸로 배율을 구하면 영상이 몇 배로 확대된 채
    // 굳는다(256으로 잡혀 네 배 넘게 커진 적이 있다). 그 값을 알 수 있을 때까지 기다린다.
    const element = video.video as HTMLVideoElement | null;
    const width = element?.videoWidth ?? 0;
    const height = element?.videoHeight ?? 0;
    if (!width || !height) return;

    entered = true;
    scene.events.off(Phaser.Scenes.Events.UPDATE, enter);
    // 임시 크기가 남아 있을 수 있으므로 실제 영상 크기로 다시 맞춘 뒤 배율을 건다.
    video.setSize(width, height);
    const scale = Math.max(BASE_WIDTH / width, BASE_HEIGHT / height);
    video.setDisplaySize(width * scale, height * scale);
    // 정지된 일러스트를 점차 덮는다. 뒤의 원화는 그대로 두어 영상이 실패해도 빈자리가 없다.
    scene.tweens.add({ targets: video, alpha: 1, duration: TITLE_MOVIE_FADE_MS, ease: "Sine.Out" });
    onPlaying();
  };

  video.on(Phaser.GameObjects.Events.VIDEO_PLAYING, enter);
  // 일부 브라우저는 PLAYING 대신 첫 텍스처 갱신만 알린다. 둘 중 먼저 오는 쪽을 쓴다.
  video.on(Phaser.GameObjects.Events.VIDEO_TEXTURE, enter);
  // 두 신호가 모두 크기보다 먼저 올 수 있어, 크기를 알게 되는 프레임까지 매 프레임 확인한다.
  scene.events.on(Phaser.Scenes.Events.UPDATE, enter);
  video.play(true);

  return {
    video,
    destroy: () => {
      video.off(Phaser.GameObjects.Events.VIDEO_PLAYING, enter);
      video.off(Phaser.GameObjects.Events.VIDEO_TEXTURE, enter);
      scene.events.off(Phaser.Scenes.Events.UPDATE, enter);
      video.destroy();
    },
  };
}
