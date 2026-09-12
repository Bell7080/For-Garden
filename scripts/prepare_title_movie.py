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

**되돌아가는 자리를 이어 붙인다.** 이 영상은 타이틀에서 끝없이 되돌아 흐르는데, 마지막
프레임과 첫 프레임이 서로 달라 한 바퀴마다 한 번씩 톡 끊겼다(실측: 연속 프레임끼리는 평균
2.6만큼 달라지는데 이음매만 8.8이라 네 배 가까이 튀었다). 그래서 **꼬리 몇 프레임을 머리에
겹쳐 녹인다** — 마지막 `OVERLAP`장을 잘라 내고, 남은 머리 `OVERLAP`장을 잘라 낸 꼬리와
가중치를 옮겨 가며 섞는다. 그러면 새 마지막 프레임의 다음이 원본에서 실제로 이어지던
프레임이 되어 이음매가 1.9까지 내려간다 — 원본의 평균 걸음(2.6)보다도 작아 한 바퀴가 도는
자리를 눈이 짚지 못한다.

겹치는 길이는 여덟 장(0.33초)이다. 더 길게 녹이면 겹친 두 그림이 서로 비치는 시간이 그만큼
길어지고, 더 짧으면 그 구간의 걸음이 커진다 — 여덟 장에서 구간 최대 걸음이 2.2로 원본의
평균보다 작아 가장 매끄러웠다.

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
# 되돌아가는 자리에서 꼬리와 머리를 겹쳐 녹이는 길이(프레임). 위 설명의 실측에서 고른 값이다.
OVERLAP = 8


def scan_source(ffmpeg, source: Path) -> tuple[np.ndarray, list[np.ndarray], int]:
    """영상 전체를 한 번 훑어 표식의 알파와, 이어 붙일 꼬리 프레임과 전체 장수를 얻는다.

    알파는 픽셀별 `(높이, 너비, 1)` 실수 배열이다. 꼬리는 아직 표식을 걷기 전의 원본이라
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
    tail: list[np.ndarray] = []
    total = 0
    for raw in reader:
        frame = np.frombuffer(raw, np.uint8).reshape(frame_h, frame_w, 3).astype(np.float32)
        total += 1
        # 꼬리는 마지막 OVERLAP장만 들고 있으면 된다 — 한 장이 2.6MB라 전부 쥐지 않는다.
        tail.append(frame.copy())
        if len(tail) > OVERLAP:
            tail.pop(0)
        # 표식이 없었다면 이 자리가 어떤 색이었을지 — 위·아래 바닥을 곧게 이어 짐작한다.
        top = frame[y0 - SAMPLE_ROWS:y0, x0:x1].mean(axis=0)
        bottom = frame[y1:y1 + SAMPLE_ROWS, x0:x1].mean(axis=0)
        under = top[None] * (1 - ramp) + bottom[None] * ramp
        seen = frame[y0:y1, x0:x1]
        samples.append((seen - under) / np.maximum(MARK_COLOR - under, 1.0))

    # 프레임에서 한 번, 채널에서 한 번 — 중앙값을 두 번 지나 틀린 추정을 걸러 낸다.
    alpha = np.median(np.median(np.stack(samples), axis=0), axis=2)
    return np.clip(alpha, 0.0, 0.9)[:, :, None].astype(np.float32), tail, total


def erase_mark(frame: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """덮인 한 겹을 걷어 아래 그림을 되살린다."""
    x0, y0, x1, y1 = MARK_BOX
    out = frame.astype(np.float32)
    seen = out[y0:y1, x0:x1]
    out[y0:y1, x0:x1] = (seen - alpha * MARK_COLOR) / np.maximum(1.0 - alpha, 1e-3)
    return np.clip(out, 0, 255).astype(np.uint8)


def bake(ffmpeg, source: Path, targets: dict[Path, list[str]], alpha: np.ndarray,
         tail: list[np.ndarray], total: int) -> None:
    """표식을 걷고 되돌아가는 자리를 이어 붙인 뒤 두 벌을 **한 번의 훑기로** 함께 굽는다.

    두 벌을 따로 돌리면 같은 계산을 두 번 하는 데다, 한쪽만 값을 고쳤을 때 같은 이름의 두
    파일이 서로 다른 그림이 된다. 인코더는 저마다 다른 프로세스라 나란히 돌아간다.
    """
    length = total - OVERLAP
    if length <= OVERLAP:
        sys.exit(f"원본이 {total}장뿐이라 꼬리 {OVERLAP}장을 겹칠 수 없다.")
    # 꼬리도 머리와 같은 손질을 지나야 섞이는 두 그림의 밝기가 어긋나지 않는다.
    blend_tail = [erase_mark(frame, alpha).astype(np.float32) for frame in tail]

    reader = ffmpeg.read_frames(str(source), pix_fmt="rgb24")
    meta = next(reader)
    width, height = meta["size"]
    writers = []
    for target, params in targets.items():
        codec, *options = params
        writer = ffmpeg.write_frames(
            str(target), (width, height), fps=meta["fps"], pix_fmt_in="rgb24", pix_fmt_out="yuv420p",
            # 크기를 16의 배수로 맞춰 주는 기본 동작과 기본 화질 옵션을 끈다 — 원본 크기와 아래
            # 옵션을 그대로 쓰지 않으면 같은 이름의 두 벌이 서로 다른 그림이 된다.
            macro_block_size=1, quality=None, codec=codec, output_params=options,
        )
        writer.send(None)
        writers.append(writer)

    for index, raw in enumerate(reader):
        # 잘라 낸 꼬리는 이미 머리에 녹아 있다. 여기서 멈춰야 그 자리가 두 번 흐르지 않는다.
        if index >= length:
            break
        frame = erase_mark(np.frombuffer(raw, dtype=np.uint8).reshape(height, width, 3), alpha)
        if index < OVERLAP:
            # 꼬리에서 머리로 가중치를 옮긴다. 첫 장은 거의 꼬리, 마지막 장은 거의 머리다.
            weight = (index + 0.5) / OVERLAP
            mixed = blend_tail[index] * (1 - weight) + frame.astype(np.float32) * weight
            frame = np.clip(mixed, 0, 255).astype(np.uint8)
        data = frame.tobytes()
        for writer in writers:
            writer.send(data)

    for writer in writers:
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
    alpha, tail, total = scan_source(imageio_ffmpeg, source)
    print(f"표식 알파 최대 {alpha.max():.3f} · {total}장에서 꼬리 {OVERLAP}장을 머리에 녹인다")
    webm = TARGET / f"{STEM}.webm"
    mp4 = TARGET / f"{STEM}.mp4"
    bake(imageio_ffmpeg, source, {
        webm: ["libvpx-vp9", "-an", "-crf", str(VP9_CRF), "-b:v", "0", "-row-mt", "1"],
        # faststart는 moov 상자를 앞으로 옮겨 다 내려받기 전에 재생이 시작되게 한다.
        mp4: ["libx264", "-an", "-crf", str(H264_CRF), "-preset", "slow", "-movflags", "+faststart"],
    }, alpha, tail, total)
    for baked in (webm, mp4):
        print(f"{source.name} -> {baked.relative_to(PUBLIC)} ({baked.stat().st_size // 1024}KB)")
    source.unlink()


if __name__ == "__main__":
    main()
