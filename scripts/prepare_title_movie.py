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

**되돌아가는 자리에서 한 번 숨을 쉰다.** 이 영상은 타이틀에서 끝없이 도는데, 마지막
프레임과 첫 프레임이 서로 달라 한 바퀴마다 톡 끊겼다(실측: 연속 프레임끼리는 평균 2.6만큼
달라지는데 이음매만 8.8이라 네 배 가까이 튀었다). 그래서 **끝에 멈춤과 되돌아감을 덧붙인다** —
원본이 다 흐른 뒤 마지막 프레임에서 `HOLD_SECONDS`만큼 가만히 서 있다가, `RETURN_SECONDS`에
걸쳐 첫 프레임으로 녹아 들어간다. 되돌아온 그림이 곧 첫 프레임이라 그다음 바퀴가 이어진다.

**멈추는 자리를 고를 필요가 없다.** 원본은 끝으로 갈수록 이미 잔잔해져(마지막 열 장의 걸음이
1.55로 평균 2.61의 절반이다) 마지막 프레임에서 서는 것이 그대로 자연스럽다.

**되돌아가는 몫은 원본에 손대지 않고 뒤에 덧붙인다.** 예전에는 꼬리를 머리에 겹쳐 녹였는데,
그러면 **첫 프레임이 꼬리와 섞여** 타이틀이 정지 원화에서 영상으로 넘어가는 순간이 어긋났다
(정지 원화와의 차가 5.37 → 7.87로 벌어졌다). 지금은 원본 프레임을 하나도 건드리지 않으므로
첫 프레임이 정지 원화와 그대로 맞고, 이음매는 뒤에 붙인 몫이 맡는다.

녹아 드는 동안에는 화면이 이미 멈춰 있어 두 그림이 겹쳐도 잔상으로 보이지 않는다 — 움직이는
구간을 겹쳤을 때와 다른 점이다. 가중치는 양 끝에서 느려지는 곡선(smoothstep)이라 멈춤에서
움직임으로 돌아가는 자리가 각지지 않는다.

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
# 다 흐른 뒤 마지막 프레임에서 가만히 서 있는 시간과, 첫 프레임으로 녹아 돌아가는 시간(초).
# 둘을 합친 3.1초가 한 바퀴와 다음 바퀴 사이의 숨이다.
HOLD_SECONDS = 2.6
RETURN_SECONDS = 0.5


def scan_source(ffmpeg, source: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, int]:
    """영상 전체를 한 번 훑어 표식의 알파와, 되돌아갈 첫 장·마지막 장과 전체 장수를 얻는다.

    알파는 픽셀별 `(높이, 너비, 1)` 실수 배열이다. 두 프레임은 아직 표식을 걷기 전의 원본이라
    — 알파를 이 훑기가 끝나야 알 수 있으므로 — 부르는 쪽이 걷어 낸 뒤 쓴다.
    """
    x0, y0, x1, y1 = MARK_BOX
    height, width = y1 - y0, x1 - x0
    reader = ffmpeg.read_frames(str(source), pix_fmt="rgb24")
    meta = next(reader)
    frame_w, frame_h = meta["size"]
    if (frame_w, frame_h) != SOURCE_SIZE:
        sys.exit(f"원본 크기가 {frame_w}×{frame_h}다 — 표식 좌표({MARK_BOX})를 다시 실측한다.")

    ramp = ((np.arange(height, dtype=np.float32) + 0.5) / height)[:, None, None]
    samples = []
    first = last = None
    total = 0
    for raw in reader:
        frame = np.frombuffer(raw, np.uint8).reshape(frame_h, frame_w, 3).astype(np.float32)
        total += 1
        # 되돌아가는 몫에 필요한 것은 양 끝 두 장뿐이다 — 한 장이 2.6MB라 전부 쥐지 않는다.
        if first is None:
            first = frame.copy()
        last = frame
        # 표식이 없었다면 이 자리가 어떤 색이었을지 — 위·아래 바닥을 곧게 이어 짐작한다.
        top = frame[y0 - SAMPLE_ROWS:y0, x0:x1].mean(axis=0)
        bottom = frame[y1:y1 + SAMPLE_ROWS, x0:x1].mean(axis=0)
        under = top[None] * (1 - ramp) + bottom[None] * ramp
        seen = frame[y0:y1, x0:x1]
        samples.append((seen - under) / np.maximum(MARK_COLOR - under, 1.0))

    # 프레임에서 한 번, 채널에서 한 번 — 중앙값을 두 번 지나 틀린 추정을 걸러 낸다.
    if first is None or last is None:
        sys.exit("원본에서 프레임을 하나도 읽지 못했다.")
    alpha = np.median(np.median(np.stack(samples), axis=0), axis=2)
    return np.clip(alpha, 0.0, 0.9)[:, :, None].astype(np.float32), first, last.copy(), total


def erase_mark(frame: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """덮인 한 겹을 걷어 아래 그림을 되살린다."""
    x0, y0, x1, y1 = MARK_BOX
    out = frame.astype(np.float32)
    seen = out[y0:y1, x0:x1]
    out[y0:y1, x0:x1] = (seen - alpha * MARK_COLOR) / np.maximum(1.0 - alpha, 1e-3)
    return np.clip(out, 0, 255).astype(np.uint8)


def bake(ffmpeg, source: Path, targets: dict[Path, list[str]], alpha: np.ndarray,
         first: np.ndarray, last: np.ndarray, total: int) -> int:
    """표식을 걷어 원본을 그대로 흘린 뒤, 멈춤과 되돌아감을 덧붙여 두 벌을 함께 굽는다.

    두 벌을 따로 돌리면 같은 계산을 두 번 하는 데다, 한쪽만 값을 고쳤을 때 같은 이름의 두
    파일이 서로 다른 그림이 된다. 인코더는 저마다 다른 프로세스라 나란히 돌아간다.

    돌려주는 값은 실제로 쓴 전체 장수다.
    """
    reader = ffmpeg.read_frames(str(source), pix_fmt="rgb24")
    meta = next(reader)
    width, height = meta["size"]
    fps = meta["fps"]
    # **키프레임은 맨 앞 한 장뿐이다.** 멈춤 구간은 같은 그림이 이어져 거의 공짜여야 하는데,
    # 기본 간격대로면 그 안에 키프레임이 여러 장 박혀 3.1초가 300KB 넘게 들었다. 되돌아 돌기만
    # 하고 중간으로 건너뛰는 일이 없는 영상이라(브라우저의 되감기는 키프레임인 0번으로 간다)
    # 간격을 전체 길이로 벌린다 — webm 1424 → 1232KB로 줄었다.
    keyint = str(total + round(HOLD_SECONDS * fps) + round(RETURN_SECONDS * fps))
    writers = []
    for target, params in targets.items():
        codec, *options = params
        options += ["-g", keyint, "-keyint_min", keyint]
        writer = ffmpeg.write_frames(
            str(target), (width, height), fps=fps, pix_fmt_in="rgb24", pix_fmt_out="yuv420p",
            # 크기를 16의 배수로 맞춰 주는 기본 동작과 기본 화질 옵션을 끈다 — 원본 크기와 아래
            # 옵션을 그대로 쓰지 않으면 같은 이름의 두 벌이 서로 다른 그림이 된다.
            macro_block_size=1, quality=None, codec=codec, output_params=options,
        )
        writer.send(None)
        writers.append(writer)

    written = 0

    def emit(frame: np.ndarray) -> None:
        nonlocal written
        data = frame.tobytes()
        for writer in writers:
            writer.send(data)
        written += 1

    # 1. 원본을 그대로 흘린다. 첫 프레임이 정지 원화와 맞아야 하므로 한 장도 건드리지 않는다.
    for raw in reader:
        emit(erase_mark(np.frombuffer(raw, dtype=np.uint8).reshape(height, width, 3), alpha))

    # 2. 마지막 프레임에서 가만히 선다. 같은 그림이 이어지므로 용량은 거의 늘지 않는다.
    still = erase_mark(last, alpha)
    for _ in range(round(HOLD_SECONDS * fps)):
        emit(still)

    # 3. 첫 프레임으로 녹아 돌아간다. 마지막 한 장이 첫 프레임과 거의 같아져 다음 바퀴가 잇는다.
    opening = erase_mark(first, alpha).astype(np.float32)
    steps = round(RETURN_SECONDS * fps)
    for step in range(steps):
        # 양 끝에서 느려지는 곡선이라 멈춤에서 움직임으로 돌아가는 자리가 각지지 않는다.
        ratio = (step + 1) / (steps + 1)
        weight = ratio * ratio * (3 - 2 * ratio)
        mixed = still.astype(np.float32) * (1 - weight) + opening * weight
        emit(np.clip(mixed, 0, 255).astype(np.uint8))

    for writer in writers:
        writer.close()
    return written


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
    alpha, first, last, total = scan_source(imageio_ffmpeg, source)
    webm = TARGET / f"{STEM}.webm"
    mp4 = TARGET / f"{STEM}.mp4"
    written = bake(imageio_ffmpeg, source, {
        webm: ["libvpx-vp9", "-an", "-crf", str(VP9_CRF), "-b:v", "0", "-row-mt", "1"],
        # faststart는 moov 상자를 앞으로 옮겨 다 내려받기 전에 재생이 시작되게 한다.
        mp4: ["libx264", "-an", "-crf", str(H264_CRF), "-preset", "slow", "-movflags", "+faststart"],
    }, alpha, first, last, total)
    print(f"표식 알파 최대 {alpha.max():.3f} · 원본 {total}장 뒤에 "
          f"멈춤 {HOLD_SECONDS}초와 되돌아감 {RETURN_SECONDS}초를 붙여 {written}장")
    for baked in (webm, mp4):
        print(f"{source.name} -> {baked.relative_to(PUBLIC)} ({baked.stat().st_size // 1024}KB)")
    source.unlink()


if __name__ == "__main__":
    main()
