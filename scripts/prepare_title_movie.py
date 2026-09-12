"""타이틀 영상을 화면에 쓰는 WebM·MP4로 굽는다.

원본은 720×1280(9:16) H.264에 오디오가 붙어 있고 4.5MB가 넘는다. 그대로 두면 타이틀이
가장 먼저 받는 파일이 그만큼 무거워지고, 브라우저마다 재생 가능한 코덱이 갈린다.

    pip install imageio-ffmpeg numpy
    python3 scripts/prepare_title_movie.py

**생성 도구의 표식을 지운다.** 원화 우하단 바닥에 흰 마름모 표식이 **한 자리에 고정된 채**
겹쳐 있다. 화면에서 어둠으로 덮으려 해도 그 자리는 로딩 칸과 진행률이 서는 자리라 덮을수록
UI가 함께 묻히므로, 굽는 단계에서 그림 자체를 되돌린다.

지우는 방법은 **가리기가 아니라 합성 되돌리기**다. 표식은 흰색을 일정한 투명도로 덮어 둔
한 겹이라(꼭짓점 알파 0.31, 가장자리는 0으로 부드럽게 떨어진다) 그 알파만 알면
`원본 = (보이는 값 − 알파×255) ÷ (1 − 알파)`로 아래 그림을 그대로 되살릴 수 있다.

알파는 아트에 적혀 있지 않으므로 **영상 자신에서 재어 낸다**: 표식 자리의 위·아래 바닥을
이은 값을 아래 그림의 추정치로 삼아 프레임마다 알파를 구하고, 그 **중앙값**을 쓴다. 대부분의
프레임에서 그 자리는 결이 고른 바닥이라 추정이 맞고, 장화가 지나가는 몇 프레임의 틀린
추정은 중앙값이 걸러 낸다.

칠해서 덮지 않는 이유가 여기 있다 — 표식 자리로 **장화가 지나간다**. 바닥으로 메우면 그
프레임에서 장화가 통째로 뭉개지고, 되돌리기는 장화 위에서도 아래 그림을 그대로 되살린다.

**오디오는 지운다.** 이 영상은 배경 원화를 대신하는 움직이는 그림이라 소리가 없고, 소리가
붙어 있으면 브라우저가 자동 재생 자체를 막는다(muted 자동 재생만 허용한다).

**두 벌을 굽는다.** VP9/WebM이 같은 화질에서 더 작지만 오래된 iOS Safari가 읽지 못하므로,
H.264/MP4를 같은 이름으로 함께 두고 화면이 재생 가능한 쪽을 고른다.

크기는 원본 그대로 둔다 — 화면이 배경 원화와 똑같이 `cover`로 맞추므로 여기서 늘리면
같은 그림을 두 번 확대하는 셈이다.
"""
from pathlib import Path
import sys

import numpy as np

PUBLIC = Path(__file__).resolve().parent.parent / "public"
TARGET = PUBLIC / "sprites" / "movie"
SOURCE_NAME = "titlemovie.mp4"
STEM = "title_001"

# VP9는 CRF가 낮을수록 좋고, 화면 전체를 덮는 그림이라 36이면 배경 원화(WebP q84)와 결이
# 맞으면서 H.264와 같은 크기로 떨어진다.
VP9_CRF = 36
H264_CRF = 26

# 아래 좌표는 **이 원본 한 편의 실측값**이다. 아트가 바뀌면 표식 자리도 바뀌므로 크기가
# 다르면 굽지 않고 멈춘다 — 엉뚱한 자리를 되돌린 영상이 조용히 배포되는 편이 더 나쁘다.
SOURCE_SIZE = (720, 1280)
# 표식의 알파 경계는 x 578~620, y 1138~1181이다. 사방으로 한 뼘 넉넉히 잡는다.
MARK_BOX = (569, 1129, 630, 1191)
# 알파를 잴 때 아래 그림을 짐작하는 데 쓰는 위·아래 표본 줄 수.
SAMPLE_ROWS = 4
# 덮은 색. 표식은 흰 실루엣 한 겹이다.
MARK_COLOR = 255.0


def estimate_mark_alpha(ffmpeg, source: Path) -> np.ndarray:
    """영상 전체를 훑어 표식의 픽셀별 알파를 잰다(`(높이, 너비)` 실수 배열)."""
    x0, y0, x1, y1 = MARK_BOX
    height, width = y1 - y0, x1 - x0
    reader = ffmpeg.read_frames(str(source), pix_fmt="rgb24")
    meta = next(reader)
    frame_w, frame_h = meta["size"]
    if (frame_w, frame_h) != SOURCE_SIZE:
        sys.exit(f"원본 크기가 {frame_w}×{frame_h}다 — 표식 좌표({MARK_BOX})를 다시 실측한다.")

    ramp = ((np.arange(height, dtype=np.float32) + 0.5) / height)[:, None, None]
    samples = []
    for raw in reader:
        frame = np.frombuffer(raw, np.uint8).reshape(frame_h, frame_w, 3).astype(np.float32)
        # 표식이 없었다면 이 자리가 어떤 색이었을지 — 위·아래 바닥을 곧게 이어 짐작한다.
        top = frame[y0 - SAMPLE_ROWS:y0, x0:x1].mean(axis=0)
        bottom = frame[y1:y1 + SAMPLE_ROWS, x0:x1].mean(axis=0)
        under = top[None] * (1 - ramp) + bottom[None] * ramp
        seen = frame[y0:y1, x0:x1]
        samples.append((seen - under) / np.maximum(MARK_COLOR - under, 1.0))

    # 프레임에서 한 번, 채널에서 한 번 — 중앙값을 두 번 지나 틀린 추정을 걸러 낸다.
    alpha = np.median(np.median(np.stack(samples), axis=0), axis=2)
    return np.clip(alpha, 0.0, 0.9)[:, :, None].astype(np.float32)


def erase_mark(frame: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """덮인 한 겹을 걷어 아래 그림을 되살린다."""
    x0, y0, x1, y1 = MARK_BOX
    out = frame.astype(np.float32)
    seen = out[y0:y1, x0:x1]
    out[y0:y1, x0:x1] = (seen - alpha * MARK_COLOR) / np.maximum(1.0 - alpha, 1e-3)
    return np.clip(out, 0, 255).astype(np.uint8)


def transcode(ffmpeg, source: Path, target: Path, alpha: np.ndarray, params: list[str]) -> None:
    """원본을 한 프레임씩 읽어 표식을 걷고 곧바로 다시 굽는다. `params[0]`은 코덱이다."""
    codec, *options = params
    reader = ffmpeg.read_frames(str(source), pix_fmt="rgb24")
    meta = next(reader)
    width, height = meta["size"]
    writer = ffmpeg.write_frames(
        str(target), (width, height), fps=meta["fps"], pix_fmt_in="rgb24", pix_fmt_out="yuv420p",
        # 크기를 16의 배수로 맞춰 주는 기본 동작과 기본 화질 옵션을 끈다 — 원본 크기와 아래
        # 옵션을 그대로 쓰지 않으면 같은 이름의 두 벌이 서로 다른 그림이 된다.
        macro_block_size=1, quality=None, codec=codec, output_params=options,
    )
    writer.send(None)
    for raw in reader:
        frame = np.frombuffer(raw, dtype=np.uint8).reshape(height, width, 3)
        writer.send(erase_mark(frame, alpha).tobytes())
    writer.close()


def main() -> None:
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("pip install imageio-ffmpeg numpy 를 먼저 실행한다.")

    source = PUBLIC / SOURCE_NAME
    if not source.exists():
        print(f"{SOURCE_NAME} 없음 — 이미 구웠다.")
        return

    TARGET.mkdir(parents=True, exist_ok=True)
    alpha = estimate_mark_alpha(imageio_ffmpeg, source)
    print(f"표식 알파 최대 {alpha.max():.3f}")
    webm = TARGET / f"{STEM}.webm"
    mp4 = TARGET / f"{STEM}.mp4"
    transcode(imageio_ffmpeg, source, webm, alpha,
              ["libvpx-vp9", "-an", "-crf", str(VP9_CRF), "-b:v", "0", "-row-mt", "1"])
    # faststart는 moov 상자를 앞으로 옮겨 다 내려받기 전에 재생이 시작되게 한다.
    transcode(imageio_ffmpeg, source, mp4, alpha,
              ["libx264", "-an", "-crf", str(H264_CRF), "-preset", "slow", "-movflags", "+faststart"])
    for baked in (webm, mp4):
        print(f"{source.name} -> {baked.relative_to(PUBLIC)} ({baked.stat().st_size // 1024}KB)")
    source.unlink()


if __name__ == "__main__":
    main()
